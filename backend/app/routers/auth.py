from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_current_user
from app.models.entry import Entry
from app.models.user import User
from app.schemas.auth import (
    AuthTokenResponse,
    UserLoginRequest,
    UserResponse,
    UserSignupRequest,
)
from app.utils.security import create_access_token, hash_password, verify_password

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


@router.post(
    "/signup",
    response_model=AuthTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account"
)
def signup(
    data: UserSignupRequest,
    db: Session = Depends(get_db)
):
    clean_email = data.email.lower().strip()

    # 1. Check for existing user with this email
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    # 2. Hash password and persist new user
    hashed = hash_password(data.password)
    user = User(
        email=clean_email,
        hashed_password=hashed,
        full_name=data.full_name.strip() if data.full_name else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 3. Automatic legacy migration: link any pre-existing unassigned entries to this account
    # This guarantees existing journal entries, tasks, and reflections are preserved
    unassigned_entries = db.query(Entry).filter(Entry.user_id.is_(None)).all()
    if unassigned_entries:
        for entry in unassigned_entries:
            entry.user_id = user.id
        db.commit()

    # 4. Generate persistent access token
    token = create_access_token({"sub": user.id, "email": user.email})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.post(
    "/login",
    response_model=AuthTokenResponse,
    summary="Authenticate and receive JWT token"
)
def login(
    data: UserLoginRequest,
    db: Session = Depends(get_db)
):
    clean_email = data.email.lower().strip()

    # 1. Verify user credentials
    user = db.query(User).filter(User.email == clean_email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Link any remaining unassigned entries to this user
    unassigned_entries = db.query(Entry).filter(Entry.user_id.is_(None)).all()
    if unassigned_entries:
        for entry in unassigned_entries:
            entry.user_id = user.id
        db.commit()

    # 3. Generate token
    token = create_access_token({"sub": user.id, "email": user.email})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get profile of the currently authenticated user"
)
def get_me(
    current_user: User = Depends(get_current_user)
):
    return current_user

