"""add corporate card support to payment history

Revision ID: add_corp_card_payment
Revises: 761cbf561ca3
Create Date: 2025-12-14

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_corp_card_payment'
down_revision = '761cbf561ca3'
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to payment_history table
    with op.batch_alter_table('payment_history', schema=None) as batch_op:
        # Make card_id nullable (remove foreign key constraint)
        batch_op.alter_column('card_id', nullable=True)

        # Add corporate_card_id column
        batch_op.add_column(sa.Column('corporate_card_id', sa.Integer(), nullable=True))

        # Add is_corporate column
        batch_op.add_column(sa.Column('is_corporate', sa.Boolean(), server_default='false', nullable=True))


def downgrade():
    with op.batch_alter_table('payment_history', schema=None) as batch_op:
        batch_op.drop_column('is_corporate')
        batch_op.drop_column('corporate_card_id')
        batch_op.alter_column('card_id', nullable=False)
