"""Add simple_bonus fields to leagues and user_scores

Revision ID: add_simple_bonus_fields
Revises: None
Create Date: 2026-04-15
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_simple_bonus_fields'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('leagues',
        sa.Column('simple_bonus', sa.Boolean(), nullable=False,
                  server_default='false'))
    op.add_column('user_scores',
        sa.Column('simple_bonus_score', sa.Integer(), nullable=False,
                  server_default='0'))
    op.add_column('user_scores',
        sa.Column('simple_classic_total', sa.Integer(), nullable=False,
                  server_default='0'))

def downgrade():
    op.drop_column('user_scores', 'simple_classic_total')
    op.drop_column('user_scores', 'simple_bonus_score')
    op.drop_column('leagues', 'simple_bonus')
