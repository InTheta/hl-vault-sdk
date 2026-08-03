import json
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

ROOT = Path(__file__).parents[2]


def test_manifest_json_schema_is_valid() -> None:
    schema = json.loads((ROOT / "schemas" / "integration-manifest-v1.schema.json").read_text())
    Draft202012Validator.check_schema(schema)
    assert schema["properties"]["schema"]["const"] == schema["$id"]


def test_openapi_has_required_external_terminal_surface() -> None:
    document = yaml.safe_load((ROOT / "openapi" / "v1.yaml").read_text())
    assert document["openapi"] == "3.1.0"
    paths = document["paths"]
    for path in (
        "/v1/integration/manifest",
        "/v1/vaults",
        "/v1/auth/challenge",
        "/v1/auth/agent-challenge",
        "/v1/orders",
        "/v1/orders/batch",
        "/v1/cancels/all",
        "/v1/twaps",
    ):
        assert path in paths
