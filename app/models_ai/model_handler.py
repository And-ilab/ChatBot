import torch
import string
import nltk
from nltk.stem import WordNetLemmatizer
from sklearn.metrics.pairwise import cosine_similarity
from transformers import BertTokenizer, BertModel

nltk.download('punkt')
nltk.download('wordnet')
nltk.download('omw-1.4')

lemmatizer = WordNetLemmatizer()

class ModelHandler:
    def __init__(self, questions_list):
        self.questions_list = questions_list
#        self.tokenizer = BertTokenizer.from_pretrained('DeepPavlov/rubert-base-cased')
#        self.model = BertModel.from_pretrained('DeepPavlov/rubert-base-cased')

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

    def handle_query(self, query):
        query_embedding = self.get_embedding(query)
        best_match = None
        best_similarity = -1

        for key, questions in self.questions_list.items():
            key_processed = self.preprocess(key)
            questions_processed = [self.preprocess(q) for q in questions]
            all_questions = questions_processed + [key_processed]

            question_embeddings = [self.get_embedding(q) for q in all_questions]

            similarities = [cosine_similarity(query_embedding, q_emb)[0][0] for q_emb in question_embeddings]
            max_similarity = max(similarities)

            if max_similarity > best_similarity:
                best_similarity = max_similarity
                best_match = key

        if best_similarity > 0.75:
            return best_match
        else:
            return None
