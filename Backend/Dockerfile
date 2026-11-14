# הרצת ה-API בדוקר (חלופה להרצה הרגילה עם env). הקוד עצמו מחובר כ-volume ב-docker-compose.yml.
FROM python:3.14-slim

WORKDIR /app

# התקנת הספריות בלבד. הקוד לא מועתק, אז שינוי בקוד לא דורש בנייה מחדש.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8000

# --reload טוען מחדש את השרת בכל שינוי בקוד
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
