import os
from dotenv import load_dotenv

# Загружаем переменные окружения из .env файла
load_dotenv()


# Настройки
class Settings:
    DB_HOST = os.getenv("DB_HOST")
    DB_USER = os.getenv("DB_USER")
    DB_PASS = os.getenv("DB_PASS")
    DB_NAME = os.getenv("DB_NAME")
    DB_PORT = int(os.getenv("DB_PORT"))
    SECRET_KEY = os.getenv("SECRET_KEY")
    ALGORITHM = os.getenv("ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
    LDAP_SERVER = os.getenv("LDAP_SERVER")
    DOMAIN = os.getenv("DOMAIN")
    USER_DN = os.getenv("USER_DN")
    base_dn = os.getenv("base_dn")
    SECRET_KEY_django = os.getenv("SECRET_KEY_django")
    EMAIL_HOST = os.getenv("EMAIL_HOST")
    EMAIL_PORT = int(os.getenv("EMAIL_PORT"))
    EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")
    EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")
    DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL")
    EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS")
    EMAIL_BACKEND = os.getenv("EMAIL_BACKEND")
    SITE_URL = os.getenv("SITE_URL")

settings = Settings()
