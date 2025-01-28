# scheduler.py
from apscheduler.schedulers.background import BackgroundScheduler
import os
import time


BASE_DIR = '/home/daniil/PycharmProjects/ChatBot/app'  # Укажите путь к вашему проекту

def cleanup_old_logs():
    from chat_dashboard.models import Settings
    logs_dir = os.path.join(BASE_DIR, 'logs')
    now = time.time()
    settings = Settings.objects.first()
    days_backup = settings.logs_backup


    cutoff_time = now - (days_backup * 86400)  # 30 дней в секундах

    for filename in os.listdir(logs_dir):
        file_path = os.path.join(logs_dir, filename)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            file_mtime = os.path.getmtime(file_path)
            if file_mtime < cutoff_time:
                try:
                    os.remove(file_path)
                    print(f"Удалён файл: {file_path}")
                except FileNotFoundError:
                    print(f"Файл уже удалён: {file_path}")
                except Exception as e:
                    print(f"Ошибка при удалении файла {file_path}: {e}")
        else:
            print(f"Файл не найден или это не файл: {file_path}")


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(cleanup_old_logs, 'cron', hour=0, minute=0)  # Каждый день в полночь
    scheduler.start()