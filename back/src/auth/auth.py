from ldap3 import Server, Connection, ALL, NTLM
from fastapi import FastAPI, HTTPException, Depends
import jwt
import datetime

LDAP_SERVER = 'ldap://company.local'  # Замените на адрес вашего AD сервера
DOMAIN = 'COMPANY'  # Замените на ваш домен
USER_DN = f'{{username}}@{DOMAIN.lower()}'
base_dn = 'DC=company,DC=local'
SECRET_KEY = "your_secret_key"  # Замените на ваш секретный ключ
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


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
            print("Bind successful+")
            # Получите информацию о пользователе
            groups = get_user_groups(username, password)
            print(groups)
            if not groups:
                user_info = {"username": username, "roles": groups}
            else:
                user_info = {"username": username, "roles": groups[0]}

            conn.unbind()
            return user_info
        else:
            print(f"Bind failed: {conn.last_error}")
            return None
    except Exception as e:
        print(f"LDAP error: {e}")
        return None


def create_access_token(data: dict, expires_delta: datetime.timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# Создание зависимостей для защищенных маршрутов
def get_current_user(token: str):
    payload = decode_token(token)
    return payload
