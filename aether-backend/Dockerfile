FROM python:3.10-slim

# Устанавливаем рабочую папку внутри контейнера
WORKDIR /app

# Оптимизация кэша: сначала копируем и ставим только зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь остальной код бэкенда
COPY . .

# Открываем порт наружу
EXPOSE 8000

# Команда запуска FastAPI сервера
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
