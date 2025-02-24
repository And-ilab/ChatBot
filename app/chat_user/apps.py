from django.apps import AppConfig
from models_ai.model_handler import ModelHandler
from chat_user.questions import questions_list


class ChatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chat_user'

    def ready(self):
        from django.conf import settings

        if not hasattr(settings, 'MODEL_HANDLER'):
            settings.MODEL_HANDLER = ModelHandler(questions_list)