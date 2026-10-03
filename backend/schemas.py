from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

class TentativaCreate(BaseModel):
    nome: str = Field(min_length=1)
    id_questao: str = Field(min_length=1)
    n_tentativas: int = Field(ge=1)
    code: str = ""
    workspace_json: dict | None = None


class QuestaoCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id_questao: str = Field(min_length=1)
    titulo: str = Field(min_length=1)
    enunciado: str = Field(min_length=1)
    tipo_questao: Literal["fechada", "aberta"]
    codigo_esperado: str | None = None
    blocos_esperados: dict[str, Any] | None = None

    @model_validator(mode="after")
    def validate_expected_answer(self):
        if self.tipo_questao == "fechada" and not self.codigo_esperado:
            raise ValueError("Questões do tipo 'fechada' precisam de codigo_esperado.")
        if self.tipo_questao == "aberta" and not self.blocos_esperados:
            raise ValueError("Questões do tipo 'aberta' precisam de blocos_esperados.")
        return self


class QuestaoImport(BaseModel):
    questoes: list[QuestaoCreate] = Field(min_length=1)