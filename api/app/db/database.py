import os
import aiosqlite

DB_PATH = os.path.join(os.path.dirname(__file__), "../../db/phoneix.db")


class Database:
    def __init__(self):
        self._db = None

    async def connect(self):
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        self._db = await aiosqlite.connect(DB_PATH)
        self._db.row_factory = aiosqlite.Row
        await self._init_tables()

    async def _init_tables(self):
        await self._db.execute("""
            CREATE TABLE IF NOT EXISTS now (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project TEXT NOT NULL,
                description TEXT NOT NULL,
                started TEXT NOT NULL,
                tags TEXT,
                updated_at TEXT NOT NULL
            )
        """)
        await self._db.commit()

    async def fetchone(self, query: str, params=()):
        async with self._db.execute(query, params) as cursor:
            return await cursor.fetchone()

    async def execute(self, query: str, params=()):
        await self._db.execute(query, params)
        await self._db.commit()

    async def close(self):
        if self._db:
            await self._db.close()


_db = Database()


async def get_db():
    return _db


async def init_db():
    await _db.connect()


async def close_db():
    await _db.close()
