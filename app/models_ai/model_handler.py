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

nltk.download('punkt_tab')
nltk.download('punkt')
nltk.download('wordnet')
nltk.download('omw-1.4')

lemmatizer = WordNetLemmatizer()

logger = logging.getLogger('chat_user')

model_path = "models_ai/rubert_model"
tokenizer_path = "models_ai/rubert_tokenizer"


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
    def __init__(self, questions_list, model_handler, keyword_extractor):
        self.questions_list = questions_list
        self.model_handler = model_handler
        self.extract_keywords = keyword_extractor
        self.group_keywords = self._index_group_keywords()

    def _index_group_keywords(self):
        group_keywords = defaultdict(set)

        for group_keys, questions_dict in self.questions_list.items():
            all_questions = []
            for main_question, similar_questions in questions_dict.items():
                all_questions.append(main_question)
                all_questions.extend(similar_questions)

            for question in all_questions:
                keywords = self.extract_keywords(question)
                group_keywords[group_keys].update(keywords)

        return group_keywords

    def _get_group_keywords_frequency(self, user_keywords):
        group_scores = defaultdict(int)

        for group_keys, keywords in self.group_keywords.items():
            common_keywords = keywords & set(user_keywords)
            group_scores[group_keys] = len(common_keywords)

        if not group_scores:
            return None

        return max(group_scores.items(), key=lambda x: x[1])[0]

    def match_question(self, user_message):
        corrected_message = correct_with_yandex(user_message)
        if corrected_message != user_message:
            logging.info(f"Исправленный запрос: {corrected_message} (оригинал: {user_message})")
            user_message = corrected_message

        user_keywords = self.extract_keywords(user_message)

        if not user_keywords:
            return None

        best_group = self._get_group_keywords_frequency(user_keywords)

        if not best_group:
            return None

        questions_dict = self.questions_list[best_group]

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

        return question_mapping[best_question] if best_similarity > 0.5 else None