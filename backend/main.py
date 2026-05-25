import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import Base, engine, get_db

PASSWORD_RESET_EXPIRE_MINUTES = 30
FRONTEND_URL = "http://localhost:4200"

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Login App API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Login API is running"}


@app.post(
    "/register",
    response_model=schemas.UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(user: schemas.UserRegister, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    new_user = models.User(
        email=user.email,
        full_name=user.full_name,
        hashed_password=auth.hash_password(user.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = (
        db.query(models.User)
        .filter(models.User.email == credentials.email)
        .first()
    )
    if not user or not auth.verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = auth.create_access_token({"sub": user.email, "user_id": user.id})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@app.post("/me/password", response_model=schemas.MessageResponse)
def change_password(
    payload: schemas.ChangePassword,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if not auth.verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if auth.verify_password(payload.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    current_user.hashed_password = auth.hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@app.post("/password-reset/request", response_model=schemas.MessageResponse)
def request_password_reset(
    payload: schemas.ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if user:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=PASSWORD_RESET_EXPIRE_MINUTES
        )
        reset_token = models.PasswordResetToken(
            token=token,
            user_id=user.id,
            expires_at=expires_at,
        )
        db.add(reset_token)
        db.commit()

        reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
        bar = "=" * 60
        print(f"\n{bar}")
        print("       SIMULATED PASSWORD RESET EMAIL")
        print(bar)
        print(f"  To:    {user.email}")
        print(f"  Link:  {reset_link}")
        print(f"  Valid: {PASSWORD_RESET_EXPIRE_MINUTES} minutes")
        print(f"{bar}\n")

    return {
        "message": "If an account exists with that email, "
        "we have sent a password reset link."
    }


@app.post("/password-reset/confirm", response_model=schemas.MessageResponse)
def confirm_password_reset(
    payload: schemas.ResetPasswordConfirm,
    db: Session = Depends(get_db),
):
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired reset link",
    )

    reset_token = (
        db.query(models.PasswordResetToken)
        .filter(models.PasswordResetToken.token == payload.token)
        .first()
    )
    if reset_token is None:
        raise invalid
    if reset_token.used_at is not None:
        raise invalid
    if datetime.now(timezone.utc) > reset_token.expires_at:
        raise invalid

    user = (
        db.query(models.User)
        .filter(models.User.id == reset_token.user_id)
        .first()
    )
    if user is None:
        raise invalid

    user.hashed_password = auth.hash_password(payload.new_password)
    reset_token.used_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "Password has been reset successfully. You can now log in."}