from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, get_type_hints

from pydantic import BaseModel, ValidationError


class HTTPException(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class status:
    HTTP_200_OK = 200
    HTTP_404_NOT_FOUND = 404
    HTTP_422_UNPROCESSABLE_ENTITY = 422
    HTTP_500_INTERNAL_SERVER_ERROR = 500


@dataclass(frozen=True)
class Response:
    status_code: int
    body: Any

    def json(self) -> Any:
        return self.body


class JSONResponse(Response):
    pass


@dataclass(frozen=True)
class Route:
    method: str
    path: str
    endpoint: Callable[..., Awaitable[Any]]
    pattern: re.Pattern[str]
    path_params: list[str]


class FastAPI:
    def __init__(self, title: str = "app") -> None:
        self.title = title
        self._routes: list[Route] = []

    def get(self, path: str) -> Callable[[Callable[..., Awaitable[Any]]], Callable[..., Awaitable[Any]]]:
        return self._register("GET", path)

    def post(self, path: str) -> Callable[[Callable[..., Awaitable[Any]]], Callable[..., Awaitable[Any]]]:
        return self._register("POST", path)

    def _register(self, method: str, path: str) -> Callable[[Callable[..., Awaitable[Any]]], Callable[..., Awaitable[Any]]]:
        def decorator(endpoint: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
            path_params = re.findall(r"{([^}]+)}", path)
            pattern = re.compile("^" + re.sub(r"{([^}]+)}", r"(?P<\1>[^/]+)", path) + "$")
            self._routes.append(Route(method=method, path=path, endpoint=endpoint, pattern=pattern, path_params=path_params))
            return endpoint

        return decorator

    async def request(self, method: str, path: str, json: Any | None = None) -> Response:
        route, path_values = self._match(method, path)
        if route is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, body={"detail": "Not found"})
        try:
            kwargs = await self._coerce_arguments(route.endpoint, path_values, json)
            result = await route.endpoint(**kwargs)
            return JSONResponse(status_code=status.HTTP_200_OK, body=_serialize(result))
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, body={"detail": exc.detail})
        except ValidationError as exc:
            return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, body={"detail": json.loads(exc.json())})
        except Exception as exc:  # pragma: no cover - exercised in focused tests
            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, body={"detail": str(exc)})

    def _match(self, method: str, path: str) -> tuple[Route | None, dict[str, str]]:
        for route in self._routes:
            if route.method != method.upper():
                continue
            match = route.pattern.match(path)
            if match:
                return route, match.groupdict()
        return None, {}

    async def _coerce_arguments(
        self,
        endpoint: Callable[..., Awaitable[Any]],
        path_values: dict[str, str],
        payload: Any | None,
    ) -> dict[str, Any]:
        annotations = get_type_hints(endpoint)
        kwargs: dict[str, Any] = {}
        for name, value in path_values.items():
            kwargs[name] = value
        if payload is None:
            return kwargs
        for param_name, annotation in annotations.items():
            if param_name == "return" or param_name in kwargs:
                continue
            if isinstance(payload, dict) and isinstance(annotation, type) and issubclass(annotation, BaseModel):
                kwargs[param_name] = annotation.model_validate(payload)
            else:
                kwargs[param_name] = payload
            break
        return kwargs


def _serialize(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json", by_alias=True)
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize(item) for key, item in value.items()}
    return value
