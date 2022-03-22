def roman_to_int(s: str) -> int:
    sym_to_val = {
        "I": 1, "V": 5, "X": 10,
        "L": 50,"C": 100,"D": 500,"M": 1000
    }
    prev = s[0]
    result = sym_to_val[prev]
    for i, sym in enumerate(s[1:]):
        result += sym_to_val[sym]
        if sym_to_val[sym] > sym_to_val[prev]:
            result -= 2 * sym_to_val[prev]
        prev = sym
    return result
