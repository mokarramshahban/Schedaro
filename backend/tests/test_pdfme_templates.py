from fastapi.testclient import TestClient

from app.main import app
from tests.test_data import AcademicFixture


def template():
    return {"basePdf": {"width": 297, "height": 210, "padding": [8, 8, 8, 8]}, "schemas": [[{"name": "institution_name", "type": "text", "position": {"x": 10, "y": 10}, "width": 100, "height": 10}]]}


def test_pdfme_templates_are_multiple_and_institution_scoped(academic_fixture: AcademicFixture):
    client = TestClient(app); fixture = academic_fixture
    first = client.post(f"/api/v1/academic/institutions/{fixture.institution_a_id}/print-templates", json={"name": "Standard", "template": template(), "is_default": True})
    assert first.status_code == 201, first.text
    second = client.post(f"/api/v1/academic/institutions/{fixture.institution_a_id}/print-templates", json={"name": "Letterhead", "template": template()})
    assert second.status_code == 201, second.text
    assert len(client.get(f"/api/v1/academic/institutions/{fixture.institution_a_id}/print-templates").json()) >= 2
    assert client.get(f"/api/v1/academic/institutions/{fixture.institution_b_id}/print-templates").json() == []
    updated = client.put(f"/api/v1/academic/institutions/{fixture.institution_a_id}/print-templates/{second.json()['id']}", json={"name": "Letterhead", "template": template(), "is_default": True})
    assert updated.status_code == 200 and updated.json()["is_default"] is True and updated.json()["template"] == template()
    assert client.delete(f"/api/v1/academic/institutions/{fixture.institution_a_id}/print-templates/{first.json()['id']}").status_code == 200


def test_pdfme_templates_reject_non_landscape_and_unsafe_schema_types(academic_fixture: AcademicFixture):
    client = TestClient(app); institution_id = academic_fixture.institution_a_id
    wrong_page = {"basePdf": {"width": 210, "height": 297}, "schemas": [[]]}
    assert client.post(f"/api/v1/academic/institutions/{institution_id}/print-templates", json={"name": "Bad", "template": wrong_page}).status_code == 422
    unsafe = {"basePdf": {"width": 297, "height": 210}, "schemas": [[{"name": "x", "type": "html", "position": {"x": 0, "y": 0}, "width": 10, "height": 10}]]}
    assert client.post(f"/api/v1/academic/institutions/{institution_id}/print-templates", json={"name": "Bad", "template": unsafe}).status_code == 422
    unsafe_asset = {"basePdf": {"width": 297, "height": 210}, "schemas": [[]], "__schedaroAssets": {"letterhead": "data:image/svg+xml;base64,PHN2Zz4="}}
    assert client.post(f"/api/v1/academic/institutions/{institution_id}/print-templates", json={"name": "Bad", "template": unsafe_asset}).status_code == 422
