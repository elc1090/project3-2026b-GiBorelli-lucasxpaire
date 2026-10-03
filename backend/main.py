import json
from contextlib import asynccontextmanager
from pathlib import Path
import unicodedata
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import SessionLocal, get_db, init_db
from models import Questao, Tentativa
from schemas import QuestaoCreate, QuestaoImport, TentativaCreate

@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    seed_questions()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def normalize_code(code: str) -> str:
    return "\n".join(line.strip() for line in code.strip().splitlines() if line.strip())


def normalize_question_id(title: str) -> str:
    without_accents = "".join(character
        for character in unicodedata.normalize("NFD", title)
        if not unicodedata.combining(character)
    )
    return "".join(without_accents.lower().split())


def normalize_workspace(value: Any) -> Any:
    variable_names = {}
    if isinstance(value, dict):
        variable_names = {
            variable["id"]: variable["name"]
            for variable in value.get("variables", [])
            if isinstance(variable, dict)
            and isinstance(variable.get("id"), str)
            and isinstance(variable.get("name"), str)
        }

    def normalize(item: Any, item_key: str | None = None) -> Any:
        if isinstance(item, dict):
            normalized = {}
            for item_name, item_value in sorted(item.items()):
                if item_name == "id" and isinstance(item_value, str):
                    variable_name = variable_names.get(item_value)
                    if variable_name is not None:
                        normalized["variable"] = variable_name
                    continue
                if item_name in {"id", "x", "y"}:
                    continue
                normalized[item_name] = normalize(item_value, item_name)
            return normalized
        if isinstance(item, list):
            items = [normalize(child) for child in item]
            if item_key == "variables":
                return sorted(items, key=lambda child: json.dumps(child, sort_keys=True))
            return items
        return item

    return normalize(value)


def public_question(question: Questao) -> dict[str, Any]:
    return {
        "id_questao": question.id_questao,
        "titulo": question.titulo,
        "enunciado": question.enunciado,
        "tipo_questao": question.tipo_questao,
    }


def save_question(data: QuestaoCreate, db: Session) -> Questao:
    question = db.scalar(
        select(Questao).where(Questao.id_questao == data.id_questao.strip())
    )
    if question is None:
        question = Questao(id_questao=data.id_questao.strip())
        db.add(question)

    question.titulo = data.titulo.strip()
    question.enunciado = data.enunciado.strip()
    question.tipo_questao = data.tipo_questao
    question.codigo_esperado = data.codigo_esperado
    question.blocos_esperados = data.blocos_esperados
    return question


def seed_questions() -> None:
    seed_path = Path(__file__).with_name("questoes.json")
    if not seed_path.exists():
        return

    seed = QuestaoImport.model_validate_json(seed_path.read_text(encoding="utf-8"))
    with SessionLocal() as db:
        for question_data in seed.questoes:
            existing = db.scalar(
                select(Questao).where(
                    Questao.id_questao == question_data.id_questao
                )
            )
            if existing is None:
                save_question(question_data, db)
            else:
                if not existing.titulo:
                    existing.titulo = question_data.titulo
                if not existing.enunciado:
                    existing.enunciado = question_data.enunciado
                if not existing.codigo_esperado:
                    existing.codigo_esperado = question_data.codigo_esperado
        db.commit()


@app.post("/run-blocks")
async def run_blockly_logic(data: TentativaCreate, db: Session = Depends(get_db)):
    try:
        nome = data.nome.strip()
        tentativa = db.scalar(
            select(Tentativa).where(
                Tentativa.nome == nome,
                Tentativa.id_questao == data.id_questao,
            )
        )

        if tentativa:
            tentativa.n_tentativas += 1
            tentativa.code = data.code
            tentativa.workspace_json = data.workspace_json
        else:
            tentativa = Tentativa(
                nome=nome,
                id_questao=data.id_questao,
                n_tentativas=1,
                code=data.code,
                workspace_json=data.workspace_json,
            )
            db.add(tentativa)

        db.commit()
        db.refresh(tentativa)

        question = db.scalar(
            select(Questao).where(Questao.id_questao == data.id_questao)
        )
        if question and question.tipo_questao == "aberta":
            correta = bool(
                data.workspace_json
                and question.blocos_esperados
                and normalize_workspace(data.workspace_json)
                == normalize_workspace(question.blocos_esperados)
            )
        else:
            correta = bool(
                question
                and question.codigo_esperado
                and normalize_code(data.code)
                == normalize_code(question.codigo_esperado)
            )

        if question is None:
            mensagem = "Tentativa salva, mas esta questão não está cadastrada."
        elif correta:
            mensagem = "Resposta correta."
        else:
            mensagem = "Resposta diferente do esperado."

        return {
            "status": "success",
            "message": mensagem,
            "correta": correta,
            "questao_cadastrada": question is not None,
            "nome": tentativa.nome,
            "id_questao": tentativa.id_questao,
            "n_tentativas": tentativa.n_tentativas,
            "received_code": data.code,
            "tentativa_id": tentativa.id,
        }
    except Exception:
        db.rollback()
        raise


@app.get("/tentativas")
async def list_attempts(
    nome: str | None = None,
    id_questao: str | None = None,
    db: Session = Depends(get_db),
):
    query = select(Tentativa).order_by(Tentativa.id_questao)
    if nome:
        query = query.where(Tentativa.nome == nome)
    if id_questao:
        query = query.where(Tentativa.id_questao == id_questao)

    tentativas = db.scalars(query).all()
    return [
        {
            "id": tentativa.id,
            "nome": tentativa.nome,
            "id_questao": tentativa.id_questao,
            "n_tentativas": tentativa.n_tentativas,
            "code": tentativa.code,
            "workspace_json": tentativa.workspace_json,
            "criado_em": tentativa.criado_em,
        }
        for tentativa in tentativas
    ]


@app.get("/questoes")
async def list_questions(db: Session = Depends(get_db)):
    questions = db.scalars(select(Questao).order_by(Questao.id)).all()
    return [public_question(question) for question in questions]


@app.post("/questoes")
async def create_question(data: QuestaoCreate, db: Session = Depends(get_db)):
    question_id = normalize_question_id(data.titulo)
    if not question_id or data.id_questao != question_id:
        raise HTTPException(
            status_code=422,
            detail="O identificador da questão deve ser gerado a partir do título.",
        )

    existing = db.scalar(
        select(Questao).where(Questao.id_questao == question_id)
    )
    if existing is not None or any(
        normalize_question_id(question.titulo) == question_id
        for question in db.scalars(select(Questao)).all()
    ):
        raise HTTPException(
            status_code=409,
            detail="Esse título não pode ser usado, ele já existe. Insira outro título e tente novamente.",
        )

    question = save_question(data, db)
    db.commit()
    db.refresh(question)
    return {"status": "success", "id_questao": question.id_questao}


@app.post("/questoes/importar")
async def import_questions(data: QuestaoImport, db: Session = Depends(get_db)):
    ids = [question.id_questao.strip() for question in data.questoes]
    if len(ids) != len(set(ids)):
        raise HTTPException(
            status_code=422,
            detail="O arquivo contém ids_questao duplicados.",
        )

    questions = [save_question(question, db) for question in data.questoes]
    db.commit()
    return {
        "status": "success",
        "quantidade": len(questions),
        "ids_questao": [question.id_questao for question in questions],
    }
