"""Application configuration powered by environment variables."""

from functools import lru_cache
from typing import List, Optional

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import HttpUrl


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
    auth_cookie_samesite_none: bool = Field(
        default=False,
        validation_alias=AliasChoices("AUTH_COOKIE_SAMESITE_NONE", "KYRADI_AUTH_COOKIE_SAMESITE_NONE"),
        description="Enable SameSite=None for auth cookies in production when cross-site flow requires it.",
    )

    cors_origins: List[str] = Field(
        default_factory=lambda: [
            # Production Vercel
            "https://kyradi-saas-canli.vercel.app",
            "https://kyradi-saas-canli-cqly0ovkl-aparialtechs-projects.vercel.app",
            # Vercel preview deployments (wildcard pattern handled in middleware)
            "https://kyradi-saas-canli-git-main-aparialtechs-projects.vercel.app",
            # Local development
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
        ],
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

    # =========================================================================
    # SuperApp integration (server-to-server)
    # =========================================================================
    superapp_base_url: Optional[HttpUrl] = Field(
        default=None,
        validation_alias=AliasChoices("SUPERAPP_BASE_URL", "KYRADI_SUPERAPP_BASE_URL"),
        description="Base URL of SuperApp for status update callbacks.",
    )
    superapp_integration_secret: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("SUPERAPP_INTEGRATION_SECRET", "KYRADI_SUPERAPP_INTEGRATION_SECRET"),
        description="Shared HMAC secret for SuperApp integration requests.",
    )
    integration_timeout_ms: int = Field(
        default=5000,
        validation_alias=AliasChoices("INTEGRATION_TIMEOUT_MS", "KYRADI_INTEGRATION_TIMEOUT_MS"),
    )
    integration_retry_count: int = Field(
        default=2,
        validation_alias=AliasChoices("INTEGRATION_RETRY_COUNT", "KYRADI_INTEGRATION_RETRY_COUNT"),
    )

    forgot_password_reveal_user_not_found: bool = Field(
        default=True,
        validation_alias=AliasChoices(
            "FORGOT_PASSWORD_REVEAL_USER_NOT_FOUND",
            "KYRADI_FORGOT_PASSWORD_REVEAL_USER_NOT_FOUND",
        ),
        description="Return explicit not-found message for forgot-password requests.",
    )
    forgot_password_rate_limit_count: int = Field(
        default=5,
        validation_alias=AliasChoices(
            "FORGOT_PASSWORD_RATE_LIMIT_COUNT",
            "KYRADI_FORGOT_PASSWORD_RATE_LIMIT_COUNT",
        ),
        description="Max forgot-password requests per user in the rate-limit window.",
    )
    forgot_password_rate_limit_window_minutes: int = Field(
        default=10,
        validation_alias=AliasChoices(
            "FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MINUTES",
            "KYRADI_FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MINUTES",
        ),
    )
    forgot_password_cooldown_seconds: int = Field(
        default=60,
        validation_alias=AliasChoices(
            "FORGOT_PASSWORD_COOLDOWN_SECONDS",
            "KYRADI_FORGOT_PASSWORD_COOLDOWN_SECONDS",
        ),
        description="Cooldown between forgot-password requests for same user.",
    )
    
    # Email service configuration
    email_provider: str = Field(
        default="log",  # Options: resend, sendgrid, mailgun, smtp, log
        validation_alias=AliasChoices("EMAIL_PROVIDER", "KYRADI_EMAIL_PROVIDER"),
    )
    resend_api_key: Optional[str] = Field(
        default=None,
        description="Resend API key for email sending (free: 3000/month)",
        validation_alias=AliasChoices("RESEND_API_KEY", "KYRADI_RESEND_API_KEY"),
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
    password_encryption_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("PASSWORD_ENCRYPTION_KEY", "KYRADI_PASSWORD_ENCRYPTION_KEY"),
        description="Fernet encryption key for password storage (base64 encoded). If not set, a default key will be used (WARNING: Security risk!)",
    )
    kvkk_text: str = Field(
        default=(
            "1. KVKK AÇIK RIZA METNİ (Kişisel Verilerin İşlenmesi Onayı)\n\n"
            "KYRADİ Depolama ve Rezervasyon Yönetim Sistemi (\"KYRADİ\" veya \"Şirket\") tarafından sunulan hizmetlerden yararlanabilmem adına, 6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") kapsamında kişisel verilerimin işlenmesine ilişkin açık rızamı içeren bu metni tarafıma sunulan tüm bilgilendirmeler ışığında okuyup anladığımı beyan ederim.\n\n"
            "1. İşlenen Kişisel Veriler\n\n"
            "KYRADİ sistemi tarafından işlenebilecek kişisel veriler aşağıdaki gibidir:\n\n"
            "• Kimlik bilgileri (ad-soyad, T.C. kimlik numarası — zorunlu değil —, doğum tarihi)\n"
            "• İletişim bilgileri (telefon numarası, e-posta adresi)\n"
            "• Lokasyon bilgileri (depo lokasyonu, teslimat adresi, rezervasyon yapılan konum)\n"
            "• Rezervasyon ve depolama bilgileri (depo numarası, tarih aralıkları, kapasite, fiyat, işlem geçmişi)\n"
            "• Ödeme bilgileri (ödeme tutarı, tahsilat kayıtları; kart bilgileri saklanmaz)\n"
            "• Sistem kullanım bilgileri (IP adresi, log kayıtları, cihaz bilgisi)\n\n"
            "2. İşleme Amaçları\n\n"
            "Kişisel verilerim aşağıdaki amaçlarla işlenecektir:\n\n"
            "• Depolama, rezervasyon ve diğer tüm hizmetlerin sağlanması\n"
            "• Kullanıcı hesabının oluşturulması ve yönetilmesi\n"
            "• Depo teslim/teslim alma süreçlerinin yürütülmesi\n"
            "• Ücretlendirme, faturalandırma ve ödeme takibinin yapılması\n"
            "• KYRADİ müşteri destek hizmetlerinin sunulması\n"
            "• Teknik arızaların çözülmesi ve güvenliğin sağlanması\n"
            "• KVKK, ilgili mevzuat ve resmi kurum taleplerine uyum yükümlülüğü\n\n"
            "3. Verilerin Aktarımı\n\n"
            "Kişisel verilerim; yalnızca hizmetin yerine getirilebilmesi amacıyla:\n\n"
            "• Yetkili kurum ve kuruluşlara (mahkeme, emniyet, vergi dairesi vb.)\n"
            "• İş birliği yapılan depolama işletmelerine / tesislere\n"
            "• Ödeme hizmeti sağlayıcılarına\n"
            "• Yalnızca veri işleyen statüsündeki bulut altyapı sağlayıcılarına\n\n"
            "aktarılabilir.\n\n"
            "4. Saklama Süresi\n\n"
            "Kişisel verilerim:\n\n"
            "• Sözleşme süresince,\n"
            "• Sözleşme sona erdikten sonra ilgili mevzuatta öngörülen zorunlu süre kadar\n\n"
            "saklanacaktır.\n\n"
            "5. Açık Rıza\n\n"
            "Yukarıdaki kapsamda kişisel verilerimin işlenmesine ve aktarılmasına açık rıza verdiğimi, kendi özgür irademle onayladığımı kabul ederim."
        ),
        validation_alias=AliasChoices("KVKK_TEXT", "KYRADI_KVKK_TEXT"),
        description="KVKK açık rıza metni.",
    )
    aydinlatma_text: str = Field(
        default=(
            "AYDINLATMA METNİ (KVKK Uyumlu)\n\n"
            "Veri Sorumlusu: KYRADİ Depolama ve Rezervasyon Yönetim Sistemi\n"
            "Kapsam: KVKK madde 10 uyarınca kullanıcıların bilgilendirilmesi\n\n"
            "1. Kişisel Verilerin Toplanma Yöntemi\n\n"
            "Kişisel verileriniz;\n\n"
            "• KYRADİ web paneli,\n"
            "• Online rezervasyon formu,\n"
            "• Mobil arayüzler,\n"
            "• Müşteri destek talepleri,\n"
            "• Otomatik log kayıtları\n\n"
            "üzerinden elektronik ortamda toplanmaktadır.\n\n"
            "2. Kişisel Verilerin İşlenme Amaçları\n\n"
            "Verileriniz aşağıdaki amaçlarla işlenir:\n\n"
            "• Depo rezervasyon süreçlerinin yürütülmesi\n"
            "• Kullanıcı yönetimi, kimlik doğrulama ve hesap güvenliği\n"
            "• Ödeme işlemleri ve faturalandırma\n"
            "• Müşteri iletişimi ve destek süreçleri\n"
            "• Depo işletmelerine aktarılması gereken operasyonel bilgiler\n"
            "• Platform güvenliği ve log yönetimi\n"
            "• Yasal yükümlülüklerin yerine getirilmesi\n\n"
            "3. İşlenen Veri Kategorileri\n\n"
            "• Kimlik bilgileri\n"
            "• İletişim bilgileri\n"
            "• Rezervasyon ve depolama bilgileri\n"
            "• Ödeme bilgileri\n"
            "• Lokasyon bilgileri\n"
            "• İşlem güvenliği verileri (IP, cihaz bilgileri, erişim logları)\n\n"
            "4. Kişisel Verilerin Aktarılması\n\n"
            "Kişisel verileriniz:\n\n"
            "• Depo işletmeleri,\n"
            "• Ödeme kuruluşları,\n"
            "• Yetkili kamu kurumları (yasal zorunluluk halinde),\n"
            "• Danışmanlık ve altyapı hizmeti sağlayıcıları\n\n"
            "ile paylaşılabilir.\n\n"
            "5. Veri Saklama Süreleri\n\n"
            "Verileriniz, ilgili mevzuatın gerektirdiği süre boyunca saklanır.\n"
            "Süre bitiminde güvenli şekilde imha edilir.\n\n"
            "6. KVKK Kapsamındaki Haklarınız\n\n"
            "KVKK madde 11 gereğince aşağıdaki haklara sahipsiniz:\n\n"
            "• Kişisel verilerinizin işlenip işlenmediğini öğrenme\n"
            "• İşlenmişse bilgi talep etme\n"
            "• Amacına uygun kullanılıp kullanılmadığını öğrenme\n"
            "• Yurt içi/yurt dışı üçüncü kişilere aktarıldığını öğrenme\n"
            "• Eksik veya yanlış işlenmişse düzeltilmesini talep etme\n"
            "• Silinmesini veya yok edilmesini talep etme\n"
            "• İşleme faaliyetinin sınırlandırılmasını isteme\n"
            "• Verilerin kanuna aykırı işlendiğini düşünüyorsanız şikâyet hakkı\n\n"
            "Başvurularınızı KYRADİ iletişim kanalları üzerinden iletebilirsiniz."
        ),
        validation_alias=AliasChoices("AYDINLATMA_TEXT", "KYRADI_AYDINLATMA_TEXT"),
        description="Aydınlatma metni (KVKK uyumlu).",
    )
    terms_text: str = Field(
        default=(
            "DEPO KULLANIM ŞARTLARI VE HİZMET SÖZLEŞMESİ\n\n"
            "Bu sözleşme, KYRADİ Depolama ve Rezervasyon Yönetim Sistemi (\"Platform\") aracılığıyla depo alanı kiralama ve rezervasyon işlemleri yapan kullanıcılar (\"Kullanıcı\") ile platformu işleten KYRADİ arasında akdedilmiştir.\n\n"
            "1. Taraflar\n\n"
            "• Hizmet Sağlayıcı: KYRADİ Depolama ve Rezervasyon Yönetim Sistemi\n"
            "• Kullanıcı: Platform üzerinden rezervasyon yapan gerçek veya tüzel kişi\n\n"
            "2. Konu\n\n"
            "Bu sözleşme; kullanıcı tarafından platform üzerinden yapılan depo rezervasyonu, depo kullanım şartları, ücretlendirme, iptal koşulları ve tarafların hak ve yükümlülüklerinin düzenlenmesini kapsar.\n\n"
            "3. Hizmet Kapsamı\n\n"
            "• Kullanıcı, platform üzerinde görüntülenen depolama alanlarından uygun olanı seçerek rezervasyon oluşturabilir.\n"
            "• KYRADİ yalnızca aracı dijital platform görevi görür; depo işletmesinin fiziksel sorumlulukları işletmeye aittir.\n"
            "• Depo erişimi, kullanım süresi, güvenlik hizmetleri ve teslim şartları depo işletmesi tarafından sağlanır.\n\n"
            "4. Kullanıcının Yükümlülükleri\n\n"
            "Kullanıcı:\n\n"
            "• Depo alanını yasa dışı işlerde kullanamaz.\n"
            "• Yanıcı, patlayıcı, tehlikeli, çalınmış veya yasaklı maddeler depolayamaz.\n"
            "• Depo alanını üçüncü kişilere devredemez.\n"
            "• Depo işletmesi ve KYRADİ tarafından belirlenen tüm kurallara uymayı kabul eder.\n"
            "• Depo kullanım süresi bittiğinde alanı boş ve temiz şekilde teslim eder.\n\n"
            "5. Ücretlendirme ve Ödeme\n\n"
            "• Rezervasyon ücreti, platform üzerinde belirtilen tarifelere göre hesaplanır.\n"
            "• Ek hizmetler (taşıma, paketleme vb.) ayrıca fiyatlandırılır.\n"
            "• Ödeme yapılmaması durumunda rezervasyon geçerliliğini yitirir.\n"
            "• Ödemeler KYRADİ üzerinden veya anlaşmalı ödeme altyapılarıyla yapılabilir.\n\n"
            "6. İptal ve İade Koşulları\n\n"
            "• Kullanıcı, kullanmadığı rezervasyonlar için iptal talebinde bulunabilir.\n"
            "• İptal koşulları her depo işletmesine göre değişebilir; kullanıcı rezervasyon öncesinde ilgili koşulları okuduğunu kabul eder.\n"
            "• Hizmet başladıktan sonra ücret iadesi yapılamayabilir.\n\n"
            "7. Sorumluluk Reddi\n\n"
            "• KYRADİ, fiziksel depoda oluşabilecek hırsızlık, hasar, yangın vb. olaylardan doğrudan sorumlu değildir.\n"
            "• Fiziksel güvenlik ve sigorta işlemleri depo işletmesinin sorumluluğundadır.\n"
            "• Platform teknik nedenlerle geçici olarak erişilemez hale gelebilir; KYRADİ bu durumlar için tazminat yükümlülüğü taşımaz.\n\n"
            "8. Fesih\n\n"
            "• Kullanıcı, hesabını istediği zaman kapatabilir.\n"
            "• KYRADİ, kullanım şartlarına aykırılık durumunda hizmeti durdurma hakkına sahiptir.\n\n"
            "9. Uygulanacak Hukuk\n\n"
            "Bu sözleşme Türkiye Cumhuriyeti yasalarına tabidir; uyuşmazlıklarda İstanbul Mahkemeleri yetkilidir.\n\n"
            "Kullanıcı, tüm depo kullanım şartlarını okuduğunu, anladığını ve kabul ettiğini beyan eder."
        ),
        validation_alias=AliasChoices("TERMS_TEXT", "KYRADI_TERMS_TEXT"),
        description="Depo kullanım şartları metni.",
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
