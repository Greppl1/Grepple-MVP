from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, get_type_hints

from pydantic import BaseModel, ValidationError


class HTTPException(Exception):
    def __init__(
        self,
        status_code: int,
        detail: str,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.headers = headers or {}


class status:
    HTTP_200_OK = 200
    HTTP_401_UNAUTHORIZED = 401
    HTTP_429_TOO_MANY_REQUESTS = 429
    HTTP_404_NOT_FOUND = 404
    HTTP_422_UNPROCESSABLE_ENTITY = 422
    HTTP_500_INTERNAL_SERVER_ERROR = 500


class CORSMiddleware:
    def __init__(self, app: Any, **kwargs: Any) -> None:
        self.app = app
        self.kwargs = kwargs


@dataclass(frozen=True)
class Client:
    host: str


@dataclass(frozen=True)
class URL:
    path: str


@dataclass(frozen=True)
class Request:
    method: str
    url: URL
    headers: dict[str, str]
    client: Client


@dataclass(frozen=True)
class Response:
    status_code: int
    body: Any
    headers: dict[str, str] | None = None

    def json(self) -> Any:
        return self.body


class JSONResponse(Response):
    def __init__(
        self,
        status_code: int,
        body: Any | None = None,
        headers: dict[str, str] | None = None,
        content: Any | None = None,
    ) -> None:
        super().__init__(
            status_code=status_code,
            body=body if content is None else content,
            headers=headers or {},
        )


@dataclass(frozen=True)
class Route:
    method: str
    path: str
    endpoint: Callable[..., Awaitable[Any]]
    pattern: re.Pattern[str]
    path_params: list[str]


class FastAPI:
    def __init__(
        self,
        title: str = "app",
        docs_url: str | None = "/docs",
        redoc_url: str | None = "/redoc",
        openapi_url: str | None = "/openapi.json",
        **_: Any,
    ) -> None:
        self.title = title
        self.docs_url = docs_url
        self.redoc_url = redoc_url
        self.openapi_url = openapi_url
        self._routes: list[Route] = []
        self._middleware: list[dict[str, Any]] = []
        self._http_middleware: list[
            Callable[[Request, Callable[[Request], Awaitable[Response]]], Awaitable[Response]]
        ] = []

    def get(self, path: str) -> Callable[[Callable[..., Awaitable[Any]]], Callable[..., Awaitable[Any]]]:
        return self._register("GET", path)

    def post(self, path: str) -> Callable[[Callable[..., Awaitable[Any]]], Callable[..., Awaitable[Any]]]:
        return self._register("POST", path)

    def add_middleware(self, middleware_class: type[Any], **options: Any) -> None:
        self._middleware.append(
            {"middleware_class": middleware_class, "options": options}
        )

    def middleware(
        self, middleware_type: str
    ) -> Callable[
        [Callable[[Request, Callable[[Request], Awaitable[Response]]], Awaitable[Response]]],
        Callable[[Request, Callable[[Request], Awaitable[Response]]], Awaitable[Response]],
    ]:
        if middleware_type != "http":
            raise ValueError("Only http middleware is supported")

        def decorator(
            func: Callable[[Request, Callable[[Request], Awaitable[Response]]], Awaitable[Response]]
        ) -> Callable[[Request, Callable[[Request], Awaitable[Response]]], Awaitable[Response]]:
            self._http_middleware.append(func)
            return func

        return decorator

    def _register(self, method: str, path: str) -> Callable[[Callable[..., Awaitable[Any]]], Callable[..., Awaitable[Any]]]:
        def decorator(endpoint: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
            path_params = re.findall(r"{([^}]+)}", path)
            pattern = re.compile("^" + re.sub(r"{([^}]+)}", r"(?P<\1>[^/]+)", path) + "$")
            self._routes.append(Route(method=method, path=path, endpoint=endpoint, pattern=pattern, path_params=path_params))
            return endpoint

        return decorator

    async def request(
        self,
        method: str,
        path: str,
        json: Any | None = None,
        headers: dict[str, str] | None = None,
        client_host: str = "testclient",
    ) -> Response:
        request = Request(
            method=method.upper(),
            url=URL(path=path),
            headers={key.lower(): value for key, value in (headers or {}).items()},
            client=Client(host=client_host),
        )

        async def endpoint_handler(current_request: Request) -> Response:
            return await self._dispatch(current_request, json)

        handler = endpoint_handler
        for middleware in reversed(self._http_middleware):
            next_handler = handler

            async def wrapped(
                current_request: Request,
                current_middleware: Callable[
                    [Request, Callable[[Request], Awaitable[Response]]],
                    Awaitable[Response],
                ] = middleware,
                current_next: Callable[[Request], Awaitable[Response]] = next_handler,
            ) -> Response:
                return await current_middleware(current_request, current_next)

            handler = wrapped
        try:
            return await handler(request)
        except HTTPException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                body={"detail": exc.detail},
                headers=dict(exc.headers),
            )
        except ValidationError as exc:
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                body={"detail": json.loads(exc.json())},
                headers={},
            )
        except Exception as exc:  # pragma: no cover - exercised in focused tests
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                body={"detail": str(exc)},
                headers={},
            )

    async def _dispatch(self, request: Request, payload: Any | None) -> Response:
        route, path_values = self._match(request.method, request.url.path)
        if route is None:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                body={"detail": "Not found"},
                headers={},
            )
        try:
            kwargs = await self._coerce_arguments(route.endpoint, path_values, payload, request)
            result = await route.endpoint(**kwargs)
            if isinstance(result, Response):
                return result
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                body=_serialize(result),
                headers={},
            )
        except HTTPException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                body={"detail": exc.detail},
                headers=dict(exc.headers),
            )
        except ValidationError as exc:
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                body={"detail": json.loads(exc.json())},
                headers={},
            )
        except Exception as exc:  # pragma: no cover - exercised in focused tests
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                body={"detail": str(exc)},
                headers={},
            )

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
        request: Request,
    ) -> dict[str, Any]:
        annotations = get_type_hints(endpoint)
        kwargs: dict[str, Any] = {}
        payload_assigned = False
        for name, value in path_values.items():
            kwargs[name] = value
        for param_name, annotation in annotations.items():
            if param_name == "return" or param_name in kwargs:
                continue
            if annotation is Request:
                kwargs[param_name] = request
                continue
            if payload is None or payload_assigned:
                continue
            if isinstance(payload, dict) and isinstance(annotation, type) and issubclass(annotation, BaseModel):
                kwargs[param_name] = annotation.model_validate(payload)
            else:
                kwargs[param_name] = payload
            payload_assigned = True
        return kwargs


def _serialize(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json", by_alias=True)
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize(item) for key, item in value.items()}
    return value
