def longest_common_prefix(strs: list[str]) -> str:
    min_len = len(min(strs, key=lambda x: len(x)))
    syms = []
    i = 0
    for i in range(min_len):
        sym = strs[0][i]
        for s in strs[1:]:
            if sym != s[i]:
                return "".join(syms)
        syms.append(sym)
    return "".join(syms)
