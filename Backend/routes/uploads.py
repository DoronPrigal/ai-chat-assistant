from fastapi import APIRouter, Depends, HTTPException, UploadFile

from images import detect_image_type, save_image
from models.conversation_models import UploadOut
from security import get_current_user

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])

MAX_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("", response_model=UploadOut, status_code=201)
async def upload_image(file: UploadFile, user: dict = Depends(get_current_user)):
    """מעלה תמונה (PNG, JPEG, WebP או GIF, עד 5MB) ומחזיר את הנתיב שלה, לצירוף להודעה."""
    data = await file.read(MAX_SIZE + 1)  # קוראים בית אחד מעבר למקסימום, כדי לדעת אם הקובץ גדול מדי
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="The image is too large. The maximum size is 5 MB.")

    extension = detect_image_type(data)
    if extension is None:
        raise HTTPException(status_code=400, detail="Only PNG, JPEG, WebP or GIF images are allowed.")

    return {"image_path": save_image(data, extension)}
