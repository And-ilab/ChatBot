import pyorient


def connect_to_orientdb():
    client = pyorient.OrientDB("localhost", 2424)
    session_id = client.connect("root", "gure")
    client.db_open("chat-bot-db", "root", "gure")
    return client