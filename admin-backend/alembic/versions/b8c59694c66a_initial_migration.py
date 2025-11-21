"""initial migration

Revision ID: b8c59694c66a
Revises: 
Create Date: 2025-11-22 05:09:28.650586

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8c59694c66a'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create merchants table
    op.create_table(
        'merchants',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('place_id', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('latitude', sa.DECIMAL(precision=10, scale=8), nullable=True),
        sa.Column('longitude', sa.DECIMAL(precision=11, scale=8), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_merchants_id'), 'merchants', ['id'], unique=False)
    op.create_index(op.f('ix_merchants_place_id'), 'merchants', ['place_id'], unique=True)

    # Create payment_transactions table
    op.create_table(
        'payment_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('transaction_id', sa.String(length=36), nullable=False),
        sa.Column('merchant_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('user_name', sa.String(length=255), nullable=True),
        sa.Column('card_name', sa.String(length=255), nullable=False),
        sa.Column('card_id', sa.Integer(), nullable=True),
        sa.Column('payment_amount', sa.Integer(), nullable=False),
        sa.Column('discount_amount', sa.Integer(), nullable=True),
        sa.Column('discount_type', sa.String(length=50), nullable=True),
        sa.Column('final_amount', sa.Integer(), nullable=False),
        sa.Column('benefit_text', sa.Text(), nullable=True),
        sa.Column('payment_status', sa.String(length=20), nullable=True),
        sa.Column('payment_method', sa.String(length=50), nullable=True),
        sa.Column('qr_data', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['merchant_id'], ['merchants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payment_transactions_created_at'), 'payment_transactions', ['created_at'], unique=False)
    op.create_index(op.f('ix_payment_transactions_id'), 'payment_transactions', ['id'], unique=False)
    op.create_index(op.f('ix_payment_transactions_merchant_id'), 'payment_transactions', ['merchant_id'], unique=False)
    op.create_index(op.f('ix_payment_transactions_transaction_id'), 'payment_transactions', ['transaction_id'], unique=True)
    op.create_index(op.f('ix_payment_transactions_user_id'), 'payment_transactions', ['user_id'], unique=False)

    # Create card_benefits table
    op.create_table(
        'card_benefits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('card_name', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('places', sa.JSON(), nullable=True),
        sa.Column('discount_type', sa.String(length=50), nullable=True),
        sa.Column('discount_value', sa.Integer(), nullable=True),
        sa.Column('max_discount', sa.Integer(), nullable=True),
        sa.Column('pre_month_config', sa.JSON(), nullable=True),
        sa.Column('limit_config', sa.JSON(), nullable=True),
        sa.Column('places_display', sa.Text(), nullable=True),
        sa.Column('discount_display', sa.Text(), nullable=True),
        sa.Column('limit_display', sa.Text(), nullable=True),
        sa.Column('max_discount_display', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_card_benefits_card_name'), 'card_benefits', ['card_name'], unique=False)
    op.create_index(op.f('ix_card_benefits_category'), 'card_benefits', ['category'], unique=False)
    op.create_index(op.f('ix_card_benefits_id'), 'card_benefits', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_card_benefits_id'), table_name='card_benefits')
    op.drop_index(op.f('ix_card_benefits_category'), table_name='card_benefits')
    op.drop_index(op.f('ix_card_benefits_card_name'), table_name='card_benefits')
    op.drop_table('card_benefits')

    op.drop_index(op.f('ix_payment_transactions_user_id'), table_name='payment_transactions')
    op.drop_index(op.f('ix_payment_transactions_transaction_id'), table_name='payment_transactions')
    op.drop_index(op.f('ix_payment_transactions_merchant_id'), table_name='payment_transactions')
    op.drop_index(op.f('ix_payment_transactions_id'), table_name='payment_transactions')
    op.drop_index(op.f('ix_payment_transactions_created_at'), table_name='payment_transactions')
    op.drop_table('payment_transactions')

    op.drop_index(op.f('ix_merchants_place_id'), table_name='merchants')
    op.drop_index(op.f('ix_merchants_id'), table_name='merchants')
    op.drop_table('merchants')
