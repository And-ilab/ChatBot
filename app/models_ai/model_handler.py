import os
import torch
import string
import nltk
import logging
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
