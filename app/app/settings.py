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

from django.conf.global_settings import EMAIL_HOST_PASSWORD
from dotenv import load_dotenv
import io
from config import settings
from neomodel import config as neo_cfg

from app.config import settings

load_dotenv()
# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.1/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = settings.SECRET_KEY_django

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = [
    '134.17.17.131',
    'localhost',
    '127.0.0.1',
    'chatbot.digitranslab.com',
    'www.chatbot.digitranslab.com'
]
# Application definition

INSTALLED_APPS = [
    #    'corsheaders',
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
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    #    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'chat_dashboard.middleware.UpdateLastActivityMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOW_ALL_ORIGINS = True

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
        'NAME': settings.DB_NAME,
        'USER': settings.DB_USER,
        'PASSWORD': settings.DB_PASS,
        'HOST': settings.DB_HOST,
        'PORT': settings.DB_PORT
    }
}

neo_cfg.DATABASE_URL = f"bolt://{settings.DB_NEO_USER}:{settings.DB_NEO_PASS}@{settings.DB_NEO_HOST}:{settings.DB_NEO_PORT}"

# Password validation
# https://docs.djangoproject.com/en/5.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
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

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.1/howto/static-files/

STATIC_URL = '/static/'

STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

STATICFILES_DIRS = [
    BASE_DIR / "chat_dashboard" / "static",
    BASE_DIR / "chat_user" / "static",
    #    BASE_DIR / "chat_training" / "static",
    BASE_DIR / "authentication" / "static",
]

# Default primary key field type
# https://docs.djangoproject.com/en/5.1/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'chat_dashboard.User'

import ldap3

LDAP_SERVER = settings.LDAP_SERVER
DOMAIN = settings.DOMAIN
BASE_DN = settings.base_dn

AUTHENTICATION_BACKENDS = (
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


# EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
# EMAIL_HOST = settings.EMAIL_HOST
# EMAIL_PORT = settings.EMAIL_PORT
# EMAIL_HOST_USER = settings.EMAIL_HOST_USER
# EMAIL_HOST_PASSWORD = settings.EMAIL_HOST_PASSWORD
# EMAIL_USE_TLS = False
# EMAIL_USE_SSL = False
# DEFAULT_FROM_EMAIL = settings.DEFAULT_FROM_EMAIL


# settings.py

EMAIL_BACKEND = settings.EMAIL_BACKEND
EMAIL_HOST = settings.EMAIL_HOST
EMAIL_PORT = settings.EMAIL_PORT
EMAIL_USE_TLS = settings.EMAIL_USE_TLS
EMAIL_HOST_USER = settings.EMAIL_HOST_USER  # Замените на ваш адрес Gmail
EMAIL_HOST_PASSWORD = settings.EMAIL_HOST_PASSWORD  # Замените на пароль приложения

import os

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        # Обработчик для логов Django
        'django_file': {
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'django_debug.log'),
            'formatter': 'verbose',
        },
        # Обработчик для логов приложений
        'app_file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'app_logs.log'),
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['django_file'],
            'level': 'DEBUG',
            'propagate': True,
        },
        'chat_user': {
            'handlers': ['app_file'],
            'level': 'INFO',
            'propagate': True,
        },
        'chat_dashboard': {
            'handlers': ['app_file'],
            'level': 'INFO',
            'propagate': True,
        },
        'authentication': {
            'handlers': ['app_file'],
            'level': 'INFO',
            'propagate': True,
        },
        # Логгер для запросов к базе данных
        'django.db.backends': {
            'level': 'DEBUG',
            'handlers': ['django_file'],
            'propagate': False,
        },
        # Логгер для запросов и ответов
        'django.request': {
            'level': 'DEBUG',
            'handlers': ['django_file'],
            'propagate': False,
        },
        # Логгер для работы сервера Django
        'django.server': {
            'level': 'DEBUG',
            'handlers': ['django_file'],
            'propagate': False,
        },
    },
}
