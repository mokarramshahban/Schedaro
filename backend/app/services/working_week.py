from typing import Literal

WorkingWeek = Literal["monday-friday", "monday-saturday"]
FIVE_DAY_WEEK = ("monday", "tuesday", "wednesday", "thursday", "friday")
SIX_DAY_WEEK = FIVE_DAY_WEEK + ("saturday",)


def working_days_for_week(working_week: str) -> list[str]:
    return list(FIVE_DAY_WEEK if working_week == "monday-friday" else SIX_DAY_WEEK)
