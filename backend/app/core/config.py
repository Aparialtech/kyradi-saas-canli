"""Application configuration powered by environment variables."""

from functools import lru_cache
from typing import List, Optional

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration values."""

    environment: str = Field(
        default="local",
        validation_alias=AliasChoices("ENV", "KYRADI_ENVIRONMENT"),
    )

    # Primary DSN or components
    database_url: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("DATABASE_URL", "KYRADI_DATABASE_URL"),
        description="Full async SQLAlchemy DSN (e.g. postgresql+asyncpg://user:pass@host:port/db)",
    )
    db_host: str = Field(
        default="localhost",
        validation_alias=AliasChoices("DB_HOST", "KYRADI_DB_HOST"),
    )
    db_port: int = Field(
        default=5432,
        validation_alias=AliasChoices("DB_PORT", "KYRADI_DB_PORT"),
    )
    db_name: str = Field(
        default="kyradi",
        validation_alias=AliasChoices("DB_NAME", "KYRADI_DB_NAME"),
    )
    db_user: str = Field(
        default="postgres",
        validation_alias=AliasChoices("DB_USER", "KYRADI_DB_USER"),
    )
    db_pass: str = Field(
        default="postgres",
        validation_alias=AliasChoices("DB_PASS", "KYRADI_DB_PASS"),
    )

    jwt_secret_key: str = Field(
        default="change_me",
        validation_alias=AliasChoices("JWT_SECRET", "KYRADI_JWT_SECRET_KEY"),
    )
    jwt_public_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("JWT_PUBLIC_KEY", "KYRADI_JWT_PUBLIC_KEY"),
    )
    jwt_algorithm: str = Field(
        default="HS256",
        validation_alias=AliasChoices("JWT_ALGORITHM", "KYRADI_JWT_ALGORITHM"),
    )
    access_token_expire_minutes: int = Field(
        default=60,
        validation_alias=AliasChoices("JWT_EXPIRES_MIN", "KYRADI_ACCESS_TOKEN_EXPIRE_MINUTES"),
    )

    cors_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost:5173"],
        validation_alias=AliasChoices("CORS_ORIGINS", "KYRADI_CORS_ORIGINS"),
    )
    ai_allowed_origins: List[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("ALLOWED_ORIGINS", "AI_ALLOWED_ORIGINS"),
    )
    enable_internal_reservations: bool = Field(
        default=True,
        validation_alias=AliasChoices("ENABLE_INTERNAL_RESERVATIONS", "KYRADI_ENABLE_INTERNAL_RESERVATIONS"),
    )
    demo_mode: bool = Field(
        default=False,
        validation_alias=AliasChoices("DEMO_MODE", "KYRADI_DEMO_MODE"),
        description="When enabled, tenant creation is disabled in admin panel",
    )
    public_cdn_base: str = Field(
        default="https://cdn.localhost",
        validation_alias=AliasChoices("PUBLIC_CDN_BASE", "KYRADI_PUBLIC_CDN_BASE"),
    )
    frontend_url: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("FRONTEND_URL", "KYRADI_FRONTEND_URL"),
        description="Frontend application URL for email links (e.g., http://localhost:5173)",
    )
    rate_limit_public_per_min: int = Field(
        default=20,
        validation_alias=AliasChoices("RATE_LIMIT_PUBLIC_PER_MIN", "KYRADI_RATE_LIMIT_PUBLIC_PER_MIN"),
    )
    jwt_widget_issuer: str = Field(
        default="kyradi-widget",
        validation_alias=AliasChoices("JWT_WIDGET_ISSUER", "KYRADI_JWT_WIDGET_ISSUER"),
    )
    jwt_widget_expire_min: int = Field(
        default=10,
        validation_alias=AliasChoices("JWT_WIDGET_EXPIRE_MIN", "KYRADI_JWT_WIDGET_EXPIRE_MIN"),
    )
    widget_hcaptcha_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices("WIDGET_HCAPTCHA_ENABLED", "KYRADI_WIDGET_HCAPTCHA_ENABLED"),
    )
    hcaptcha_secret: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("HCAPTCHA_SECRET", "KYRADI_HCAPTCHA_SECRET"),
    )
    webhook_signature_secret: str = Field(
        default="change_me",
        validation_alias=AliasChoices("WEBHOOK_SIGNATURE_SECRET", "KYRADI_WEBHOOK_SIGNATURE_SECRET"),
    )

    ai_provider: str = Field(
        default="openai",
        validation_alias=AliasChoices("PROVIDER", "AI_PROVIDER"),
    )
    ai_model: str = Field(
        default="gpt-4o-mini",
        validation_alias=AliasChoices("MODEL", "AI_MODEL", "OPENAI_MODEL_NAME"),
    )
    openai_api_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("OPENAI_API_KEY", "KYRADI_OPENAI_API_KEY"),
        description="OpenAI API key. Required for AI chat functionality. Can be rotated via Railway/Vercel env panel.",
    )
    openai_org_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("OPENAI_ORG_ID", "KYRADI_OPENAI_ORG_ID"),
        description="OpenAI organization ID (optional). Used for multi-org accounts.",
    )
    anthropic_api_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("ANTHROPIC_API_KEY", "KYRADI_ANTHROPIC_API_KEY"),
    )
    ollama_base_url: str = Field(
        default="http://localhost:11434",
        validation_alias=AliasChoices("OLLAMA_BASE_URL", "KYRADI_OLLAMA_BASE_URL"),
    )
    embedding_model: str = Field(
        default="text-embedding-3-large",
        validation_alias=AliasChoices("EMBEDDING_MODEL", "AI_EMBEDDING_MODEL"),
    )
    embedding_provider: str = Field(
        default="openai",
        validation_alias=AliasChoices("EMBEDDING_PROVIDER", "AI_EMBEDDING_PROVIDER"),
    )
    rate_limit_per_min: int = Field(
        default=30,
        validation_alias=AliasChoices("RATE_LIMIT_PER_MIN", "AI_RATE_LIMIT_PER_MIN"),
    )
    payments_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices("PAYMENTS_ENABLED", "KYRADI_PAYMENTS_ENABLED"),
    )
    stripe_api_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("STRIPE_API_KEY", "KYRADI_STRIPE_API_KEY"),
    )
    iyzico_api_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("IYZICO_API_KEY", "KYRADI_IYZICO_API_KEY"),
    )
    payment_webhook_secret: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("PAYMENT_WEBHOOK_SECRET", "KYRADI_PAYMENT_WEBHOOK_SECRET"),
    )
    
    # Email service configuration
    email_provider: str = Field(
        default="log",  # Default to log mode for development
        validation_alias=AliasChoices("EMAIL_PROVIDER", "KYRADI_EMAIL_PROVIDER"),
    )
    sendgrid_api_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("SENDGRID_API_KEY", "KYRADI_SENDGRID_API_KEY"),
    )
    mailgun_api_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("MAILGUN_API_KEY", "KYRADI_MAILGUN_API_KEY"),
    )
    mailgun_domain: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("MAILGUN_DOMAIN", "KYRADI_MAILGUN_DOMAIN"),
    )
    smtp_host: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("SMTP_HOST", "KYRADI_SMTP_HOST"),
    )
    smtp_port: int = Field(
        default=587,
        validation_alias=AliasChoices("SMTP_PORT", "KYRADI_SMTP_PORT"),
    )
    smtp_user: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("SMTP_USER", "KYRADI_SMTP_USER"),
    )
    smtp_password: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("SMTP_PASSWORD", "KYRADI_SMTP_PASSWORD"),
    )
    smtp_from_email: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("SMTP_FROM_EMAIL", "KYRADI_SMTP_FROM_EMAIL"),
    )
    kvkk_text: str = Field(
        default=(
            "Rezervasyon veya kasa işlemleri sırasında KVKK aydınlatma metnini onaylamış olursunuz."
        ),
        validation_alias=AliasChoices("KVKK_TEXT", "KYRADI_KVKK_TEXT"),
        description="KVKK ve aydınlatma metni (örnek).",
    )
    aydinlatma_text: str = Field(
        default=(
            "Bu platform kişisel verilerin işlenmesine ilişkin aydınlatma metni içerir."
        ),
        validation_alias=AliasChoices("AYDINLATMA_TEXT", "KYRADI_AYDINLATMA_TEXT"),
        description="Aydınlatma metni (örnek).",
    )
    
    # SMS service configuration
    sms_provider: str = Field(
        default="mock",
        validation_alias=AliasChoices("SMS_PROVIDER", "KYRADI_SMS_PROVIDER"),
    )
    iletimerkezi_username: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("ILETIMERKEZI_USERNAME", "KYRADI_ILETIMERKEZI_USERNAME"),
    )
    iletimerkezi_password: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("ILETIMERKEZI_PASSWORD", "KYRADI_ILETIMERKEZI_PASSWORD"),
    )
    twilio_account_sid: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("TWILIO_ACCOUNT_SID", "KYRADI_TWILIO_ACCOUNT_SID"),
    )
    twilio_auth_token: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("TWILIO_AUTH_TOKEN", "KYRADI_TWILIO_AUTH_TOKEN"),
    )
    twilio_from_number: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("TWILIO_FROM_NUMBER", "KYRADI_TWILIO_FROM_NUMBER"),
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    def resolve_database_url(self) -> str:
        """Return the effective database URL, building from parts when needed."""
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_pass}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    """Return a cached settings instance."""
    settings = Settings()
    # ensure database_url is always populated for downstream usage
    if settings.database_url is None:
        settings.database_url = settings.resolve_database_url()
    return settings


settings = get_settings()
