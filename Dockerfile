
# Stage 1: Build the React frontend
FROM node:22-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# Stage 2: Prepare the Flask application
FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY tests ./tests

# Include the compiled React frontend
COPY --from=frontend-build /frontend/dist ./frontend-dist
VOLUME ["/data"]
ENV DATABASE_PATH=/data/tasks.db
EXPOSE 5000

CMD ["python", "app/main.py"]
