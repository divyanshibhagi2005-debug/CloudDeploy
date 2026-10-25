
import sqlite3

import pytest

from app.main import app, get_db


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    test_db = tmp_path / "test_tasks.db"
    monkeypatch.setattr("app.main.DATABASE_PATH", test_db)

    with sqlite3.connect(test_db) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0
            )
        """)


def test_home():
    client = app.test_client()
    response = client.get("/")
    assert response.status_code == 200


def test_health():
    client = app.test_client()
    response = client.get("/health")
    assert response.status_code == 200


def test_tasks():
    client = app.test_client()
    response = client.get("/tasks")
    assert response.status_code == 200
    assert response.get_json() == []


def test_add_task():
    client = app.test_client()
    response = client.post(
        "/tasks",
        json={"title": "Learn CI/CD"}
    )

    assert response.status_code == 201
    assert response.get_json()["title"] == "Learn CI/CD"


def test_task_persistence():
    client = app.test_client()

    response = client.post(
        "/tasks",
        json={"title": "Persistence verification"}
    )
    assert response.status_code == 201

    task_id = response.get_json()["id"]

    with get_db() as connection:
        row = connection.execute(
            "SELECT id, title FROM tasks WHERE id = ?",
            (task_id,)
        ).fetchone()

    assert row is not None
    assert row["title"] == "Persistence verification"

    response = client.get("/tasks")
    assert any(
        task["id"] == task_id
        for task in response.get_json()
    )
