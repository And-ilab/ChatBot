from django.apps import AppConfig
from django.conf import settings
#from models_ai.model_handler import ModelHandler, NeuralHandler
from chat_user.questions import questions_list
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
from huggingface_hub import snapshot_download


class ChatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chat_user'

    # def ready(self):
    #     if not hasattr(settings, 'MODEL_HANDLER'):
    #         settings.MODEL_HANDLER = ModelHandler(questions_list)
    #
    #     if not hasattr(settings, 'NEURAL_HANDLER'):
    #         settings.NEURAL_HANDLER = NeuralHandler()