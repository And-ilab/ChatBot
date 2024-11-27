import spacy
import re
import pymorphy3

def extract_keywords(question):
    nlp = spacy.load("ru_core_news_sm")
    morph = pymorphy3.MorphAnalyzer()
    custom_stop_words = {"может", "могут", "какой", "какая", "какое", "какие", "что", "кто", "где", "когда", "зачем",
                         "почему"}
    keywords = re.findall(r'\b\w+-\w+\b', question)
    question_cleaned = re.sub(r'\b\w+-\w+\b', '', question)
    doc = nlp(question_cleaned)

    for token in doc:
        if token.text.lower() not in custom_stop_words:
            if token.pos_ == "VERB":
                keywords.append(token.text)
            elif token.pos_ == "ADJ" and not token.is_stop:
                adj = morph.parse(token.text)[0]
                adj_feminine = adj.inflect({"femn", "sing", "nomn"})
                if adj_feminine:
                    keywords.append(adj_feminine.word)
                else:
                    keywords.append(token.lemma_)
            elif token.is_alpha and not token.is_stop and token.text.lower() not in custom_stop_words:
                keywords.append(token.lemma_)

    return list(set(keywords))
