
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend-dist"

tasks = [
    {"id": 1, "title": "Learn Docker", "completed": False},
    {"id": 2, "title": "Deploy on AWS", "completed": False}
]


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
    return jsonify({
        "status": "healthy"
    })


@app.route("/tasks", methods=["GET"])
def get_tasks():
    return jsonify(tasks)


@app.route("/tasks", methods=["POST"])
def add_task():
    data = request.get_json(silent=True)

    if not data or not isinstance(data.get("title"), str) or not data["title"].strip():
        return jsonify({
            "error": "A valid task title is required"
        }), 400

    task = {
        "id": max((item["id"] for item in tasks), default=0) + 1,
        "title": data["title"].strip(),
        "completed": False
    }

    tasks.append(task)

    return jsonify(task), 201


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
