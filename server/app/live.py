"""Совместная работа: комнаты пространств поверх WebSocket.

Кто открыл пространство — в его комнате. Сервер пересылает участникам:
  • присутствие: кто в комнате, где курсор, что выделено (не сохраняется);
  • новые правки: после каждого сохранения пространства — номер правки и содержимое.
Комнаты живут в памяти одного процесса. Для нескольких процессов сервера понадобится
общая шина (Redis pub/sub) — интерфейс publish_rev() для этого уже выделен.
"""
import asyncio
import json
from dataclasses import dataclass, field

from fastapi import WebSocket

COLORS = ["#F87171", "#FB923C", "#FACC15", "#4ADE80", "#60A5FA", "#C084FC", "#F472B6", "#2DD4BF"]


@dataclass
class Peer:
    ws: WebSocket
    sid: str              # вкладка (у одного человека может быть несколько)
    user_id: str
    name: str
    color: str
    role: str
    state: dict = field(default_factory=dict)     # курсор, выделение


class Hub:
    def __init__(self):
        self.rooms: dict[tuple[str, str], dict[str, Peer]] = {}
        self.loop: asyncio.AbstractEventLoop | None = None
        self._n = 0

    def color_for(self, user_id: str) -> str:
        return COLORS[sum(map(ord, user_id)) % len(COLORS)]

    def peers_info(self, key, except_sid=None):
        return [{"sid": p.sid, "uid": p.user_id, "name": p.name, "color": p.color, "role": p.role, **p.state}
                for p in self.rooms.get(key, {}).values() if p.sid != except_sid]

    async def join(self, key, peer: Peer):
        self.rooms.setdefault(key, {})[peer.sid] = peer
        await self.send(peer, {"t": "hello", "sid": peer.sid, "color": peer.color, "peers": self.peers_info(key, peer.sid)})
        await self.broadcast(key, {"t": "join", "sid": peer.sid, "uid": peer.user_id, "name": peer.name, "color": peer.color, "role": peer.role}, except_sid=peer.sid)

    async def leave(self, key, sid):
        room = self.rooms.get(key)
        if room and room.pop(sid, None):
            if not room:
                self.rooms.pop(key, None)
            await self.broadcast(key, {"t": "leave", "sid": sid})

    async def send(self, peer: Peer, msg: dict):
        try:
            await peer.ws.send_text(json.dumps(msg, ensure_ascii=False))
        except Exception:
            pass

    async def broadcast(self, key, msg: dict, except_sid=None):
        text = json.dumps(msg, ensure_ascii=False)
        for p in list(self.rooms.get(key, {}).values()):
            if p.sid == except_sid:
                continue
            try:
                await p.ws.send_text(text)
            except Exception:
                pass

    def publish_rev(self, org_id: str, space_id: str, msg: dict, except_sid: str | None = None):
        """Вызывается из обработчиков HTTP (в потоке): разослать новую правку всем в комнате."""
        key = (org_id, space_id)
        if self.loop and self.rooms.get(key):
            asyncio.run_coroutine_threadsafe(self.broadcast(key, msg, except_sid=except_sid), self.loop)

    def kick(self, org_id: str, user_id: str):
        """Закрыть соединения человека во всех пространствах организации (его убрали из организации)."""
        async def go():
            for (o, _s), room in list(self.rooms.items()):
                if o != org_id:
                    continue
                for p in list(room.values()):
                    if p.user_id == user_id:
                        try:
                            await p.ws.close(code=4403)
                        except Exception:
                            pass
        if self.loop:
            asyncio.run_coroutine_threadsafe(go(), self.loop)

    def online(self, org_id: str, space_id: str) -> int:
        return len(self.rooms.get((org_id, space_id), {}))


hub = Hub()
