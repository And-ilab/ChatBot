from ldap3 import ALL, Server, Connection
from ldap3.core.exceptions import LDAPException
from config import settings

LDAP_SERVER = settings.LDAP_SERVER
DOMAIN = settings.DOMAIN
BASE_DN = settings.base_dn


def validate_user_credentials(username, password):
    server = Server(host=LDAP_SERVER, use_ssl=False, get_info=ALL)

    try:
        if '@' in username:

            username = username.split('@')[0]
            user_dn = f"{DOMAIN}\\{username}"
        else:
            user_dn = f"{DOMAIN}\\{username}"
        with Connection(
                server,
                authentication="SIMPLE",
                user=user_dn,
                password=password,
                raise_exceptions=False
        ) as connection:
            if connection.bind():
                print("Bind successful")
                search_filter = f'(sAMAccountName={username})'
                connection.search(search_base=BASE_DN, search_filter=search_filter, search_scope="SUBTREE",
                                  attributes=['givenName', 'sn', 'mail'])

                if connection.entries:
                    user_entry = connection.entries[0]
                    return user_entry
                else:
                    print("Пользователь не найден в Active Directory.")
                    return None
            else:
                print(f"Ошибка при привязке: {connection.result['description']}")
                return None
    except LDAPException as e:
        print(f"Ошибка LDAP: {e}")
        return None