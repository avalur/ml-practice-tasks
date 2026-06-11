META = {
    "title": "List Twist",
    "topic": "py_classes",
    "difficulty": "medium",
    "entry": "ListTwist",
    "order": 2,
    "py_deps": [],
    "banned": {},
    "prereqs": ["py_classes/range"],
    "hints": [
        "Subclass collections.UserList and intercept the shortcut names in __getattr__ (read) and __setattr__ (write).",
        "In __setattr__, route real attributes (like 'data') to super().__setattr__; for 'size', truncate or pad self.data with None.",
    ],
    "statement": """
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
""",
}
