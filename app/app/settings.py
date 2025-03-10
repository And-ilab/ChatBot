
"""
Django settings for app project.

Generated by 'django-admin startproject' using Django 5.1.2.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/5.1/ref/settings/
"""
import os
from pathlib import Path
from dotenv import load_dotenv
#from .logging_handlers import CustomTimedRotatingFileHandler
from config import config_settings


from log.logging_config import LOGGING
load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.1/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config_settings.SECRET_KEY_django

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

SESSION_DURATION_MINUTES = 30

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

ALLOWED_HOSTS = [
    '134.17.17.131',
    'localhost',
    'sca-hrhelpbot.bb.asb',
    '127.0.0.1',
    '10.200.123.48',
    '172.17.0.1',
    'chatbot.digitranslab.com',
    'www.chatbot.digitranslab.com'
]

# Application definition
INSTALLED_APPS = [
    'corsheaders',
    'authentication',
    'app',
    'chat_user',
    'chat_dashboard',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework'
]

MIDDLEWARE = [
#    'django.contrib.auth.middleware.AuthenticationMiddleware',
#    'django.contrib.auth.middleware.RemoteUserMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.auth.middleware.RemoteUserMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

#AUTH_REMOTE_USER_AUTO_CREATE = True

# CORS_ALLOWED_ORIGINS = [
#     "http://localhost:5000",
#     "https:/www.digitranslab.com"
# ]
# #CORS_ALLOW_ALL_ORIGINS = True
# CORS_ALLOW_CREDENTIALS = True
#
# CSRF_TRUSTED_ORIGINS = [
#     "https:/www.digitranslab.com",
#     "http://localhost:5000",
# ]
#
# CSRF_COOKIE_SAMESITE = 'None'
# CSRF_COOKIE_SECURE = True  # Только для HTTPS!
# SESSION_COOKIE_SECURE = True  # Только для HTTPS!

ROOT_URLCONF = 'app.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / "templates"],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'app.wsgi.application'

# Database
# https://docs.djangoproject.com/en/5.1/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql_psycopg2',
        'NAME': config_settings.DB_NAME,
        'USER': config_settings.DB_USER,
        'PASSWORD': config_settings.DB_PASS,
        'HOST': config_settings.DB_HOST,
        'PORT': config_settings.DB_PORT
    }
}

# Password validation
# https://docs.djangoproject.com/en/5.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
# https://docs.djangoproject.com/en/5.1/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Europe/Minsk'

USE_I18N = True

USE_TZ = True

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.1/howto/static-files/

STATIC_URL = '/static/'

STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

STATICFILES_DIRS = [
    BASE_DIR / "chat_dashboard" / "static",
    BASE_DIR / "chat_user" / "static",
    BASE_DIR / "authentication" / "static"
]

# Default primary key field type
# https://docs.djangoproject.com/en/5.1/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'chat_dashboard.User'

LDAP_SERVER = config_settings.LDAP_SERVER
DOMAIN = config_settings.DOMAIN
BASE_DN = config_settings.base_dn


AUTHENTICATION_BACKENDS = (
    'django.contrib.auth.backends.RemoteUserBackend',
    'authentication.backends.CustomAuthBackend',
    'django.contrib.auth.backends.ModelBackend',
)


def authenticate(username, password):
    from ldap3 import Server, Connection, ALL

    user_dn = f"{username}@{DOMAIN.lower()}"
    server = Server(LDAP_SERVER, get_info=ALL)

    try:
        conn = Connection(server, user=user_dn, password=password)
        if conn.bind():
            return True
        else:
            return False
    except Exception as e:
        print(f"Ошибка аутентификации: {e}")
        return False


EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = config_settings.EMAIL_HOST
EMAIL_PORT = config_settings.EMAIL_PORT
EMAIL_USE_TLS = True
EMAIL_HOST_USER = config_settings.EMAIL_HOST_USER
EMAIL_HOST_PASSWORD = config_settings.EMAIL_HOST_PASSWORD
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER

SITE_URL = 'http://localhost:8000'
#X_FRAME_OPTIONS = 'https:/www.digitranslab.com'
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True
