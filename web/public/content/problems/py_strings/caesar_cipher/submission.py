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
    raise NotImplementedError("Your code here")
