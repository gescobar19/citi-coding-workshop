"""Standard labour costing rules.

The business rule for this platform: an assigned employee works a 40-hour week
and is charged to the project at $100/hour, i.e. $4,000 per full-time week.
Every labour figure in the API is derived from these two constants so the
budget page, project pages and dashboard always agree.
"""

from datetime import date
from decimal import Decimal

STANDARD_HOURLY_RATE = Decimal("100.00")
STANDARD_WEEKLY_HOURS = Decimal("40.00")
FULL_TIME_WEEKLY_COST = STANDARD_HOURLY_RATE * STANDARD_WEEKLY_HOURS  # $4,000


def weekly_cost(allocated_hours) -> Decimal:
    """Cost per week for one allocation at the standard rate."""
    return (Decimal(str(allocated_hours or 0)) * STANDARD_HOURLY_RATE).quantize(
        Decimal("0.01")
    )


def duration_weeks(start: date | None, end: date | None) -> int:
    """Whole weeks a project runs for; 0 when the dates are unknown."""
    if not start or not end or end < start:
        return 0
    return max(1, round((end - start).days / 7))


def projected_cost(allocated_hours, weeks: int) -> Decimal:
    """Total labour cost of an allocation over the life of the project."""
    return (weekly_cost(allocated_hours) * weeks).quantize(Decimal("0.01"))


def pct(part, whole) -> float:
    whole = Decimal(str(whole or 0))
    if whole == 0:
        return 0.0
    return round(float(Decimal(str(part or 0)) / whole * 100), 1)
