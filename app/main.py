
import os
import sqlite3
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend-dist"
DATABASE_PATH = Path(
    os.environ.get(
        "DATABASE_PATH",
        str(Path(__file__).resolve().parent.parent / "data" / "tasks.db")
    )
)


def get_db():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection



def init_db():
    with get_db() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0
            )
        """)



init_db()

import json

def import_tasks_from_json(backup_path):
    backup_path = Path(backup_path)

    if not backup_path.exists():
        return

    with get_db() as connection:
        count = connection.execute(
            "SELECT COUNT(*) FROM tasks"
        ).fetchone()[0]

        if count > 0:
            return

        with backup_path.open("r", encoding="utf-8") as file:
            tasks = json.load(file)

        for task in tasks:
            connection.execute(
                "INSERT OR IGNORE INTO tasks (id, title, completed) VALUES (?, ?, ?)",
                (
                    task["id"],
                    task["title"],
                    int(task.get("completed", False))
                )
            )




@app.route("/")
def home():
    if (FRONTEND_DIR / "index.html").exists():
        return send_from_directory(FRONTEND_DIR, "index.html")

    return jsonify({
        "message": "CloudDeploy API is running",
        "status": "success"
    })


@app.route("/assets/<path:filename>")
def frontend_assets(filename):
    return send_from_directory(FRONTEND_DIR / "assets", filename)


@app.route("/health")
def health():
    return jsonify({"status": "healthy"})


@app.route("/tasks", methods=["GET"])
def get_tasks():
    with get_db() as connection:
        rows = connection.execute(
            "SELECT id, title, completed FROM tasks ORDER BY id"
        ).fetchall()

    return jsonify([
        {
            "id": row["id"],
            "title": row["title"],
            "completed": bool(row["completed"])
        }
        for row in rows
    ])


@app.route("/tasks", methods=["POST"])
def add_task():
    data = request.get_json(silent=True)

    if not data or not isinstance(data.get("title"), str) or not data["title"].strip():
        return jsonify({"error": "A valid task title is required"}), 400

    title = data["title"].strip()

    with get_db() as connection:
        cursor = connection.execute(
            "INSERT INTO tasks (title, completed) VALUES (?, ?)",
            (title, 0)
        )
        task_id = cursor.lastrowid

    return jsonify({
        "id": task_id,
        "title": title,
        "completed": False
    }), 201


if __name__ == "__main__":
    import sys

    if len(sys.argv) == 3 and sys.argv[1] == "import-tasks":
        import_tasks_from_json(sys.argv[2])
        print("Task import completed.")
    else:
        app.run(host="0.0.0.0", port=5000)

