import os
import torch
import string
import nltk
import logging
from nltk.stem import WordNetLemmatizer
from sklearn.metrics.pairwise import cosine_similarity
from concurrent.futures import ThreadPoolExecutor
from transformers import BertTokenizer, BertModel
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
from huggingface_hub import snapshot_download

nltk.download('punkt_tab')
nltk.download('punkt')
nltk.download('wordnet')
nltk.download('omw-1.4')

lemmatizer = WordNetLemmatizer()

logger = logging.getLogger('chat_user')

model_path = "models_ai/rubert_model"
tokenizer_path = "models_ai/rubert_tokenizer"

class ModelHandler:
    def __init__(self, questions_list):
        os.makedirs(model_path, exist_ok=True)
        os.makedirs(tokenizer_path, exist_ok=True)

        if not os.path.exists(os.path.join(model_path, "config.json")):
            model = BertModel.from_pretrained('DeepPavlov/rubert-base-cased')
            model.save_pretrained(model_path)

        if not os.path.exists(os.path.join(tokenizer_path, "tokenizer.json")):
            tokenizer = BertTokenizer.from_pretrained('DeepPavlov/rubert-base-cased')
            tokenizer.save_pretrained(tokenizer_path)

        self.questions_list = questions_list
        self.tokenizer = BertTokenizer.from_pretrained(tokenizer_path)
        self.model = BertModel.from_pretrained(model_path)
        self.embeddings_cache = self._precompute_embeddings()

    def preprocess(self, text):
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
        for key, questions in self.questions_list.items():
            key_processed = self.preprocess(key)
            questions_processed = [self.preprocess(q) for q in questions]
            all_questions = questions_processed + [key_processed]

            with ThreadPoolExecutor() as executor:
                question_embeddings = list(executor.map(self.get_embedding, all_questions))

            embeddings_cache[key] = question_embeddings

        return embeddings_cache

    def handle_query(self, query):
        query_embedding = self.get_embedding(query)
        best_match = None
        best_similarity = -1

        with ThreadPoolExecutor() as executor:
            futures = []
            for key, question_embeddings in self.embeddings_cache.items():
                future = executor.submit(self._calculate_max_similarity, query_embedding, question_embeddings, key)
                futures.append(future)

            for future in futures:
                max_similarity, key = future.result()
                if max_similarity > best_similarity:
                    best_similarity = max_similarity
                    best_match = key

        if best_similarity > 0.75:
            return best_match
        else:
            return None

    def _calculate_max_similarity(self, query_embedding, question_embeddings, key):
        similarities = [cosine_similarity(query_embedding, q_emb)[0][0] for q_emb in question_embeddings]
        max_similarity = max(similarities)
        return max_similarity, key


class NeuralHandler:
    def __init__(self, model_name="h2oai/h2ogpt-4096-llama2-7b-chat",
                 local_model_path="models_ai/h2ogpt-4096-llama2-7b-chat"):
        self.model_name = model_name
        self.local_model_path = local_model_path

        snapshot_download(
            repo_id=self.model_name,
            local_dir=self.local_model_path,
            resume_download=True,
        )

        self.tokenizer = AutoTokenizer.from_pretrained(
            self.local_model_path,
            use_fast=False,
            padding_side="left",
            trust_remote_code=True,
            legacy=True,
        )

        self.model = AutoModelForCausalLM.from_pretrained(
            self.local_model_path,
            torch_dtype="auto",
            device_map="auto",
            trust_remote_code=True,
        )

        self.generate_text = pipeline(
            "text-generation",
            model=self.model,
            tokenizer=self.tokenizer,
        )

    def generate_response(self, user_input, **kwargs):
        try:
            # Логируем входные данные
            logger.info(f"Starting text generation for user input: {user_input}")
            logger.info(f"Additional kwargs received: {kwargs}")

            # Устанавливаем параметры по умолчанию
            default_kwargs = {
                "min_new_tokens": 2,
                "max_new_tokens": 1024,
                "do_sample": False,
                "num_beams": 1,
                "temperature": 0.3,
                "repetition_penalty": 1.2,
            }
            logger.info(f"Default kwargs: {default_kwargs}")

            # Обновляем параметры по умолчанию переданными kwargs
            default_kwargs.update(kwargs)
            logger.info(f"Merged kwargs for text generation: {default_kwargs}")

            # Логируем начало генерации текста
            logger.info("Calling generate_text pipeline...")

            # Вызываем генерацию текста
            res = self.generate_text(user_input, **default_kwargs)
            logger.info(f"Raw result from generate_text: {res}")

            # Проверяем, что результат не пустой и имеет ожидаемую структуру
            if not res or not isinstance(res, list) or not res[0].get("generated_text"):
                logger.error(f"Unexpected result format: {res}")
                raise ValueError("Unexpected result format from generate_text")

            # Логируем окончательный результат
            generated_text = res[0]["generated_text"]
            logger.info(f"Generated text: {generated_text}")

            return generated_text

        except Exception as e:
            # Логируем исключение с трассировкой стека
            logger.error(f"Error in generate_response: {str(e)}", exc_info=True)
            raise  # Повторно поднимаем исключение для обработки в вызывающем коде