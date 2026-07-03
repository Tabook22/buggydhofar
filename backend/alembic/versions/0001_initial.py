"""initial tables

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-29
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=150), nullable=False),
        sa.Column("nationality", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "vehicles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name_en", sa.String(length=120), nullable=False),
        sa.Column("name_ar", sa.String(length=120), nullable=False),
        sa.Column("type", sa.String(length=80), nullable=False),
        sa.Column("seats", sa.Integer(), nullable=False),
        sa.Column("price_per_hour", sa.Float(), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=False),
        sa.Column("is_available", sa.Boolean(), nullable=False),
        sa.Column("display_on_home", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "routes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name_en", sa.String(length=120), nullable=False),
        sa.Column("name_ar", sa.String(length=120), nullable=False),
        sa.Column("description_en", sa.Text(), nullable=False),
        sa.Column("description_ar", sa.Text(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=False),
        sa.Column("start_location", sa.String(length=180), nullable=False),
        sa.Column("end_location", sa.String(length=180), nullable=False),
        sa.Column("start_lat", sa.Float(), nullable=False),
        sa.Column("start_lng", sa.Float(), nullable=False),
        sa.Column("end_lat", sa.Float(), nullable=False),
        sa.Column("end_lng", sa.Float(), nullable=False),
        sa.Column("path_points", sa.Text(), nullable=False),
        sa.Column("is_popular", sa.Boolean(), nullable=False),
        sa.Column("display_on_home", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "admins",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("customer_name", sa.String(length=150), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=150), nullable=False),
        sa.Column("nationality", sa.String(length=100), nullable=False),
        sa.Column("hotel_location", sa.String(length=180), nullable=False),
        sa.Column("date", sa.String(length=20), nullable=False),
        sa.Column("time", sa.String(length=20), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("route_id", sa.Integer(), sa.ForeignKey("routes.id"), nullable=False),
        sa.Column("passengers", sa.Integer(), nullable=False),
        sa.Column("total_price", sa.Float(), nullable=False),
        sa.Column("payment_method", sa.String(length=40), nullable=False),
        sa.Column("payment_status", sa.String(length=40), nullable=False),
        sa.Column("booking_status", sa.String(length=40), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("bookings")
    op.drop_table("admins")
    op.drop_table("routes")
    op.drop_table("vehicles")
    op.drop_table("users")
