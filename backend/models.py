from datetime import datetime, timezone
from sqlalchemy import DateTime, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from typing import Any

class Base(DeclarativeBase):
    pass


class Tentativa(Base):
    __tablename__ = "tentativas"
    __table_args__ = (UniqueConstraint("nome", "id_questao", name="uq_tentativa_nome_questao"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nome: Mapped[str] = mapped_column(String, nullable=False, index=True)
    id_questao: Mapped[str] = mapped_column(String, nullable=False, index=True)
    n_tentativas: Mapped[int] = mapped_column(nullable=False, default=1)
    code: Mapped[str] = mapped_column(Text, nullable=False, default="")
    workspace_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class Questao(Base):
    __tablename__ = "questoes"
    __table_args__ = (UniqueConstraint("id_questao", name="uq_questao_id_questao"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    id_questao: Mapped[str] = mapped_column(String, nullable=False, index=True)
    titulo: Mapped[str] = mapped_column(String, nullable=False, default="")
    enunciado: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tipo_questao: Mapped[str] = mapped_column(String, nullable=False, default="codigo")
    codigo_esperado: Mapped[str | None] = mapped_column(Text, nullable=True)
    blocos_esperados: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

