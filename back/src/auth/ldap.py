from ldap3 import Server, Connection, ALL
from src.config import LDAP_SERVER, DOMAIN, USER_DN, base_dn

from src.auth.jwt import decode_token


def get_current_user(token: str):
    payload = decode_token(token)
    return payload


def get_user_groups(username: str, password: str) -> list:
    server = Server(LDAP_SERVER, get_info=ALL)
    conn = Connection(server, user=f'{DOMAIN}\\{username}', password=password, authentication='SIMPLE')

    if not conn.bind():
        print(f"Bind failed: {conn.last_error}")
        return []

    conn.search(base_dn, f'(&(objectClass=user)(sAMAccountName={username}))', attributes=['memberOf'])

    if conn.entries:
        groups = conn.entries[0].memberOf if conn.entries[0].memberOf else []
        conn.unbind()
        return groups
    else:
        print("User not found or no groups assigned.")
        conn.unbind()
        return []


def authenticate(username: str, password: str) -> dict | None:
    server = Server(LDAP_SERVER, get_info=ALL)
    user_dn = USER_DN.format(username=username)

    try:
        print(f"Trying to bind as: {user_dn}")
        conn = Connection(server, user=user_dn, password=password, authentication='SIMPLE')
        if conn.bind():
            print("Bind successful")
            groups = get_user_groups(username, password)
            print(groups)
            user_info = {"username": username, "roles": groups[0]} if groups else {"username": username, "roles": []}
            conn.unbind()
            return user_info
        else:
            print(f"Bind failed: {conn.last_error}")
            return None
    except Exception as e:
        print(f"LDAP error: {e}")
        return None
