"""ICAO 9303 MRZ helpers: check-digit computation (7-3-1 modulus 10) and TD3 line assembly."""

_WEIGHTS = [7, 3, 1]

def _char_value(c: str) -> int:
    if c == '<':
        return 0
    if c.isdigit():
        return int(c)
    if c.isalpha():
        return ord(c.upper()) - ord('A') + 10
    raise ValueError(f"Invalid MRZ character: {c!r}")

def check_digit(data: str) -> str:
    """ICAO 9303 7-3-1 modulus-10 check digit for a string of MRZ characters."""
    total = sum(_char_value(c) * _WEIGHTS[i % 3] for i, c in enumerate(data))
    return str(total % 10)

def pad(s: str, length: int) -> str:
    s = s.upper().replace(' ', '<')[:length]
    return s + '<' * (length - len(s))

def build_td3_mrz(surname: str, given_names: str, country: str, nationality: str,
                   passport_no: str, dob_yymmdd: str, sex: str, expiry_yymmdd: str,
                   personal_no: str = '') -> tuple[str, str]:
    """Returns (line1, line2), each 44 chars, for a TD3 (passport) MRZ."""
    # Line 1: P<CCCSURNAME<<GIVEN<NAMES<<<<...
    name_field = f"{surname.upper()}<<{given_names.upper().replace(' ', '<')}"
    line1 = pad(f"P<{country.upper()}{name_field}", 44)

    passport_field = pad(passport_no, 9)
    passport_check = check_digit(passport_field)
    nat = pad(nationality, 3)
    dob_check = check_digit(dob_yymmdd)
    expiry_check = check_digit(expiry_yymmdd)
    personal_field = pad(personal_no, 14)
    personal_check = check_digit(personal_field) if personal_no else '<'

    composite_input = (passport_field + passport_check + dob_yymmdd + dob_check +
                        expiry_yymmdd + expiry_check + personal_field + personal_check)
    composite_check = check_digit(composite_input)

    line2 = (passport_field + passport_check + nat + dob_yymmdd + dob_check + sex.upper() +
             expiry_yymmdd + expiry_check + personal_field + personal_check + composite_check)
    assert len(line1) == 44 and len(line2) == 44, (len(line1), len(line2))
    return line1, line2

if __name__ == '__main__':
    # Sanity check against the known-correct base document in the brief
    l1, l2 = build_td3_mrz('JENA', 'SHAKTIKANTA', 'UTO', 'UTO', 'UT0012345',
                            '070203', 'M', '310315')
    print(l1)
    print(l2)
