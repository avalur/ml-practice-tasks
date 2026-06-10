import io

from tools.checks import assert_clean


def test_retyper_retypes(impl):
    try:
        with impl.retyper(ValueError, TypeError):
            raise ValueError("penguin")
    except TypeError as e:
        assert "penguin" in e.args
    else:
        assert False, "retyper should raise TypeError"


def test_retyper_idles_on_other(impl):
    try:
        with impl.retyper(ValueError, TypeError):
            raise IOError
    except IOError:
        pass
    except Exception as e:  # noqa: BLE001
        assert False, f"wrong exception type {e!r}"
    else:
        assert False, "should have raised"


def test_nested_retypers(impl):
    try:
        with impl.retyper(TypeError, IOError), impl.retyper(ValueError, TypeError):
            raise ValueError("lalala", 1)
    except IOError as e:
        assert e.args == ("lalala", 1)
    else:
        assert False, "wrong exception from nested managers"


def test_supresser_idles_on_other(impl):
    try:
        with impl.supresser(ValueError, TypeError):
            raise IOError
    except IOError:
        pass
    else:
        assert False, "non-listed exception should propagate"


def test_supresser_suppresses(impl):
    with impl.supresser(ValueError, TypeError):
        raise ValueError("message")
    # reaching here means the exception was swallowed


def test_dumper_to_stream(impl):
    stream = io.StringIO()
    try:
        with impl.dumper(stream):
            raise ValueError("message to log")
    except ValueError:
        assert "message to log" in stream.getvalue()
    else:
        assert False, "dumper should re-raise"


def test_dumper_default_stderr(impl, capsys):
    try:
        with impl.dumper():
            raise ValueError("to stderr")
    except ValueError:
        assert "to stderr" in capsys.readouterr().err
    else:
        assert False, "dumper should re-raise"


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
