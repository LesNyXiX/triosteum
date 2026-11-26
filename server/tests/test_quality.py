"""Серверный процесс ОТК на настоящем PostgreSQL."""
from io import BytesIO

from openpyxl import Workbook

from conftest import register
from test_orglib import member
from test_team import new_client

BASE = "/api/quality/otk"
CHECK = {"article": "Арт-17", "lot": "Партия-1", "inspected": 100, "defects": 4}
MAP = {"article": "Модель", "lot": "Лот", "inspected": "Количество", "defects": "Брак"}


def add_space(client, space="otk"):
    res = client.put("/api/spaces/" + space, json={"name": "Участок контроля", "content": {}, "rev": 0})
    assert res.status_code in (200, 201), res.text


def user_id(client):
    return client.get("/api/me").json()["user"]["id"]


def setup_quality(client):
    register(client)
    add_space(client)
    reviewer = member(client, client, "approver")
    controller = member(client, client, "viewer")
    settings = {"reviewer_id": user_id(reviewer), "contributors": [user_id(controller)], "threshold": 2, "due_hours": 1}
    res = client.put(BASE + "/settings", json=settings)
    assert res.status_code == 200, res.text
    return reviewer, controller, settings


def test_route_roles_decisions_and_duplicates(client):
    reviewer, controller, settings = setup_quality(client)
    outsider = member(client, client)
    assert outsider.get(BASE).status_code == 403
    assert reviewer.post(BASE + "/cases", json=CHECK).status_code == 403
    assert controller.put(BASE + "/settings", json=settings).status_code == 403
    photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+Xl1sAAAAASUVORK5CYII="
    response = controller.post(BASE + "/cases", json={**CHECK, "photo": photo})
    assert response.status_code == 201, response.text
    created = response.json()["case"]
    assert created["status"] == "pending" and created["due_at"] and created["percent"] == 4
    assert created["reviewer_name"] == "Коллега"
    case = BASE + "/cases/" + str(created["id"])
    assert controller.get(case + "/photo").headers["content-type"] == "image/png"
    assert outsider.get(case + "/photo").status_code == 403
    assert controller.post(BASE + "/cases", json={**CHECK, "lot": "партия-1"}).json() == {"duplicate": True}
    assert reviewer.get(BASE, params={"mine": True}).json()["counts"]["mine"] == 1
    decision = {"revision": 1, "action": "returned", "comment": "Уточните число проверенных"}
    assert controller.post(case + "/decision", json=decision).status_code == 403
    assert reviewer.post(case + "/decision", json=decision).json()["status"] == "returned"
    assert reviewer.post(case + "/decision", json=decision).status_code == 409
    correction = {"revision": 2, "inspected": 120, "defects": 4, "note": "Уточнили"}
    assert reviewer.post(case + "/resubmit", json=correction).status_code == 403
    assert controller.post(case + "/resubmit", json=correction).json()["status"] == "pending"
    approval = reviewer.post(case + "/decision", json={"revision": 3, "action": "approved", "comment": "Акт принят"})
    assert approval.status_code == 200, approval.text
    assert [e["action"] for e in approval.json()["history"]] == ["pending", "returned", "resubmitted", "approved"]
    within = controller.post(BASE + "/cases", json={**CHECK, "lot": "Партия-2", "defects": 2}).json()["case"]
    assert within["status"] == "within_limit" and within["reviewer_id"] is None
    assert reviewer.get(BASE, params={"mine": True}).json()["cases"] == []
    assert client.put(BASE + "/settings", json={**settings, "contributors": []}).status_code == 200
    assert controller.get(case).status_code == 403
    assert controller.post(BASE + "/cases", json=CHECK).status_code == 403


def test_csv_xlsx_and_remembered_mapping(client):
    _, controller, _ = setup_quality(client)
    csv = "Модель;Лот;Количество;Брак\nКуртка;10;100;4\nКуртка;11;1;2\nКуртка;10;100;4".encode()
    preview = client.post(BASE + "/import/preview?kind=csv", content=csv)
    assert preview.status_code == 200, preview.text
    assert preview.json()["headers"] == list(MAP.values())
    command = {"rows": preview.json()["rows"], "mapping": MAP, "save_mapping": True}
    assert controller.post(BASE + "/import", json=command).status_code == 403
    result = client.post(BASE + "/import", json=command).json()
    assert [r["status"] for r in result["rows"]] == ["created", "error", "duplicate"]
    workbook = Workbook()
    workbook.active.append(list(MAP.values()))
    workbook.active.append(["Брюки", 12, 40, 1])
    stream = BytesIO()
    workbook.save(stream)
    xlsx = controller.post(BASE + "/import/preview?kind=xlsx", content=stream.getvalue())
    assert xlsx.status_code == 200, xlsx.text
    assert xlsx.json()["mapping"] == MAP
    command = {"rows": xlsx.json()["rows"], "mapping": MAP}
    assert controller.post(BASE + "/import", json=command).json()["rows"][0]["status"] == "created"
    assert controller.post(BASE + "/import", json=command).json()["rows"][0]["status"] == "duplicate"
    assert len(client.get(BASE).json()["cases"]) == 2


def test_organization_and_space_isolation(client):
    _, controller, settings = setup_quality(client)
    case = controller.post(BASE + "/cases", json=CHECK).json()["case"]["id"]
    add_space(client, "other")
    assert controller.get("/api/quality/other").status_code == 403
    assert client.get(f"/api/quality/other/cases/{case}").status_code == 404
    stranger = new_client(client)
    register(stranger)
    add_space(stranger)
    assert stranger.put(BASE + "/settings", json=settings).status_code == 422
    assert stranger.get(f"{BASE}/cases/{case}").status_code == 404
    visitor = new_client(client)
    page = visitor.get("/quality/otk?view=form", follow_redirects=False)
    assert page.status_code == 302 and page.headers["location"] == "/login?next=%2Fquality%2Fotk%3Fview%3Dform"
    assert controller.get("/quality/otk?view=form").status_code == 200


def test_inactive_reviewer_keeps_submissions_in_register(client, admin):
    reviewer, controller, settings = setup_quality(client)
    uid = user_id(reviewer)
    client.post(BASE + "/cases", json=CHECK)
    admin.execute("UPDATE users SET disabled=true WHERE id=%s", (uid,))
    another = controller.post(BASE + "/cases", json={**CHECK, "lot": "Партия-2"})
    assert another.status_code == 201, another.text
    assert another.json()["case"]["reviewer_id"] is None
    assert client.get(BASE).json()["counts"]["unassigned"] == 2
    replacement = member(client, client, "approver")
    updated = client.put(BASE + "/settings", json={**settings, "reviewer_id": user_id(replacement)})
    assert updated.status_code == 200, updated.text
    assert client.get(BASE).json()["counts"]["unassigned"] == 0
    assert replacement.get(BASE, params={"mine": True}).json()["counts"]["mine"] == 2
