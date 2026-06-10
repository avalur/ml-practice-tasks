# List Twist

**Topic:** `py_classes` &nbsp;|&nbsp; **Difficulty:** medium

Implement `ListTwist`, a `collections.UserList` subclass with extra **virtual**
attributes — exposed only through `__getattr__` / `__setattr__` (do **not**
declare them as properties or methods):

- `reversed` / `R` — the list reversed (a new plain list).
- `first` / `F` — get or set the first element.
- `last` / `L` — get or set the last element.
- `size` / `S` — get or set the length: shrinking truncates, growing pads with
  `None`.

The shortcuts must always reflect the current contents (after append, pop,
slicing, etc.).

## How to run

```bash
pytest tasks/py_classes/list_twist
```
Edit `submission.py` until every test passes.
