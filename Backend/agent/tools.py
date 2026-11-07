from datetime import datetime
from langchain_core.tools import tool


@tool
def get_current_datetime() -> str:
    """Get the current local date, time and day of the week.
    Use this whenever the user asks about today's date, the time, or anything relative to now."""
    return datetime.now().strftime("%A, %d/%m/%Y %H:%M")


# כל הכלים שהסוכן יכול להשתמש בהם
tools = [get_current_datetime]
