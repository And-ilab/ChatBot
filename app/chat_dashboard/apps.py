from django.apps import AppConfig
import scheduler

class ChatAdministrationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chat_dashboard'

    def ready(self):
        scheduler.start_scheduler()


#