
import os
import json
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta, timezone

import boto3
import requests
from botocore.exceptions import BotoCoreError, ClientError
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend-dist"

DATABASE_PATH = Path(
    os.environ.get(
        "DATABASE_PATH",
        str(Path(__file__).resolve().parent.parent / "data" / "tasks.db")
    )
)

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
CLOUDWATCH_NAMESPACE = "CloudDeploy/EC2"
CLOUDWATCH_HOST = os.environ.get(
    "CLOUDWATCH_HOST",
    "ip-172-31-31-204.ec2.internal"
)
CLOUDWATCH_ALARM_NAME = "CloudDeploy-HighCPU"

GITHUB_API_URL = (
    "https://api.github.com/repos/"
    "divyanshibhagi2005-debug/CloudDeploy/actions/runs"
)

cloudwatch = boto3.client("cloudwatch", region_name=AWS_REGION)


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
                """
                INSERT OR IGNORE INTO tasks (id, title, completed)
                VALUES (?, ?, ?)
                """,
                (
                    task["id"],
                    task["title"],
                    int(task.get("completed", False))
                )
            )


def get_latest_metric(
    metric_name,
    dimensions,
    namespace=CLOUDWATCH_NAMESPACE
):
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(minutes=30)

    response = cloudwatch.get_metric_statistics(
        Namespace=namespace,
        MetricName=metric_name,
        Dimensions=dimensions,
        StartTime=start_time,
        EndTime=end_time,
        Period=60,
        Statistics=["Average"]
    )

    datapoints = response.get("Datapoints", [])

    if not datapoints:
        return None

    latest = max(
        datapoints,
        key=lambda point: point["Timestamp"]
    )

    return round(latest["Average"], 2)


def get_metric_dimensions(metric_name):
    response = cloudwatch.list_metrics(
        Namespace=CLOUDWATCH_NAMESPACE,
        MetricName=metric_name
    )

    for metric in response.get("Metrics", []):
        dimensions = metric.get("Dimensions", [])

        dimension_values = {
            dimension["Name"]: dimension["Value"]
            for dimension in dimensions
        }

        if dimension_values.get("host") == CLOUDWATCH_HOST:
            return dimensions

    return None


def get_disk_metric():
    dimensions = get_metric_dimensions("disk_used_percent")

    if not dimensions:
        return None

    return get_latest_metric("disk_used_percent", dimensions)


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

    if (
        not data
        or not isinstance(data.get("title"), str)
        or not data["title"].strip()
    ):
        return jsonify({
            "error": "A valid task title is required"
        }), 400

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


@app.route("/cloudwatch/metrics", methods=["GET"])
def get_cloudwatch_metrics():
    try:
        host_dimensions = [
            {"Name": "host", "Value": CLOUDWATCH_HOST}
        ]

        cpu_dimensions = host_dimensions + [
            {"Name": "cpu", "Value": "cpu-total"}
        ]

        memory = get_latest_metric(
            "mem_used_percent",
            host_dimensions
        )

        idle_cpu = get_latest_metric(
            "cpu_usage_idle",
            cpu_dimensions
        )

        cpu = (
            round(100 - idle_cpu, 2)
            if idle_cpu is not None
            else None
        )

        disk = get_disk_metric()

        alarm_response = cloudwatch.describe_alarms(
            AlarmNames=[CLOUDWATCH_ALARM_NAME]
        )

        alarms = [
            {
                "name": alarm["AlarmName"],
                "state": alarm["StateValue"],
                "reason": alarm.get("StateReason", "")
            }
            for alarm in alarm_response.get("MetricAlarms", [])
        ]

        return jsonify({
            "status": "success",
            "region": AWS_REGION,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cpu_percent": cpu,
            "memory_percent": memory,
            "disk_percent": disk,
            "alarms": alarms
        })

    except (BotoCoreError, ClientError):
        app.logger.exception("CloudWatch metrics request failed")

        return jsonify({
            "status": "error",
            "message": "Unable to retrieve CloudWatch metrics"
        }), 502


@app.route("/github/workflows", methods=["GET"])
def github_workflows():
    token = os.environ.get("GITHUB_TOKEN")

    if not token:
        return jsonify({
            "status": "error",
            "message": "GitHub token is not configured"
        }), 503

    try:
        response = requests.get(
            GITHUB_API_URL,
            params={
                "per_page": 10,
                "branch": "master"
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"
            },
            timeout=10
        )

        response.raise_for_status()
        data = response.json()

        runs = []

        for run in data.get("workflow_runs", []):
            runs.append({
                "id": run["id"],
                "name": (
                    run.get("display_title")
                    or run.get("name")
                    or "GitHub Actions workflow"
                ),
                "status": run.get("status"),
                "conclusion": run.get("conclusion"),
                "branch": run.get("head_branch"),
                "commit": (run.get("head_sha") or "")[:7],
                "html_url": run.get("html_url"),
                "created_at": run.get("created_at"),
                "updated_at": run.get("updated_at"),
                "run_number": run.get("run_number")
            })

        return jsonify({
            "status": "success",
            "total_count": data.get("total_count", 0),
            "workflow_runs": runs
        })

    except requests.RequestException as error:
        app.logger.error(
            "GitHub Actions API request failed: %s",
            error
        )

        return jsonify({
            "status": "error",
            "message": "Unable to retrieve GitHub Actions runs"
        }), 502

    except (ValueError, KeyError):
        app.logger.exception("Unexpected GitHub Actions API response")

        return jsonify({
            "status": "error",
            "message": "Invalid response from GitHub"
        }), 502


if __name__ == "__main__":
    import sys

    if len(sys.argv) == 3 and sys.argv[1] == "import-tasks":
        import_tasks_from_json(sys.argv[2])
        print("Task import completed.")
    else:
        app.run(host="0.0.0.0", port=5000)
