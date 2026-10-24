import base64

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)
PNG = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\nsmall-logo").decode()


def payload():
    return {
        "header_elements": [{"id": "institution", "kind": "dynamic", "field": "institution_name", "x": 5, "y": 4, "width": 90, "height": 18, "align": "center", "font_size": 20, "bold": True, "visible": True}],
        "footer_elements": [{"id": "signature-1", "label": "Prepared By", "x": 5, "y": 20, "width": 27, "height": 65, "align": "center", "show_line": True}],
        "logo_data_url": PNG,
    }


def test_print_template_is_scoped_to_institution_and_persists():
    saved = client.put("/api/v1/academic/institutions/inst-northbridge/print-template", json=payload())
    assert saved.status_code == 200, saved.text
    assert saved.json()["institution_id"] == "inst-northbridge"
    assert saved.json()["logo_data_url"] == PNG
    loaded = client.get("/api/v1/academic/institutions/inst-northbridge/print-template")
    assert loaded.status_code == 200
    assert loaded.json()["header_elements"][0]["field"] == "institution_name"
    assert client.get("/api/v1/academic/institutions/inst-lakeside/print-template").json() is None
    assert client.delete("/api/v1/academic/institutions/inst-northbridge/print-template").status_code == 204


def test_print_template_rejects_unsafe_logo_and_out_of_bounds_elements():
    unsafe = {**payload(), "logo_data_url": "data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Lz48L3N2Zz4="}
    assert client.put("/api/v1/academic/institutions/inst-northbridge/print-template", json=unsafe).status_code == 422
    invalid = {**payload(), "header_elements": [{**payload()["header_elements"][0], "x": 90, "width": 20}]}
    assert client.put("/api/v1/academic/institutions/inst-northbridge/print-template", json=invalid).status_code == 422
    overlapping = {**payload(), "header_elements": [payload()["header_elements"][0], {**payload()["header_elements"][0], "id": "second", "y": 10}]}
    assert client.put("/api/v1/academic/institutions/inst-northbridge/print-template", json=overlapping).status_code == 422
