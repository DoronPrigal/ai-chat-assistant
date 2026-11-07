import base64
from datetime import datetime

from langchain_core.tools import tool
from openai import OpenAI

from config import OPENAI_API_KEY, OPENAI_IMAGE_MODEL
from images import save_image

# יצירת תמונה: המודל הזול ביותר, בגודל ובאיכות הנמוכים (כ-$0.005 לתמונה ב-gpt-image-1-mini)
IMAGE_SIZE = "1024x1024"
IMAGE_QUALITY = "low"

image_client = OpenAI(api_key=OPENAI_API_KEY)


@tool
def get_current_datetime() -> str:
    """Get the current local date, time and day of the week.
    Use this whenever the user asks about today's date, the time, or anything relative to now."""
    return datetime.now().strftime("%A, %d/%m/%Y %H:%M")


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
    except Exception as error:
        # מחזירים למודל הודעה במקום לקרוס, כדי שיסביר למשתמש
        print("Image generation error:", error)
        return "Image generation failed. Tell the user you could not create the image this time."
    return save_image(data, "webp")


# כל הכלים שהסוכן יכול להשתמש בהם
tools = [get_current_datetime, generate_image]
