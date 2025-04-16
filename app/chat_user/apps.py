from django.apps import AppConfig
from django.conf import settings
from models_ai.model_handler import ModelHandler, QuestionMatcher
# from chat_user.questions_new import questions_list
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
from huggingface_hub import snapshot_download


class ChatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chat_user'

    # def ready(self):
    #     if not hasattr(settings, 'QUESTION_MATCHER'):
            # model_handler = ModelHandler(questions_list)
            # settings.QUESTION_MATCHER = QuestionMatcher(questions_list, model_handler)