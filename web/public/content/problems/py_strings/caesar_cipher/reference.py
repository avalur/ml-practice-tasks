def caesar_encrypt(message: str, n: int) -> str:
    """
    Encrypt ``message`` with a Caesar cipher: shift every English letter ``n``
    places along the alphabet (wrapping around, preserving case); leave every
    non-letter character unchanged.

    The shift may be negative (decrypt) or larger than 26; ``n`` and ``n % 26``
    give the same result.

    :param message: text to encrypt
    :param n: shift amount
    :return: the encrypted text
    """
    shift = n % 26
    out = []
    for ch in message:
        if "a" <= ch <= "z":
            out.append(chr((ord(ch) - ord("a") + shift) % 26 + ord("a")))
        elif "A" <= ch <= "Z":
            out.append(chr((ord(ch) - ord("A") + shift) % 26 + ord("A")))
        else:
            out.append(ch)
    return "".join(out)
