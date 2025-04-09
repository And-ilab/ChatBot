from django.apps import AppConfig
from django.conf import settings
from models_ai.model_handler import ModelHandler, QuestionMatcher
# , NeuralModel)
from chat_user.questions_new import questions_list
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
from huggingface_hub import snapshot_download

import re
from pymorphy3 import MorphAnalyzer
import spacy

# nlp = spacy.load("ru_core_news_sm")
# morph = MorphAnalyzer()
# custom_stop_words = {"может", "могут", "какой", "какая", "какое", "какие", "что", "кто", "где", "когда", "зачем",
#                      "почему"}
#
#
# def extract_keywords(question):
#     keywords = set()
#     hyphenated_words = re.findall(r'\b\w+-\w+\b', question.lower())
#     keywords.update(hyphenated_words)
#
#     question_cleaned = re.sub(r'\b\w+-\w+\b', '', question)
#     doc = nlp(question_cleaned)
#
#     for token in doc:
#         text_lower = token.text.lower()
#
#         if token.is_stop or text_lower in custom_stop_words or len(text_lower) < 2:
#             continue
#
#         if token.pos_ == "VERB":
#             keywords.add(token.lemma_.lower())
#         elif token.pos_ == "ADJ":
#             adj = morph.parse(token.text)[0]
#             adj_feminine = adj.inflect({"femn", "sing", "nomn"})
#             keywords.add(adj_feminine.word.lower() if adj_feminine else token.lemma_.lower())
#         else:
#             keywords.add(token.lemma_.lower())
#
#     return sorted(keywords)


class ChatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chat_user'

    # def ready(self):
    #     if not hasattr(settings, 'QUESTION_MATCHER'):
    #         model_handler = ModelHandler(questions_list)
    #         settings.QUESTION_MATCHER = QuestionMatcher(questions_list, model_handler, extract_keywords)