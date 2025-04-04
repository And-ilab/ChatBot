import os
import logging
import datetime
from celery import shared_task
from django.utils.timezone import now
from app.chat_dashboard.models import Settings

# Указываем путь к папке с логами
BASE_DIR = '/home/daniil/PycharmProjects/ChatBot/app/logs'  # Укажите путь к вашему проекту

@shared_task
def delete_old_logs():
    try:
        # Получаем настройку времени хранения логов
        setting = Settings.objects.first()
        if not setting:
            logging.warning("Настройка времени хранения логов не найдена, используем 7 дней по умолчанию.")
            days_to_keep = 7  # Значение по умолчанию
        else:
            days_to_keep = setting.logs_backup

        cutoff_date = now() - datetime.timedelta(minutes=1)

        # Удаляем файлы логов старше cutoff_date
        for file in os.listdir(BASE_DIR):
            file_path = os.path.join(BASE_DIR, file)
            if os.path.isfile(file_path):
                file_mtime = datetime.datetime.fromtimestamp(os.path.getmtime(file_path))
                if file_mtime < cutoff_date:
                    os.remove(file_path)
                    logging.info(f"Удален старый лог-файл: {file}")

    except Exception as e:
        logging.error(f"Ошибка при удалении логов: {e}")
