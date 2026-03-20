from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class ToolInput(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    name: str = Field(min_length=1, max_length=64)
    description: str = Field(min_length=1)
    input_schema: dict[str, Any] = Field(alias="inputSchema")
    server_url: HttpUrl = Field(alias="serverUrl")
    category: str = Field(min_length=1)
    run_llm_test: bool = Field(default=True, alias="runLlmTest")

    @field_validator("input_schema")
    @classmethod
    def validate_input_schema(cls, value: dict[str, Any]) -> dict[str, Any]:
        if value.get("type") != "object":
            raise ValueError("inputSchema.type must be 'object'")
        if not isinstance(value.get("properties"), dict) or not value["properties"]:
            raise ValueError("inputSchema.properties must be a non-empty object")
        required = value.get("required", [])
        if required is not None and not isinstance(required, list):
            raise ValueError("inputSchema.required must be a list")
        return value
