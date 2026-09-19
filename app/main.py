from flask import Flask, jsonify, request

app = Flask(__name__)

tasks = [
    {"id": 1, "title": "Learn Docker", "completed": False},
    {"id": 2, "title": "Deploy on AWS", "completed": False}
]


@app.route("/")
def home():
    return jsonify({
        "message": "CloudDeploy API is running",
        "status": "success"
    })


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
    data = request.get_json()

    if not data or "title" not in data:
        return jsonify({
            "error": "Task title is required"
        }), 400

    task = {
        "id": len(tasks) + 1,
        "title": data["title"],
        "completed": False
    }

    tasks.append(task)

    return jsonify(task), 201


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)