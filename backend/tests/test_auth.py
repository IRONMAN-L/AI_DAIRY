def test_signup_successful(client):
    response = client.post(
        "/api/auth/signup",
        json={
            "email": "test@example.com",
            "password": "password123",
            "full_name": "Test User",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "test@example.com"
    assert data["user"]["full_name"] == "Test User"
    assert "id" in data["user"]


def test_signup_duplicate_email(client):
    client.post(
        "/api/auth/signup",
        json={"email": "dupe@example.com", "password": "password123"},
    )
    response = client.post(
        "/api/auth/signup",
        json={"email": "dupe@example.com", "password": "differentpass"},
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_signup_validation_errors(client):
    # Short password (< 6 chars)
    res1 = client.post(
        "/api/auth/signup",
        json={"email": "short@example.com", "password": "123"},
    )
    assert res1.status_code == 422

    # Invalid email format
    res2 = client.post(
        "/api/auth/signup",
        json={"email": "notanemail", "password": "password123"},
    )
    assert res2.status_code == 422


def test_login_successful(client):
    client.post(
        "/api/auth/signup",
        json={"email": "loginuser@example.com", "password": "securepassword", "full_name": "Jane Doe"},
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "loginuser@example.com", "password": "securepassword"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "loginuser@example.com"


def test_login_invalid_password(client):
    client.post(
        "/api/auth/signup",
        json={"email": "wrongpass@example.com", "password": "correctpassword"},
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "wrongpass@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


def test_login_nonexistent_user(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "anypassword"},
    )
    assert response.status_code == 401


def test_get_current_user_me(client):
    signup_res = client.post(
        "/api/auth/signup",
        json={"email": "me@example.com", "password": "password123", "full_name": "Me User"},
    )
    token = signup_res.json()["access_token"]

    # Valid token
    me_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "me@example.com"
    assert me_res.json()["full_name"] == "Me User"

    # Missing token
    no_token_res = client.get("/api/auth/me")
    assert no_token_res.status_code == 401

    # Invalid token
    bad_token_res = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.token.signature"},
    )
    assert bad_token_res.status_code == 401


def test_unassigned_entries_linked_to_first_signup(client):
    # Create an entry before anyone signs up
    create_res = client.post(
        "/api/entries/",
        json={"entry_type": "note", "title": "Old Entry", "content": "Before accounts existed"},
    )
    assert create_res.status_code == 201
    entry_id = create_res.json()["id"]

    # Now sign up the first user
    signup_res = client.post(
        "/api/auth/signup",
        json={"email": "owner@example.com", "password": "password123"},
    )
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]

    # Verify the entry is visible to this user
    user_entries = client.get(
        "/api/entries/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert user_entries.status_code == 200
    ids = [e["id"] for e in user_entries.json()]
    assert entry_id in ids
