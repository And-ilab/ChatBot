from django.apps import AppConfig
from django.conf import settings
from models_ai.model_handler import ModelHandler, QuestionMatcher
import torch
import json
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
from huggingface_hub import snapshot_download
from collections import defaultdict


# def load_categories_as_sets(file_path):
#     with open(file_path, 'r', encoding='utf-8') as f:
#         data = json.load(f)
#     result = defaultdict(dict)
#     for category_str, questions in data.items():
#         category_words = [word.strip().lower() for word in category_str.split(', ')]
#         category_set = frozenset(category_words)
#         result[category_set] = questions
#     return result
#
#
# class ChatConfig(AppConfig):
#     default_auto_field = 'django.db.models.BigAutoField'
#     name = 'chat_user'
#
#     def ready(self):
#         if not hasattr(settings, 'QUESTION_MATCHER'):
#             questions_list = load_categories_as_sets('chat_user/questions.json')
#             model_handler = ModelHandler(questions_list)
#             settings.QUESTION_MATCHER = QuestionMatcher(questions_list, model_handler)