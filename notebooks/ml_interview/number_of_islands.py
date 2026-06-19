import marimo

__generated_with = "0.23.9"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    return (mo,)


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # Number of Islands

    **LeetCode 200 · NeetCode 150 — Graphs**

    Given an `m × n` grid of `'1'` (land) and `'0'` (water), count the
    number of islands.  An island is surrounded by water and is formed by
    connecting adjacent land cells horizontally or vertically.

    **ML relevance**: connected-components reasoning is a proxy for clustering
    intuition — image segmentation, graph community detection, bounding-box
    grouping.  BFS/DFS on a grid is also the basis for flood-fill, a core
    operation in image labelling pipelines.

    ## Expected approach — DFS / BFS with in-place marking, O(m·n)

    For every unvisited `'1'`, increment the count and flood-fill the whole
    island to `'0'` (or a visited marker) so it is not double-counted.

    ```python
    def dfs(grid, r, c):
        if r < 0 or r >= len(grid) or c < 0 or c >= len(grid[0]):
            return
        if grid[r][c] != '1':
            return
        grid[r][c] = '0'           # mark visited
        dfs(grid, r+1, c); dfs(grid, r-1, c)
        dfs(grid, r, c+1); dfs(grid, r, c-1)

    count = 0
    for r in range(len(grid)):
        for c in range(len(grid[0])):
            if grid[r][c] == '1':
                count += 1
                dfs(grid, r, c)
    return count
    ```

    You may modify the input grid in place.  Iterative BFS (using a deque)
    is also fine and avoids Python's recursion limit on large grids.
    """)
    return


@app.cell
def _():
    # --- student: begin ---

    def numIslands(grid: list) -> int:
        """Count the number of islands in a 2D grid.

        Args:
            grid: list of list of '1'/'0' strings (m rows × n columns).
                  You may modify it in place.

        Returns:
            Integer count of distinct islands.
        """
        raise NotImplementedError("Implement numIslands")

    # --- student: end ---
    return (numIslands,)


@app.cell
def _(mo, numIslands):
    def _copy_grid(g):
        return [row[:] for row in g]

    _cases = [
        (
            [["1","1","1","1","0"],
             ["1","1","0","1","0"],
             ["1","1","0","0","0"],
             ["0","0","0","0","0"]],
            1
        ),
        (
            [["1","1","0","0","0"],
             ["1","1","0","0","0"],
             ["0","0","1","0","0"],
             ["0","0","0","1","1"]],
            3
        ),
        (
            [["1"]],
            1
        ),
        (
            [["0"]],
            0
        ),
        (
            [["1","0","1","0","1"]],
            3
        ),
        (
            [["1","1"],
             ["1","1"]],
            1
        ),
        (
            [["1","0"],
             ["0","1"]],
            2
        ),
    ]

    _solved = False
    try:
        for _grid, _expected in _cases:
            _got = numIslands(_copy_grid(_grid))
            assert _got == _expected, \
                f"numIslands(grid): expected {_expected}, got {_got}\ngrid = {_grid}"

        _result = mo.callout(mo.md("✅ `numIslands` is correct on all test cases!"), kind="success")
        _solved = True
    except NotImplementedError as e:
        _result = mo.callout(mo.md(f"✏️ {e}"), kind="neutral")
    except Exception as e:
        _result = mo.callout(mo.md(f"❌ {e}"), kind="danger")
    # --- capture & report ---
    try:
        import inspect as _inspect, json as _json, js as _js
        from pyodide.ffi import to_js as _to_js
        _srcs = []
        for _fn in (numIslands,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "ml_interview/number_of_islands",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved",
                 "notebookId": "ml_interview/number_of_islands"})))
            _ch.close()
        _js.fetch("/api/notebook-progress", _to_js(
            {"method": "POST", "headers": {"Content-Type": "application/json"},
             "credentials": "include", "body": _payload},
            dict_converter=_js.Object.fromEntries))
    except Exception:
        pass
    mo.output.replace(_result)
    return


if __name__ == "__main__":
    app.run()
