import json
import requests
import logging

# URL для подключения к OrientDB
URL_FOR_ORIENTDB = 'http://localhost:2480/command/chat-bot-db/sql'
logger = logging.getLogger(__name__)

def sanitize_input(input_string):
    """Экранирование специальных символов в строке для SQL-запросов."""
    if input_string:
        return input_string.replace("'", "''").replace("\n", " ")  # Заменяем символ новой строки на пробел
    return ''

def create_nodes_from_data(data):
    """Создание узлов из загруженных данных."""
    try:
        for section_name, topics in data.items():
            logger.info(f"Creating section: {section_name}")
            section_response = create_graph_node("Section", sanitize_input(section_name))
            logger.debug(f"Section response: {section_response}")

            if 'error' in section_response:
                logger.error(f"Failed to create section: {section_response['error']}")
                continue

            section_rid = section_response.get('result', [{}])[0].get('@rid')
            if section_rid is None:
                logger.error(f"Section RID is None for section: {section_name}")
                continue

            logger.info(f"Created section with RID: {section_rid}")

            for topic_name, questions in topics.items():
                logger.info(f"Creating topic: {topic_name}")
                topic_response = create_graph_node("Topic", sanitize_input(topic_name))
                logger.debug(f"Topic response: {topic_response}")

                if 'error' in topic_response:
                    logger.error(f"Failed to create topic: {topic_response['error']}")
                    continue

                topic_rid = topic_response.get('result', [{}])[0].get('@rid')
                if topic_rid is None:
                    logger.error(f"Topic RID is None for topic: {topic_name}")
                    continue

                logger.info(f"Created topic with RID: {topic_rid}")

                # Создание связи между разделом и темой
                create_relation(section_rid, topic_rid)

                for question_data in questions:
                    question_text = sanitize_input(question_data.get('Вопрос', ''))
                    answer = sanitize_input(question_data.get('Готовый ответ', ''))
                    name_link = sanitize_input(question_data.get('Название ссылки', ''))
                    link = sanitize_input(question_data.get('Ссылка', ''))
                    name_document = sanitize_input(question_data.get('Название документа', ''))
                    link_doc = sanitize_input(question_data.get('Документ', ''))
                    npa = sanitize_input(question_data.get('НПА', ''))
                    lpa = sanitize_input(question_data.get('ЛПА', ''))

                    logger.info(f"Creating question: {question_text}")
                    question_response = create_graph_node("Question", question_text)
                    logger.debug(f"Question response: {question_response}")

                    if 'error' in question_response:
                        logger.error(f"Failed to create question: {question_response['error']}")
                        continue

                    question_rid = question_response.get('result', [{}])[0].get('@rid')
                    if question_rid is None:
                        logger.error(f"Question RID is None for question: {question_text}")
                        continue

                    logger.info(f"Created question with RID: {question_rid}")


                    answer_response = create_graph_node("Answer", answer)
                    logger.debug(f"Answer response: {answer_response}")

                    if 'error' in answer_response:
                        logger.error(f"Failed to create answer: {answer_response['error']}")
                        continue

                    answer_rid = answer_response.get('result', [{}])[0].get('@rid')
                    if answer_rid is None:
                        logger.error(f"Answer RID is None for answer: {answer}")
                        continue

                    logger.info(f"Created answer with RID: {answer_rid}")

                        # Создание связи между вопросом и ответом
                    create_relation_with_attributes(answer_rid, question_rid, npa, lpa)
                    create_relation(topic_rid, question_rid)  # Связываем тему с вопросом

                    # Проверка для документа
                    if link_doc and name_document:
                        document_response = create_graph_node("Document", name_document, {"name": name_document, "content": link_doc})
                        logger.debug(f"Document response: {document_response}")

                        if 'error' not in document_response:
                            document_rid = document_response.get('result', [{}])[0].get('@rid')
                            if document_rid:
                                create_relation(answer_rid, document_rid)

                    # Проверка для ссылки
                    if link and name_link:
                        link_response = create_graph_node("Link", name_link, {"name": name_link, "content": link})
                        logger.debug(f"Link response: {link_response}")

                        if 'error' not in link_response:
                            link_rid = link_response.get('result', [{}])[0].get('@rid')
                            if link_rid:
                                create_relation(answer_rid, link_rid)

    except Exception as e:
        logger.error(f"Error in creating nodes: {e}")

def create_graph_node(node_type, node_name, additional_properties=None):
    """Helper function to create a node in the graph."""
    try:
        properties = f"SET content = '{node_name}'"  # Здесь меняем имя на контент
        if additional_properties:
            props = ', '.join(f"{key} = '{value}'" for key, value in additional_properties.items())
            properties += ', ' + props
        sql_command = f"CREATE VERTEX {node_type} {properties}"
        headers = {'Content-Type': 'application/json'}
        json_data = {"command": sql_command}
        response = requests.post(URL_FOR_ORIENTDB, headers=headers, json=json_data, auth=('root', 'guregure'))

        logger.debug(f"Response from creating node: {response.text}")

        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"Error creating node: HTTP {response.status_code} - {response.text}")
            return {'error': f"Error {response.status_code}: {response.text}"}

    except Exception as e:
        logger.error(f"Error in create_graph_node: {e}")
        return {'error': str(e)}

def create_relation(source_rid, target_rid):
    """Helper function to create a relation between two nodes."""
    try:
        sql_command = f"CREATE EDGE Includes FROM {source_rid} TO {target_rid}"
        headers = {'Content-Type': 'application/json'}
        json_data = {"command": sql_command}
        response = requests.post(URL_FOR_ORIENTDB, headers=headers, json=json_data, auth=('root', 'guregure'))

        logger.debug(f"Response from creating relation: {response.text}")

        if response.status_code != 200:
            logger.error(f"Error creating relation: HTTP {response.status_code} - {response.text}")

    except Exception as e:
        logger.error(f"Error in create_relation: {e}")

def create_relation_with_attributes(answer_rid, question_rid, npa, lpa):
    """Создание связи между вопросом и ответом и установка атрибутов НПА и ЛПА на объекте Answer."""
    try:
        # Создание рёбер без установки свойств
        sql_command_create = f"CREATE EDGE Includes FROM {question_rid} TO {answer_rid}"
        headers = {'Content-Type': 'application/json'}
        json_data_create = {"command": sql_command_create}
        response_create = requests.post(URL_FOR_ORIENTDB, headers=headers, json=json_data_create,
                                        auth=('root', 'guregure'))

        if response_create.status_code != 200:
            print(f"Error creating edge: HTTP {response_create.status_code} - {response_create.text}")
            return

        # Обновление объекта Answer с установкой свойств NPA и LPA
        npa = sanitize_input(npa)
        lpa = sanitize_input(lpa)
        sql_command_update = f"UPDATE {answer_rid} SET NPA = '{npa}', LPA = '{lpa}'"
        json_data_update = {"command": sql_command_update}
        response_update = requests.post(URL_FOR_ORIENTDB, headers=headers, json=json_data_update,
                                        auth=('root', 'guregure'))

        if response_update.status_code == 200:
            print(f"Answer updated successfully: {response_update.text}")
        else:
            print(f"Error updating answer: HTTP {response_update.status_code} - {response_update.text}")

    except Exception as e:
        print(f"Error in create_relation_with_attributes: {e}")

# Пример загрузки данных и запуска функции
if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)
    try:
        with open('new.json', 'r', encoding='utf-8') as file:
            data = json.load(file)
            create_nodes_from_data(data)
    except Exception as e:
        logger.error(f"Error loading JSON data: {e}")