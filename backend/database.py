import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from models import Base

load_dotenv(".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL não foi definida no ambiente.")

#normalizacao do URL para forcar o uso do driver psycopg3
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

#the engine manages the connection to the database and handles query execution.
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "gabaritos" in tables and "questoes" in tables:
        raise RuntimeError(
            "As tabelas 'gabaritos' e 'questoes' existem simultaneamente; "
            "reconcilie os dados antes de iniciar a aplicação."
        )

    with engine.begin() as connection:
        if "gabaritos" in tables:
            connection.execute(text("ALTER TABLE gabaritos RENAME TO questoes"))

    if "questoes" in tables or "gabaritos" in tables:
        columns = {
            column["name"] for column in inspect(engine).get_columns("questoes")
        }
        with engine.begin() as connection:
            if "code" in columns and "codigo_esperado" not in columns:
                connection.execute(
                    text("ALTER TABLE questoes RENAME COLUMN code TO codigo_esperado")
                )
            if "workspace_json" in columns and "blocos_esperados" not in columns:
                connection.execute(
                    text(
                        "ALTER TABLE questoes "
                        "RENAME COLUMN workspace_json TO blocos_esperados"
                    )
                )

    Base.metadata.create_all(bind=engine)

    questao_columns = {
        column["name"] for column in inspect(engine).get_columns("questoes")
    }
    with engine.begin() as connection:
        if "titulo" not in questao_columns:
            connection.execute(
                text("ALTER TABLE questoes ADD COLUMN titulo VARCHAR NOT NULL DEFAULT ''")
            )
        if "enunciado" not in questao_columns:
            connection.execute(
                text("ALTER TABLE questoes ADD COLUMN enunciado TEXT NOT NULL DEFAULT ''")
            )
        if "tipo_questao" not in questao_columns:
            connection.execute(
                text(
                    "ALTER TABLE questoes "
                    "ADD COLUMN tipo_questao VARCHAR NOT NULL DEFAULT 'codigo'"
                )
            )
        if "codigo_esperado" not in questao_columns:
            connection.execute(
                text("ALTER TABLE questoes ADD COLUMN codigo_esperado TEXT")
            )
        if "blocos_esperados" not in questao_columns:
            connection.execute(
                text("ALTER TABLE questoes ADD COLUMN blocos_esperados JSON")
            )

        tentativa_columns = {
            column["name"] for column in inspect(engine).get_columns("tentativas")
        }
        if "code" not in tentativa_columns:
            connection.execute(
                text("ALTER TABLE tentativas ADD COLUMN code TEXT NOT NULL DEFAULT ''")
            )
        if "workspace_json" not in tentativa_columns:
            connection.execute(
                text("ALTER TABLE tentativas ADD COLUMN workspace_json JSON")
            )
        connection.execute(
            text(
                "DELETE FROM tentativas "
                "WHERE id NOT IN ("
                "SELECT MIN(id) FROM tentativas GROUP BY nome, id_questao"
                ")"
            )
        )
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS "
                "uq_tentativas_nome_questao_idx "
                "ON tentativas (nome, id_questao)"
            )
        )
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS "
                "uq_questoes_id_questao_idx ON questoes (id_questao)"
            )
        )

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()