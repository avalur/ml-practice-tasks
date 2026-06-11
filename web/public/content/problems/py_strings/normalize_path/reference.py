def normalize_path(path: str) -> str:
    """
    Normalize a Unix-style ``path`` (a pure string operation, like
    ``os.path.normpath`` but you implement it):

    * collapse repeated slashes and drop ``.`` components,
    * resolve ``..`` against the preceding component (a leading ``..`` survives
      in a relative path; ``..`` at the root of an absolute path is dropped),
    * the empty path and ``"."`` normalize to ``"."``; the root stays ``"/"``.

    The ``pathlib`` module and ``os.path.normpath`` are off-limits. Do it in a
    single O(len(path)) pass (some tests use very long paths).

    :param path: the path to normalize
    :return: the normalized path
    """
    is_abs = path.startswith("/")
    stack: list[str] = []
    for part in path.split("/"):
        if part == "" or part == ".":
            continue
        if part == "..":
            if stack and stack[-1] != "..":
                stack.pop()
            elif not is_abs:
                stack.append("..")
        else:
            stack.append(part)
    result = "/".join(stack)
    if is_abs:
        return "/" + result
    return result or "."
