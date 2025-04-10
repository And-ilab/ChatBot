import os
import torch
import string
import nltk
import logging
import requests
from collections import defaultdict
from nltk.stem import WordNetLemmatizer
from sklearn.metrics.pairwise import cosine_similarity
from concurrent.futures import ThreadPoolExecutor
from transformers import BertTokenizer, BertModel
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline, GenerationConfig
from huggingface_hub import snapshot_download
from peft import PeftModel, PeftConfig
import re
from pymorphy3 import MorphAnalyzer
import spacy

nltk.download('punkt_tab')
nltk.download('punkt')
nltk.download('wordnet')
nltk.download('omw-1.4')

lemmatizer = WordNetLemmatizer()

logger = logging.getLogger('chat_user')

model_path = "models_ai/rubert_model"
tokenizer_path = "models_ai/rubert_tokenizer"

nlp = spacy.load("ru_core_news_sm")
morph = MorphAnalyzer()
custom_stop_words = {"может", "могут", "какой", "какая", "какое", "какие", "что", "кто", "где", "когда", "зачем",
                     "почему"}


def correct_with_yandex(text):
    try:
        url = "https://speller.yandex.net/services/spellservice.json/checkText"
        params = {"text": text, "lang": "ru"}
        response = requests.get(url, params=params)
        response.raise_for_status()
        errors = response.json()

        corrected_text = text
        for error in reversed(errors):
            if error.get("s"):
                corrected_text = corrected_text[:error["pos"]] + error["s"][0] + corrected_text[
                                                                                 error["pos"] + error["len"]:]
        return corrected_text
    except requests.exceptions.RequestException as e:
        logging.warning(f"Ошибка при обращении к Яндекс.Спеллеру: {e}")
        return text
    except Exception as e:
        logging.warning(f"Неожиданная ошибка при исправлении орфографии: {e}")
        return text


def extract_keywords(question):
    keywords = set()
    hyphenated_words = re.findall(r'\b\w+-\w+\b', question.lower())
    keywords.update(hyphenated_words)

    question_cleaned = re.sub(r'\b\w+-\w+\b', '', question)
    doc = nlp(question_cleaned)

    for token in doc:
        text_lower = token.text.lower()

        if token.is_stop or text_lower in custom_stop_words or len(text_lower) < 2:
            continue

        if token.pos_ == "VERB":
            keywords.add(token.lemma_.lower())
        elif token.pos_ == "ADJ":
            adj = morph.parse(token.text)[0]
            adj_feminine = adj.inflect({"femn", "sing", "nomn"})
            keywords.add(adj_feminine.word.lower() if adj_feminine else token.lemma_.lower())
        else:
            keywords.add(token.lemma_.lower())

    return sorted(keywords)


class ModelHandler:
    def __init__(self, questions_list):
        self.questions_list = questions_list
        self.tokenizer = BertTokenizer.from_pretrained('DeepPavlov/rubert-base-cased')
        self.model = BertModel.from_pretrained('DeepPavlov/rubert-base-cased')
        self.embeddings_cache = self._precompute_embeddings()

    def preprocess(self, text):
        if isinstance(text, tuple):
            text = " ".join(text)
        text = text.lower()
        text = text.translate(str.maketrans('', '', string.punctuation))
        tokens = nltk.word_tokenize(text)
        lemmatized = [lemmatizer.lemmatize(token) for token in tokens]
        return " ".join(lemmatized)

    def get_embedding(self, text):
        text = self.preprocess(text)
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=64)
        with torch.no_grad():
            outputs = self.model(**inputs)
        return outputs.last_hidden_state.mean(dim=1).numpy()

    def _precompute_embeddings(self):
        embeddings_cache = {}
        for group_keys, questions_dict in self.questions_list.items():
            key_processed = self.preprocess(group_keys)

            all_questions = []
            for main_question, similar_questions in questions_dict.items():
                all_questions.append(main_question)
                all_questions.extend(similar_questions)

            questions_processed = [self.preprocess(q) for q in all_questions]
            all_texts = [key_processed] + questions_processed

            with ThreadPoolExecutor() as executor:
                embeddings = list(executor.map(self.get_embedding, all_texts))

            embeddings_cache[group_keys] = embeddings

        return embeddings_cache


class QuestionMatcher:
    def __init__(self, questions_list, model_handler):
        self.questions_list = questions_list
        self.model_handler = model_handler

    def find_best_match(self, user_keywords):
        matches_count = []
        user_keywords_set = set(user_keywords)

        for category_keywords in self.questions_list.keys():
            matches = len(user_keywords_set & set(category_keywords))
            matches_count.append((matches, category_keywords))

        if not matches_count:
            return None

        max_matches = max(matches_count, key=lambda x: x[0])[0]

        if max_matches == 0:
            return None

        best_categories = [category for matches, category in matches_count if matches == max_matches]

        if len(best_categories) > 0:
            return best_categories
        return None


    def match_question(self, user_message):
        corrected_message = correct_with_yandex(user_message)
        if corrected_message != user_message:
            logging.info(f"Исправленный запрос: {corrected_message} (оригинал: {user_message})")
            user_message = corrected_message

        user_keywords = extract_keywords(user_message)

        if not user_keywords:
            return None

        best_groups = self.find_best_match(user_keywords)

        if not best_groups:
            return None

        questions_dict = {}

        if len(best_groups) == 1:
            questions_dict = self.questions_list[best_groups[0]]
        else:
            for group in best_groups:
                questions_dict.update(self.questions_list[group])

        all_questions = []
        question_mapping = {}

        for main_question, similar_questions in questions_dict.items():
            all_questions.append(main_question)
            question_mapping[main_question] = main_question
            for q in similar_questions:
                all_questions.append(q)
                question_mapping[q] = main_question

        query_embedding = self.model_handler.get_embedding(user_message)
        best_question = None
        best_similarity = -1

        for question in all_questions:
            question_embedding = self.model_handler.get_embedding(question)
            similarity = cosine_similarity(query_embedding, question_embedding)[0][0]

            if similarity > best_similarity:
                best_similarity = similarity
                best_question = question

        return question_mapping[best_question] if best_similarity > 0.6 else None