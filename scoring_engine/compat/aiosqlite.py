from __future__ import annotations

import asyncio
import sqlite3
from pathlib import Path
from typing import Any


class Cursor:
    def __init__(self, rows: list[sqlite3.Row], rowcount: int = -1) -> None:
        self._rows = rows
        self.rowcount = rowcount

    async def fetchone(self) -> sqlite3.Row | None:
        return self._rows[0] if self._rows else None

    async def fetchall(self) -> list[sqlite3.Row]:
        return list(self._rows)


class Connection:
    def __init__(self, path: str | Path) -> None:
        self._connection = sqlite3.connect(path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row

    async def execute(self, sql: str, parameters: tuple[Any, ...] = ()) -> Cursor:
        def _execute() -> Cursor:
            cursor = self._connection.execute(sql, parameters)
            rows = cursor.fetchall() if cursor.description else []
            return Cursor(rows=rows, rowcount=cursor.rowcount)

        return await asyncio.to_thread(_execute)

    async def executemany(self, sql: str, seq_of_parameters: list[tuple[Any, ...]]) -> Cursor:
        def _executemany() -> Cursor:
            cursor = self._connection.executemany(sql, seq_of_parameters)
            return Cursor(rows=[], rowcount=cursor.rowcount)

        return await asyncio.to_thread(_executemany)

    async def commit(self) -> None:
        await asyncio.to_thread(self._connection.commit)

    async def close(self) -> None:
        await asyncio.to_thread(self._connection.close)


async def connect(path: str | Path) -> Connection:
    return Connection(path)
