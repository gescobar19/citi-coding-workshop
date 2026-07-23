import os
from contextlib import contextmanager

from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

load_dotenv()

db_host = os.getenv("POSTGRES_HOST") or os.getenv("DB_HOST", "localhost")
db_port = os.getenv("POSTGRES_PORT") or os.getenv("DB_PORT", "5432")
db_name = os.getenv("POSTGRES_NAME") or os.getenv("DB_NAME", "project_management")
db_user = os.getenv("POSTGRES_USER") or os.getenv("DB_USER", "postgres")
db_password = os.getenv("POSTGRES_PASS") or os.getenv("DB_PASSWORD", "")

CONNINFO = (
    f"host={db_host} "
    f"port={db_port} "
    f"dbname={db_name} "
    f"user={db_user} "
    f"password={db_password} "
    f"options=-csearch_path=pms"
)

pool = ConnectionPool(CONNINFO, min_size=1, max_size=10)


@contextmanager
def get_cursor():
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            yield cur
