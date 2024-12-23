import json
import requests
import logging

# URL для подключения к OrientDB
URL_for_orientDB = 'http://localhost:2480/command/chat-bot-db/sql'
logger = logging.getLogger(__name__)

def create_nodes_from_data(data):
    """Создание узлов из загруженных данных."""
    try:
        for section, topics in data.items():
            logger.info(f"Creating section: {section}")
            # Создаем раздел
            section_response = create_graph_node("Section", section)
            logger.debug(f"Section response: {section_response}")  # Отладка

            if 'error' in section_response:
                logger.error(f"Failed to create section: {section_response['error']}")
                continue

            section_rid = section_response.get('result', [{}])[0].get('@rid')  # Изменено на правильный путь
            if section_rid is None:
                logger.error(f"Section RID is None for section: {section}")
                continue

            logger.info(f"Created section with RID: {section_rid}")

            for topic, questions in topics.items():
                logger.info(f"Creating topic: {topic}")
                # Создаем тему
                topic_response = create_graph_node("Topic", topic)
                logger.debug(f"Topic response: {topic_response}")  # Отладка

                if 'error' in topic_response:
                    logger.error(f"Failed to create topic: {topic_response['error']}")
                    continue

                topic_rid = topic_response.get('result', [{}])[0].get('@rid')  # Изменено на правильный путь
                if topic_rid is None:
                    logger.error(f"Topic RID is None for topic: {topic}")
                    continue

                logger.info(f"Created topic with RID: {topic_rid}")

                # Создаем связь между разделом и темой
                if section_rid and topic_rid:
                    create_relation(section_rid, topic_rid)
                else:
                    logger.error(f"Cannot create relation: Section RID: {section_rid}, Topic RID: {topic_rid}")

                for question in questions:
                    logger.info(f"Creating question: {question}")
                    # Создаем вопрос
                    question_response = create_graph_node("Question", question)
                    logger.debug(f"Question response: {question_response}")  # Отладка

                    if 'error' in question_response:
                        logger.error(f"Failed to create question: {question_response['error']}")
                        continue

                    question_rid = question_response.get('result', [{}])[0].get('@rid')  # Изменено на правильный путь
                    if question_rid is None:
                        logger.error(f"Question RID is None for question: {question}")
                        continue

                    logger.info(f"Created question with RID: {question_rid}")

                    # Создаем связь между темой и вопросом
                    if topic_rid and question_rid:
                        create_relation(topic_rid, question_rid)
                    else:
                        logger.error(f"Cannot create relation: Topic RID: {topic_rid}, Question RID: {question_rid}")

    except Exception as e:
        logger.error(f"Error in creating nodes: {e}")

def create_graph_node(node_type, node_name):
    """Helper function to create a node in the graph."""
    try:
        sql_command = f"CREATE VERTEX {node_type} SET name = '{node_name}'"
        headers = {'Content-Type': 'application/json'}
        json_data = {"command": sql_command}
        response = requests.post(URL_for_orientDB, headers=headers, json=json_data, auth=('root', 'guregure'))

        logger.debug(f"Response from creating node: {response.text}")  # Отладка

        if response.status_code == 200:
            return response.json()  # Возвращаем ответ для дальнейшего анализа
        else:
            logger.error(f"Error creating node: HTTP {response.status_code} - {response.text}")
            return {'error': f"Error {response.status_code}: {response.text}"}

    except Exception as e:
        logger.error(f"Error in create_graph_node: {e}")
        return {'error': str(e)}

def create_relation(start_node_id, end_node_id):
    """Creates a relation between two nodes."""
    if not start_node_id or not end_node_id:
        logger.error(f"Invalid node IDs: start_node_id={start_node_id}, end_node_id={end_node_id}")
        return

    try:
        command = f"CREATE EDGE Includes FROM {start_node_id} TO {end_node_id}"
        headers = {'Content-Type': 'application/json'}
        json_data = {"command": command}
        response = requests.post(URL_for_orientDB, headers=headers, json=json_data, auth=('root', 'guregure'))

        if response.status_code == 200:
            logger.info(f"Relation created from {start_node_id} to {end_node_id}.")
        else:
            logger.error(f"Error creating relation: HTTP {response.status_code} - {response.text}")

    except Exception as e:
        logger.error(f"Error in create_relation: {e}")

# Пример загрузки данных и запуска функции
if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)  # Уровень логирования
    try:
        with open('json_info/Начисления и выплаты, Больничные листы.json', 'r', encoding='utf-8') as file:
            data = json.load(file)
        create_nodes_from_data(data)
    except Exception as e:
        logger.error(f"Error loading JSON data: {e}")