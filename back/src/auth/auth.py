from ldap3 import Server, Connection, ALL, NTLM

LDAP_SERVER = 'ldap://company.local'  # Замените на адрес вашего AD сервера
DOMAIN = 'COMPANY'  # Замените на ваш домен
USER_DN = f'{DOMAIN}\\{{username}}'

def authenticate(username: str, password: str) -> bool:
    server = Server(LDAP_SERVER, get_info=ALL)
    user_dn = USER_DN.format(username=username)

    try:
        # Попробуйте базовую аутентификацию
        conn = Connection(server, user=user_dn, password=password, authentication='SIMPLE')
        if conn.bind():
            conn.unbind()
            return True
        else:
            print(f"Bind failed: {conn.last_error}")
            return False
    except Exception as e:
        print(f"LDAP error: {e}")
        return False
