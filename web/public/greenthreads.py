"""Cooperative threads for Pyodide runtimes with JSPI stack switching.

Each ``Thread`` runs on a suspendable WebAssembly stack. Blocking operations
yield to the JavaScript event loop, and optional seeded preemption switches at
random lines in problem code to make race conditions observable.
"""

import asyncio
import itertools
import random
import sys
import threading
import time

import js
from pyodide.ffi import can_run_sync, create_proxy, run_sync


_THREADING_UNAVAILABLE = (
    "Thread emulation requires JSPI (Chrome or Edge 137+); "
    "run this task with pytest locally."
)
_spawn_js = js.Function(
    "p",
    "done",
    "setTimeout(() => p.callPromising().catch((e) => console.error(e))"
    ".finally(() => { done(); p.destroy(); done.destroy(); }), 0)",
)

_ORIGINALS = {}
_MAIN_IDENT = threading.get_ident()
_current_ident = [_MAIN_IDENT]
_next_ident = itertools.count(_MAIN_IDENT + 1)
_proxies = {}
_trace_function = None
_installed = False


async def _sleep_async(delay):
    await asyncio.sleep(delay)


async def _acquire_async(lock, timeout):
    if not lock._locked:
        lock._locked = True
        return True

    loop = asyncio.get_running_loop()
    waiter = loop.create_future()
    lock._waiters.append(waiter)
    try:
        if timeout is None:
            await waiter
        else:
            await asyncio.wait_for(waiter, timeout)
        return True
    except asyncio.TimeoutError:
        if waiter in lock._waiters:
            lock._waiters.remove(waiter)
        return False
    except BaseException:
        if waiter in lock._waiters:
            lock._waiters.remove(waiter)
        raise


def _run_sync(coroutine):
    if not can_run_sync():
        coroutine.close()
        raise RuntimeError(_THREADING_UNAVAILABLE)
    ident = _current_ident[0]
    try:
        return run_sync(coroutine)
    finally:
        _current_ident[0] = ident


def _release_proxy(ident):
    _proxies.pop(ident, None)


class Lock:
    """A primitive lock whose waiters yield instead of blocking the browser."""

    def __init__(self):
        self._locked = False
        self._waiters = []

    def acquire(self, blocking=True, timeout=-1):
        if not blocking and timeout != -1:
            raise ValueError("can't specify a timeout for a non-blocking call")
        if timeout is not None and timeout < 0 and timeout != -1:
            raise ValueError("timeout value must be positive")
        if not self._locked:
            self._locked = True
            return True
        if not blocking:
            return False
        wait_timeout = None if timeout is None or timeout == -1 else timeout
        return _run_sync(_acquire_async(self, wait_timeout))

    def release(self):
        if not self._locked:
            raise RuntimeError("release unlocked lock")
        while self._waiters:
            waiter = self._waiters.pop(0)
            if not waiter.done():
                # Keep the lock held and hand it directly to the next waiter.
                waiter.set_result(True)
                return
        self._locked = False

    def locked(self):
        return self._locked

    __enter__ = acquire

    def __exit__(self, *exc):
        self.release()

    def _at_fork_reinit(self):
        self._locked = False
        self._waiters.clear()


def _thread_ident():
    return _current_ident[0]


class Thread(_ORIGINALS.get("Thread", threading.Thread)):
    def start(self):
        if not can_run_sync():
            raise RuntimeError(_THREADING_UNAVAILABLE)
        if getattr(self, "_green_started", False):
            raise RuntimeError("threads can only be started once")
        self._green_started = True
        self._green_alive = True
        self._ident = next(_next_ident)
        self._started.set()
        self._green_done = threading.Event()
        proxy = create_proxy(self._green_bootstrap)
        done_proxy = create_proxy(lambda: _release_proxy(self._ident))
        _proxies[self._ident] = proxy
        _spawn_js(proxy, done_proxy)

    def _green_bootstrap(self):
        previous_ident = _current_ident[0]
        _current_ident[0] = self._ident
        threading._active[self._ident] = self
        if _trace_function is not None:
            sys.settrace(_trace_function)
        try:
            self.run()
        except BaseException:
            threading.excepthook(threading.ExceptHookArgs((*sys.exc_info(), self)))
        finally:
            self._green_alive = False
            threading._active.pop(self._ident, None)
            self._green_done.set()
            _current_ident[0] = previous_ident

    def is_alive(self):
        return getattr(self, "_green_alive", False)

    def join(self, timeout=None):
        if not getattr(self, "_green_started", False):
            raise RuntimeError("cannot join thread before it is started")
        if self is threading.current_thread():
            raise RuntimeError("cannot join current thread")
        if self._green_alive:
            self._green_done.wait(timeout)


class _UnsupportedThread(Thread):
    def start(self):
        raise RuntimeError(_THREADING_UNAVAILABLE)


def _sleep(seconds):
    if seconds < 0:
        raise ValueError("sleep length must be non-negative")
    return _run_sync(_sleep_async(seconds))


def install(preempt=0.0, seed=0, path_prefix="/task/problems"):
    """Install the thread and sleep shims for one problem run."""
    global _trace_function, _installed, _MAIN_IDENT, _current_ident, _next_ident
    if _installed:
        raise RuntimeError("green-thread emulation is already installed")

    _ORIGINALS.update(
        lock=threading.Lock,
        allocate_lock=threading._allocate_lock,
        cr_lock=threading._CRLock,
        get_ident=threading.get_ident,
        thread=threading.Thread,
        sleep=time.sleep,
        sys_trace=sys.gettrace(),
        threading_trace=threading.gettrace(),
    )
    _MAIN_IDENT = _ORIGINALS["get_ident"]()
    _current_ident = [_MAIN_IDENT]
    _next_ident = itertools.count(_MAIN_IDENT + 1)
    _trace_function = None

    threading.Lock = Lock
    threading._allocate_lock = Lock
    threading._CRLock = None
    threading.get_ident = _thread_ident
    threading.Thread = Thread if can_run_sync() else _UnsupportedThread
    time.sleep = _sleep

    if preempt:
        rng = random.Random(seed)

        def local_trace(frame, event, arg):
            if event == "line" and rng.random() < preempt:
                _run_sync(_sleep_async(0))
            return local_trace

        def global_trace(frame, event, arg):
            if frame.f_code.co_filename.startswith(path_prefix):
                return local_trace
            return None

        _trace_function = global_trace
        sys.settrace(global_trace)
        threading.settrace(global_trace)
    _installed = True


def uninstall():
    """Restore the original runtime after a problem has finished running."""
    global _trace_function, _installed, _current_ident
    if not _installed:
        return
    sys.settrace(_ORIGINALS["sys_trace"])
    threading.settrace(_ORIGINALS["threading_trace"])
    threading.Lock = _ORIGINALS["lock"]
    threading._allocate_lock = _ORIGINALS["allocate_lock"]
    threading._CRLock = _ORIGINALS["cr_lock"]
    threading.get_ident = _ORIGINALS["get_ident"]
    threading.Thread = _ORIGINALS["thread"]
    time.sleep = _ORIGINALS["sleep"]
    _current_ident = [_ORIGINALS["get_ident"]()]
    _trace_function = None
    _installed = False