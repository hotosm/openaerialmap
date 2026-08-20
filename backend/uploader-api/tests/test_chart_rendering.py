"""What the chart renders for the bundled database, and for workflow egress.

A chart upgrade that stops referencing the existing claim brings Postgres up
empty, and by the time anyone notices the old volume may be gone.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest
import yaml

CHART_DIR = Path(__file__).resolve().parent.parent / "chart"

pytestmark = pytest.mark.skipif(
    shutil.which("helm") is None, reason="helm is not installed"
)

# The name earlier chart versions used. Hard-coded so a refactor has to argue.
LEGACY_CLAIM_NAME = "oam-db-data"


# The chart won't render without these. Nothing to do with storage.
REQUIRED_VALUES = {
    "env__PGSTAC_DB_HOST": "pgstac.example.svc.cluster.local",
    "env__PGSTAC_DB_USER": "oam",
    "env__PGSTAC_DB_NAME": "postgis",
    "env__PUBLIC_ASSET_BASE_URL": "https://oin-hotosm.s3.amazonaws.com",
    # An external database is the chart default, and it insists on a secret.
    "existingSecret__name": "oam-uploader-secrets",
}


def render(**values) -> list[dict]:
    """Render the chart with `--set` overrides and return its documents."""
    values = {**REQUIRED_VALUES, **values}
    args = ["helm", "template", "oam", str(CHART_DIR)]
    for key, value in values.items():
        args += ["--set-json", f"{key.replace('__', '.')}={json.dumps(value)}"]
    out = subprocess.run(args, capture_output=True, text=True, check=True).stdout
    return [doc for doc in yaml.safe_load_all(out) if doc]


def of_kind(docs: list[dict], kind: str) -> list[dict]:
    return [doc for doc in docs if doc.get("kind") == kind]


def db_pod_spec(docs: list[dict]) -> dict:
    (sts,) = of_kind(docs, "StatefulSet")
    return sts["spec"]["template"]["spec"]


def data_volume(docs: list[dict]) -> dict:
    (data,) = (v for v in db_pod_spec(docs)["volumes"] if v["name"] == "data")
    return data


def test_no_database_objects_when_the_bundled_db_is_off():
    """An external database, so the chart owns no storage at all."""
    docs = render(db__enabled=False)
    assert of_kind(docs, "StatefulSet") == []
    assert of_kind(docs, "PersistentVolumeClaim") == []


def test_persistent_is_the_default_for_the_bundled_database():
    """Defaulting to ephemeral makes a chart upgrade lose the database."""
    docs = render(db__enabled=True)
    claims = of_kind(docs, "PersistentVolumeClaim")
    assert [c["metadata"]["name"] for c in claims] == [LEGACY_CLAIM_NAME]


def test_persistent_database_binds_the_claim_by_its_original_name():
    docs = render(db__enabled=True, db__primary__persistence__enabled=True)
    (claim,) = of_kind(docs, "PersistentVolumeClaim")
    assert claim["metadata"]["name"] == LEGACY_CLAIM_NAME
    # A volumeClaimTemplate would name it "data-oam-db-0" and orphan the real one.
    assert "volumeClaimTemplates" not in of_kind(docs, "StatefulSet")[0]["spec"]
    assert data_volume(docs)["persistentVolumeClaim"]["claimName"] == LEGACY_CLAIM_NAME
    assert claim["metadata"]["annotations"]["helm.sh/resource-policy"] == "keep"


def test_ephemeral_database_creates_no_claim():
    docs = render(db__enabled=True, db__primary__persistence__enabled=False)
    assert of_kind(docs, "PersistentVolumeClaim") == []
    assert data_volume(docs)["emptyDir"] == {}


@pytest.mark.parametrize(
    "existing",
    [
        # 0.2.0 used a volumeClaimTemplate, so its PVC has the other name.
        "data-oam-db-0",
        # A restored snapshot, or a volume provisioned outside Helm.
        "restored-oam-db",
    ],
)
def test_an_existing_claim_is_adopted_rather_than_recreated(existing):
    docs = render(
        db__enabled=True,
        db__primary__persistence__enabled=True,
        db__primary__persistence__existingClaim=existing,
    )
    assert of_kind(docs, "PersistentVolumeClaim") == []
    assert data_volume(docs)["persistentVolumeClaim"]["claimName"] == existing


def test_claim_size_and_storage_class_are_configurable():
    docs = render(
        db__enabled=True,
        db__primary__persistence__enabled=True,
        db__primary__persistence__size="50Gi",
        db__primary__persistence__storageClassName="fast",
    )
    (claim,) = of_kind(docs, "PersistentVolumeClaim")
    assert claim["spec"]["resources"]["requests"]["storage"] == "50Gi"
    assert claim["spec"]["storageClassName"] == "fast"


def test_the_database_still_mounts_where_postgres_expects_it():
    docs = render(db__enabled=True)
    (container,) = db_pod_spec(docs)["containers"]
    (mount,) = (m for m in container["volumeMounts"] if m["name"] == "data")
    assert mount["mountPath"] == "/var/lib/postgresql"


# Workflow egress: the second half of the SSRF guard.


# Different on every cluster, so the chart can't default it.
API_SERVER_CIDRS = ["10.96.0.1/32", "192.168.49.2/32"]


def test_no_network_policy_unless_asked_for():
    assert of_kind(render(), "NetworkPolicy") == []


def test_enabling_the_policy_without_apiserver_access_refuses_to_render():
    """Omitting it makes workflows hang rather than fail, so it has to be a
    loud error at install time."""
    with pytest.raises(subprocess.CalledProcessError) as err:
        render(workflowNetworkPolicy__enabled=True)
    assert "apiServerCIDRs" in err.value.stderr


def test_workflow_egress_allows_the_kubernetes_api():
    docs = render(
        workflowNetworkPolicy__enabled=True,
        workflowNetworkPolicy__apiServerCIDRs=API_SERVER_CIDRS,
    )
    (policy,) = of_kind(docs, "NetworkPolicy")
    allowed = {
        peer["ipBlock"]["cidr"]
        for rule in policy["spec"]["egress"]
        for peer in rule["to"]
        if "ipBlock" in peer
    }
    assert set(API_SERVER_CIDRS) <= allowed


def test_workflow_egress_blocks_private_ranges_but_not_dns_or_the_callback():
    docs = render(
        workflowNetworkPolicy__enabled=True,
        workflowNetworkPolicy__apiServerCIDRs=API_SERVER_CIDRS,
    )
    (policy,) = of_kind(docs, "NetworkPolicy")
    assert policy["spec"]["policyTypes"] == ["Egress"]
    # Argo labels each pod with the workflow name, so match on the key.
    assert policy["spec"]["podSelector"]["matchExpressions"][0] == {
        "key": "workflows.argoproj.io/workflow",
        "operator": "Exists",
    }

    rules = policy["spec"]["egress"]
    ports = [p["port"] for rule in rules for p in rule.get("ports", [])]
    assert 53 in ports, "DNS must still resolve"
    assert 8080 in ports, "status callbacks go to the uploader API"

    (internet,) = (
        peer["ipBlock"]
        for rule in rules
        for peer in rule["to"]
        if peer.get("ipBlock", {}).get("cidr") == "0.0.0.0/0"
    )
    for blocked in ("10.0.0.0/8", "169.254.0.0/16", "127.0.0.0/8"):
        assert blocked in internet["except"]


def test_extra_egress_covers_an_in_cluster_object_store():
    docs = render(
        workflowNetworkPolicy__enabled=True,
        workflowNetworkPolicy__apiServerCIDRs=API_SERVER_CIDRS,
        workflowNetworkPolicy__additionalEgress=[
            {"to": [{"ipBlock": {"cidr": "10.42.0.0/16"}}]}
        ],
    )
    (policy,) = of_kind(docs, "NetworkPolicy")
    assert policy["spec"]["egress"][-1]["to"][0]["ipBlock"]["cidr"] == "10.42.0.0/16"


def test_the_bundled_database_password_is_not_a_plain_pod_value():
    """`get pod` is a much commoner grant than `get secret`."""
    docs = render(db__enabled=True)
    (secret,) = of_kind(docs, "Secret")
    assert secret["stringData"]["password"]

    for doc in of_kind(docs, "StatefulSet") + of_kind(docs, "Deployment"):
        for container in doc["spec"]["template"]["spec"]["containers"]:
            for env in container.get("env", []):
                if "PASSWORD" in env["name"]:
                    assert "value" not in env, f"{env['name']} is a plain value"
                    assert (
                        env["valueFrom"]["secretKeyRef"]["name"]
                        == (secret["metadata"]["name"])
                    )


def test_an_operators_own_database_secret_is_used_instead():
    docs = render(db__enabled=True, db__auth__existingSecret="my-db-secret")
    assert of_kind(docs, "Secret") == [], "the chart should not create its own"
    (sts,) = of_kind(docs, "StatefulSet")
    (env,) = (
        e
        for e in sts["spec"]["template"]["spec"]["containers"][0]["env"]
        if e["name"] == "POSTGRES_PASSWORD"
    )
    assert env["valueFrom"]["secretKeyRef"]["name"] == "my-db-secret"
