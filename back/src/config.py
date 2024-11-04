from dotenv import load_dotenv
import os

load_dotenv()


DB_HOST = os.environ.get("DB_HOST")
DB_NAME = os.environ.get("DB_NAME")
DB_PASS = os.environ.get("DB_PASS")
DB_PORT = os.environ.get("DB_PORT")
DB_USER = os.environ.get("DB_USER")

LDAP_SERVER = os.environ.get("LDAP_SERVER")
DOMAIN = os.environ.get("DOMAIN")
USER_DN = os.environ.get("USER_DN")
base_dn = os.environ.get("base_dn")

SECRET_KEY = os.environ.get("SECRET_KEY")
ALGORITHM = os.environ.get("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES")