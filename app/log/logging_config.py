# app/logging_config.py
import os
import logging
from logging.handlers import TimedRotatingFileHandler
from datetime import datetime
#from chat_dashboard.models import Settings
import time


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # Корневая директория проекта
def get_file_handler(log_name, level, formatter):
    """
    Создаёт и возвращает файловый обработчик для логов.
    """
    now = datetime.now().strftime('%Y-%m-%d')
    # Путь к папке logs в корне проекта
    logs_dir = os.path.join(BASE_DIR, 'logs')
    os.makedirs(logs_dir, exist_ok=True)  # Создаём папку, если её нет
    # Полный путь к лог-файлу
    log_file = os.path.join(logs_dir, f'{log_name}_{now}.log')

    # Создаём обработчик
    handler = TimedRotatingFileHandler(
        filename=log_file,
        when='midnight',  # Ротация каждый день в полночь
        interval=1,
        backupCount=30  # Хранить логи за последние 30 дней (или settings.logs_backup, если настроено)
    )
    handler.setLevel(level)
    handler.setFormatter(formatter)
    return handler


# Конфигурация логирования
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
        'user_action': {
            'format': '{levelname} {asctime} {user_id} {user_name} {action_type} {time} {module} {details}',
            'style': '{',
        },
    },
    'handlers': {
        'django_file': {
            '()': lambda: get_file_handler('django', logging.DEBUG,
                                           logging.Formatter('{levelname} {asctime} {module} {message}', style='{')),
        },
        'chat_user': {
            '()': lambda: get_file_handler('chat_user', logging.INFO,
                                           logging.Formatter('{levelname} {asctime} {module} {message}', style='{')),
        },
        'chat_dashboard': {
            '()': lambda: get_file_handler('chat_dashboard', logging.INFO,
                                           logging.Formatter('{levelname} {asctime} {module} {message}', style='{')),
        },
        'authentication': {
            '()': lambda: get_file_handler('authentication', logging.INFO,
                                           logging.Formatter('{levelname} {asctime} {module} {message}', style='{')),
        },
        'chat_dashboard_error': {
            '()': lambda: get_file_handler('chat_dashboard_error', logging.ERROR,
                                           logging.Formatter('{levelname} {asctime} {module} {message}', style='{')),
        },
        'chat_user_error': {
            '()': lambda: get_file_handler('chat_user_error', logging.ERROR,
                                           logging.Formatter('{levelname} {asctime} {module} {message}', style='{')),
        },
        'authentication_error': {
            '()': lambda: get_file_handler('authentication_error', logging.ERROR,
                                           logging.Formatter('{levelname} {asctime} {module} {message}', style='{')),
        },
        'user_actions': {
            '()': lambda: get_file_handler('user_actions', logging.INFO,
                                           logging.Formatter(
                                               '{levelname} {asctime} {module} {user_id} {user_name} {action_type} {time} {details}',
                                               style='{'
                                           )),
        },
    },
    'loggers': {
        'django': {
            'handlers': ['django_file'],
            'level': 'DEBUG',
            'propagate': True,
        },
        'chat_user': {
            'handlers': ['chat_user'],
            'level': 'INFO',
            'propagate': False,
        },
        'chat_dashboard': {
            'handlers': ['chat_dashboard'],
            'level': 'INFO',
            'propagate': False,
        },
        'authentication': {
            'handlers': ['authentication'],
            'level': 'INFO',
            'propagate': False,
        },
        'chat_user_error': {
            'handlers': ['chat_user_error'],
            'level': 'ERROR',
            'propagate': False,
        },
        'chat_dashboard_error': {
            'handlers': ['chat_dashboard_error'],
            'level': 'ERROR',
            'propagate': False,
        },
        'authentication_error': {
            'handlers': ['authentication_error'],
            'level': 'ERROR',
            'propagate': False,
        },
        'django.db.backends': {
            'level': 'DEBUG',
            'handlers': ['django_file'],
            'propagate': False,
        },
        'django.request': {
            'level': 'DEBUG',
            'handlers': ['django_file'],
            'propagate': False,
        },
        'django.server': {
            'level': 'DEBUG',
            'handlers': ['django_file'],
            'propagate': False,
        },
        'user_actions': {
            'handlers': ['user_actions'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

