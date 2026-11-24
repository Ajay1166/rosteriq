from datetime import date
from typing import Optional, List, Set
from app.models.entities import OperatingRule, PublicHoliday

def is_public_holiday(target_date: date, brand_code: str, holidays: List[PublicHoliday]) -> Optional[PublicHoliday]:
    """Check if target_date is a public holiday applicable to the brand."""
    for h in holidays:
        if h.date == target_date:
            if h.applicable_brands == "ALL" or brand_code in [b.strip() for b in h.applicable_brands.split(",")]:
                return h
    return None

def is_operating_day(rule: OperatingRule, target_date: date, brand_code: str, holidays: List[PublicHoliday]) -> tuple[bool, str]:
    """
    Determines if a brand-process operates on target_date under the given OperatingRule.
    Returns: (is_operating: bool, reason: str)
    
    Operating Modes:
    1. 365_DAYS: Monday to Sunday, including public holidays.
    2. DAILY_EXCEPT_HOLIDAYS: Monday to Sunday, excluding public holidays.
    3. SUNDAYS_AND_HOLIDAYS_OFF: Monday to Saturday, excluding public holidays.
    4. CUSTOM: custom working weekdays, sunday_operation flag, public_holiday_operation flag.
    """
    weekday = target_date.weekday() # 0 = Monday, 6 = Sunday
    is_sunday = (weekday == 6)
    holiday = is_public_holiday(target_date, brand_code, holidays)

    mode = rule.operating_mode.upper() if rule.operating_mode else "365_DAYS"

    if mode == "365_DAYS":
        return True, "365 Days Operation"

    if mode == "DAILY_EXCEPT_HOLIDAYS":
        if holiday:
            return False, f"Closed for Public Holiday: {holiday.holiday_name}"
        return True, "Daily except holidays"

    if mode == "SUNDAYS_AND_HOLIDAYS_OFF":
        if is_sunday:
            return False, "Closed on Sundays"
        if holiday:
            return False, f"Closed for Public Holiday: {holiday.holiday_name}"
        return True, "Operating Mon-Sat"

    # CUSTOM mode or fallback
    # Check working weekdays
    allowed_weekdays: Set[int] = set()
    if rule.working_weekdays:
        try:
            allowed_weekdays = {int(w.strip()) for w in rule.working_weekdays.split(",") if w.strip()}
        except Exception:
            allowed_weekdays = {0, 1, 2, 3, 4, 5}

    if weekday not in allowed_weekdays:
        return False, f"Non-working weekday ({target_date.strftime('%A')})"

    if is_sunday and not rule.sunday_operation:
        return False, "Sunday operation disabled"

    if holiday and not rule.public_holiday_operation:
        return False, f"Public holiday operation disabled: {holiday.holiday_name}"

    return True, "Operating as per custom rule"
