import os
from contextlib import contextmanager

from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

load_dotenv()

db_host = os.getenv("POSTGRES_HOST") or os.getenv("DB_HOST", "localhost")
db_port = os.getenv("POSTGRES_PORT") or os.getenv("DB_PORT", "5432")
db_name = os.getenv("POSTGRES_NAME") or os.getenv("DB_NAME", "postgres")
db_user = os.getenv("POSTGRES_USER") or os.getenv("DB_USER", "postgres")
db_password = os.getenv("POSTGRES_PASS") or os.getenv("DB_PASSWORD", "")

# The platform injects IS_LOCAL into every service: "true" against the local
# Postgres, "false" against AWS Aurora. Aurora refuses unencrypted connections,
# while the local server has no certificate to offer — so the two environments
# need different SSL settings and the flag is what tells them apart. Anything
# other than an explicit "false" is treated as local, so a missing variable
# fails towards the developer machine rather than towards a broken deploy.
is_local = os.getenv("IS_LOCAL", "true").strip().lower() != "false"
ssl_mode = "prefer" if is_local else "require"

CONNINFO = (
    f"host={db_host} "
    f"port={db_port} "
    f"dbname={db_name} "
    f"user={db_user} "
    f"password={db_password} "
    f"sslmode={ssl_mode} "
    f"options=-csearch_path=pms"
)

pool = ConnectionPool(CONNINFO, min_size=1, max_size=10)


@contextmanager
def get_cursor():
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            yield cur
