"""password_reset_improvements_and_phone_verification

Revision ID: a1b2c3d4e5f6
Revises: 4eb36ce5bd19
Create Date: 2025-01-27 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '4eb36ce5bd19'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns to password_reset_tokens
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    if "password_reset_tokens" in inspector.get_table_names():
        existing_columns = [col["name"] for col in inspector.get_columns("password_reset_tokens")]
        
        if "tenant_id" not in existing_columns:
            op.add_column('password_reset_tokens', sa.Column('tenant_id', sa.String(length=36), nullable=True))
            op.create_index(op.f('ix_password_reset_tokens_tenant_id'), 'password_reset_tokens', ['tenant_id'], unique=False)
            op.create_foreign_key('fk_password_reset_tokens_tenant_id', 'password_reset_tokens', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
        
        if "method" not in existing_columns:
            op.add_column('password_reset_tokens', sa.Column('method', sa.String(length=16), server_default='email_link', nullable=False))
        
        if "created_ip" not in existing_columns:
            op.add_column('password_reset_tokens', sa.Column('created_ip', sa.String(length=45), nullable=True))
        
        if "user_agent" not in existing_columns:
            op.add_column('password_reset_tokens', sa.Column('user_agent', sa.String(length=512), nullable=True))

    # Add columns to users
    if "users" in inspector.get_table_names():
        existing_columns = [col["name"] for col in inspector.get_columns("users")]
        
        if "require_phone_verification_on_next_login" not in existing_columns:
            op.add_column('users', sa.Column('require_phone_verification_on_next_login', sa.Boolean(), server_default='false', nullable=False))
        
        if "phone_number" not in existing_columns:
            op.add_column('users', sa.Column('phone_number', sa.String(length=32), nullable=True))

    # Create phone_login_verifications table
    if "phone_login_verifications" not in inspector.get_table_names():
        op.create_table(
            'phone_login_verifications',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=False),
            sa.Column('tenant_id', sa.String(length=36), nullable=True),
            sa.Column('code', sa.String(length=6), nullable=False),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('is_used', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('attempt_count', sa.Integer(), server_default='0', nullable=False),
            sa.Column('max_attempts', sa.SmallInteger(), server_default='5', nullable=False),
            sa.Column('last_sent_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_phone_login_verifications_user_id'), 'phone_login_verifications', ['user_id'], unique=False)
        op.create_index(op.f('ix_phone_login_verifications_tenant_id'), 'phone_login_verifications', ['tenant_id'], unique=False)
        op.create_index(op.f('ix_phone_login_verifications_code'), 'phone_login_verifications', ['code'], unique=False)
        op.create_index(op.f('ix_phone_login_verifications_expires_at'), 'phone_login_verifications', ['expires_at'], unique=False)
        op.create_index(op.f('ix_phone_login_verifications_is_used'), 'phone_login_verifications', ['is_used'], unique=False)


def downgrade() -> None:
    # Drop phone_login_verifications table
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    if "phone_login_verifications" in inspector.get_table_names():
        op.drop_index(op.f('ix_phone_login_verifications_is_used'), table_name='phone_login_verifications')
        op.drop_index(op.f('ix_phone_login_verifications_expires_at'), table_name='phone_login_verifications')
        op.drop_index(op.f('ix_phone_login_verifications_code'), table_name='phone_login_verifications')
        op.drop_index(op.f('ix_phone_login_verifications_tenant_id'), table_name='phone_login_verifications')
        op.drop_index(op.f('ix_phone_login_verifications_user_id'), table_name='phone_login_verifications')
        op.drop_table('phone_login_verifications')

    # Remove columns from users
    if "users" in inspector.get_table_names():
        existing_columns = [col["name"] for col in inspector.get_columns("users")]
        if "phone_number" in existing_columns:
            op.drop_column('users', 'phone_number')
        if "require_phone_verification_on_next_login" in existing_columns:
            op.drop_column('users', 'require_phone_verification_on_next_login')

    # Remove columns from password_reset_tokens
    if "password_reset_tokens" in inspector.get_table_names():
        existing_columns = [col["name"] for col in inspector.get_columns("password_reset_tokens")]
        if "tenant_id" in existing_columns:
            op.drop_constraint('fk_password_reset_tokens_tenant_id', 'password_reset_tokens', type_='foreignkey')
            op.drop_index(op.f('ix_password_reset_tokens_tenant_id'), table_name='password_reset_tokens')
            op.drop_column('password_reset_tokens', 'tenant_id')
        if "user_agent" in existing_columns:
            op.drop_column('password_reset_tokens', 'user_agent')
        if "created_ip" in existing_columns:
            op.drop_column('password_reset_tokens', 'created_ip')
        if "method" in existing_columns:
            op.drop_column('password_reset_tokens', 'method')

