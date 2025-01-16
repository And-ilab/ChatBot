import pickle
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

MODEL_PATH = "models_ai/trained_model.pkl"

class ModelHandler:
    def __init__(self):
        with open(MODEL_PATH, "rb") as f:
            data = pickle.load(f)
        self.embeddings = data["embeddings"]
        self.questions = data["questions"]
        self.mapping = data["mapping"]
        self.model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

    def handle_query(self, query):
        query = query.lower()

        if "транспорт" in query or "маршрутка" in query:
            query = "Какими маршрутками можно ездить в командировку?"
        elif "заявка" in query and "командировка" in query:
            query = "Как оформить заявку на командирование?"
        elif "суточные" in query:
            query = "Какой размер суточных при командировании?"
        elif "оплата" in query or "расходы" in query:
            query = "Порядок оплаты командировочных расходов."
            return f"Это вопрос: {query}"

        query_embedding = self.model.encode([query])
        similarities = cosine_similarity(query_embedding, self.embeddings)
        max_idx = np.argmax(similarities)
        max_similarity = similarities[0][max_idx]

        if max_similarity > 0.7:
            main_question = self.mapping[self.questions[max_idx]]
            return main_question
        else:
            return None
