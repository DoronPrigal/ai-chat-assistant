import base64
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

from langchain_core.tools import tool
from openai import OpenAI

from config import OPENAI_API_KEY, OPENAI_IMAGE_MODEL
from images import save_image

logger = logging.getLogger(__name__)

# יצירת תמונה: המודל הזול ביותר, בגודל ובאיכות הנמוכים (כ-$0.005 לתמונה ב-gpt-image-1-mini)
IMAGE_SIZE = "1024x1024"
IMAGE_QUALITY = "low"

image_client = OpenAI(api_key=OPENAI_API_KEY)

# מזג אוויר: Open-Meteo, חינמי ובלי מפתח. קודם מוצאים את העיר, ואז את התחזית לפי קו רוחב ואורך.
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

# קודי מזג האוויר של Open-Meteo (WMO) במילים
WEATHER_CODES = {
    0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "fog",
    51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 56: "freezing drizzle", 57: "freezing drizzle",
    61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
    71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
    80: "rain showers", 81: "rain showers", 82: "heavy rain showers", 85: "snow showers", 86: "snow showers",
    95: "thunderstorm", 96: "thunderstorm with hail", 99: "thunderstorm with hail",
}


def get_json(url, params):
    """בקשת GET ל-API חיצוני. אם החיבור נפל (תקלת רשת רגעית), מנסים פעם נוספת."""
    full_url = url + "?" + urllib.parse.urlencode(params)
    for attempt in range(2):
        try:
            with urllib.request.urlopen(full_url, timeout=10) as response:
                return json.load(response)
        except urllib.error.URLError:
            if attempt == 1:
                raise


@tool
def get_current_datetime() -> str:
    """Get the current local date, time and day of the week.
    Use this whenever the user asks about today's date, the time, or anything relative to now."""
    return datetime.now().strftime("%A, %d/%m/%Y %H:%M")


@tool
def get_weather(city: str) -> str:
    """Get the current weather and the forecast for the next 7 days in a city.
    Use this whenever the user asks about the weather, the temperature or rain somewhere.
    The city name must be in English (for example "Modiin", "Tel Aviv" or "Paris"),
    even if the user wrote it in another language."""
    try:
        places = get_json(GEOCODING_URL, {"name": city, "count": 1, "language": "en"}).get("results")
        if not places:
            return f"No city named '{city}' was found. Ask the user to check the city name."
        place = places[0]
        forecast = get_json(FORECAST_URL, {
            "latitude": place["latitude"],
            "longitude": place["longitude"],
            "current": "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
            "timezone": "auto",
            "forecast_days": 7,
        })
    except Exception:
        logger.exception("Weather service error")
        return "The weather service is not available right now. Tell the user to try again later."

    now = forecast["current"]
    days = forecast["daily"]
    lines = [
        f"Location: {place['name']}, {place.get('country', '')}",
        f"Now ({now['time']} local time): {now['temperature_2m']}°C, feels like {now['apparent_temperature']}°C, "
        f"{WEATHER_CODES.get(now['weather_code'], 'unknown')}, humidity {now['relative_humidity_2m']}%, "
        f"wind {now['wind_speed_10m']} km/h",
        "Daily forecast (the first day is today):",
    ]
    for i, day in enumerate(days["time"]):
        lines.append(
            f"{day}: {WEATHER_CODES.get(days['weather_code'][i], 'unknown')}, "
            f"{days['temperature_2m_min'][i]}–{days['temperature_2m_max'][i]}°C, "
            f"chance of rain {days['precipitation_probability_max'][i]}%"
        )
    return "\n".join(lines)


@tool
def generate_image(prompt: str) -> str:
    """Create a NEW image from a text description. The image is shown to the user automatically.
    Use this only when the user explicitly asks to create, draw or design an image.
    Never use it to answer about an image the user sent - you can already see that image.
    The prompt must be a detailed description of the image, in English."""
    try:
        result = image_client.images.generate(
            model=OPENAI_IMAGE_MODEL, prompt=prompt, size=IMAGE_SIZE, quality=IMAGE_QUALITY,
            output_format="webp", output_compression=85, n=1,  # webp: קובץ קטן יותר, נטען מהר יותר
        )
        data = base64.b64decode(result.data[0].b64_json)
    except Exception:
        # מחזירים למודל הודעה במקום לקרוס, כדי שיסביר למשתמש
        logger.exception("Image generation error")
        return "Image generation failed. Tell the user you could not create the image this time."
    return save_image(data, "webp")


# כל הכלים שהסוכן יכול להשתמש בהם
tools = [get_current_datetime, get_weather, generate_image]
