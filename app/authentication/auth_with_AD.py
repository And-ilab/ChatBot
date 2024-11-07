# myapp/auth.py
from ldap3 import Server, Connection, ALL

def ldap_authenticate(username, password):
    LDAP_SERVER = 'ldap://company.local'
    DOMAIN = 'COMPANY'
    user_dn = f"{username}@{DOMAIN.lower()}"
    server = Server(LDAP_SERVER, get_info=ALL)

    try:
        # Попытка подключиться к LDAP с использованием учетных данных
        conn = Connection(server, user=user_dn, password=password)
        if conn.bind():
            return True  # Успешная аутентификация
        else:
            return False  # Аутентификация не прошла
    except Exception as e:
        print(f"Ошибка аутентификации: {e}")
        return False