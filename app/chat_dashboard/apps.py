from django.apps import AppConfig
# from scheduler_new import start_scheduler

class ChatAdministrationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chat_dashboard'

    # def ready(self):
    #     start_scheduler()
