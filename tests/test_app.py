from app.main import app


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
    
def test_add_task():
    client = app.test_client()

    response = client.post(
        "/tasks",
        json={"title": "Learn CI/CD"}
    )

    assert response.status_code == 201