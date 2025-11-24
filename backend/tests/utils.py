from uuid import uuid4
from app.models.user import User

# Mock User
mock_user = User(
    id=uuid4(),
    email="test@example.com",
    full_name="Test User",
    password_hash="hashed_secret",
    is_active=True,
    is_superuser=False
)
