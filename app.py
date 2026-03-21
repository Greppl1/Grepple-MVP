from __future__ import annotations

from reward_system.main import create_app as create_reward_app
from scoring_engine.main import create_app as create_scoring_app

try:
    from fastapi import FastAPI  # type: ignore
    from fastapi.routing import APIRoute  # type: ignore
except ImportError:  # pragma: no cover - exercised in local environment
    from scoring_engine.compat.fastapi import FastAPI

    APIRoute = None


def _copy_routes(target: FastAPI, source: FastAPI) -> None:
    if hasattr(source, "_routes"):
        target._routes.extend(source._routes)  # type: ignore[attr-defined]
        return

    if APIRoute is None:  # pragma: no cover - defensive fallback
        return

    for route in source.router.routes:  # type: ignore[attr-defined]
        if not isinstance(route, APIRoute):
            continue
        target.add_api_route(
            route.path,
            route.endpoint,
            methods=list(route.methods or []),
            name=route.name,
            response_model=route.response_model,
        )


def create_app() -> FastAPI:
    app = FastAPI(title="Grepple Unified API")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    _copy_routes(app, create_scoring_app())
    _copy_routes(app, create_reward_app())
    return app


app = create_app()
