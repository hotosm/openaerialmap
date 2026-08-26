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


def seed_container(docs: list[dict]) -> dict:
    (job,) = (
        j for j in of_kind(docs, "Job") if j["metadata"]["name"].endswith("-seed")
    )
    (container,) = job["spec"]["template"]["spec"]["containers"]
    return container


def seed_env(docs: list[dict]) -> dict:
    return {e["name"]: e.get("value") for e in seed_container(docs)["env"]}


def test_no_seed_job_by_default():
    assert of_kind(render(), "Job") == []


def test_the_seed_job_runs_after_the_app_is_up():
    docs = render(seed__enabled=True)
    (job,) = of_kind(docs, "Job")
    annotations = job["metadata"]["annotations"]
    assert annotations["helm.sh/hook"] == "post-install,post-upgrade"
    assert annotations["helm.sh/hook-delete-policy"] == "before-hook-creation"


def test_the_seed_job_takes_its_destination_from_the_app_config():
    docs = render(
        seed__enabled=True,
        env__S3_BUCKET="oin-hotosm-staging",
        env__STAC_COLLECTION="openaerialmap",
    )
    env = seed_env(docs)
    assert env["S3_BUCKET"] == "oin-hotosm-staging"
    assert env["PUBLIC_ASSET_BASE_URL"] == REQUIRED_VALUES["env__PUBLIC_ASSET_BASE_URL"]
    assert env["PGSTAC_DB_HOST"] == REQUIRED_VALUES["env__PGSTAC_DB_HOST"]
    assert env["SEED_COLLECTION"] == "openaerialmap"
    (secret_ref,) = seed_container(docs)["envFrom"]
    assert secret_ref["secretRef"]["name"] == REQUIRED_VALUES["existingSecret__name"]


def test_the_seed_job_defaults_to_collections_only():
    assert seed_env(render(seed__enabled=True))["SEED_MAX_ITEMS"] == "0"


def test_the_seed_job_refuses_to_render_without_a_source():
    with pytest.raises(subprocess.CalledProcessError) as exc:
        render(seed__enabled=True, seed__stacUrl="")
    assert "seed.stacUrl" in exc.value.stderr


def test_the_seed_job_refuses_to_render_without_a_collection():
    with pytest.raises(subprocess.CalledProcessError) as exc:
        render(seed__enabled=True, env__STAC_COLLECTION="")
    assert "seed.collection" in exc.value.stderr


def test_the_seed_job_refuses_to_render_without_a_public_asset_base():
    """
    The seeder rewrites copied hrefs onto PUBLIC_ASSET_BASE_URL. Empty, it
    writes relative hrefs into pgstac - a catalogue that renders nothing and
    has to be reseeded to fix. S3_EXTERNAL_ENDPOINT satisfies the app but not
    this, so the two guards are not the same guard.
    """
    with pytest.raises(subprocess.CalledProcessError) as exc:
        render(
            seed__enabled=True,
            env__PUBLIC_ASSET_BASE_URL="",
            env__S3_EXTERNAL_ENDPOINT="https://s3.example.org",
        )
    assert "PUBLIC_ASSET_BASE_URL" in exc.value.stderr


# --- Bundled object store ---------------------------------------------------
#
# The trap this guards is a store the app cannot reach or authenticate against:
# a service name derived the wrong way, credentials that only match by accident,
# or a public URL baked into STAC items that resolves nowhere.

# Enough to render the store. PUBLIC_ASSET_BASE_URL is cleared so the tests can
# see what the chart derives rather than what REQUIRED_VALUES supplies.
RUSTFS_VALUES = {
    "env__PUBLIC_ASSET_BASE_URL": "",
    "s3__rustfs__enabled": True,
    "s3__rustfs__ingress__enabled": True,
    "s3__rustfs__ingress__host": "s3.stage.imagery.hotosm.org",
    "s3__rustfs__ingress__tls__enabled": True,
    "rustfs__storageclass__name": "gp3-ephemeral",
}


def render_rustfs(**values) -> list[dict]:
    return render(**{**RUSTFS_VALUES, **values})


def app_env(docs: list[dict]) -> dict:
    (deploy,) = (
        d
        for d in of_kind(docs, "Deployment")
        if d["metadata"]["labels"].get("app.kubernetes.io/component") == "backend"
    )
    (container,) = deploy["spec"]["template"]["spec"]["containers"]
    return {e["name"]: e.get("value") for e in container["env"]}


def bucket_init_env(docs: list[dict]) -> dict:
    (job,) = (
        j
        for j in of_kind(docs, "Job")
        if j["metadata"]["name"].endswith("-bucket-init")
    )
    (container,) = job["spec"]["template"]["spec"]["containers"]
    return {e["name"]: e.get("value") for e in container["env"]}


def test_no_object_store_unless_asked_for():
    """Production stores imagery in the real OIN buckets."""
    docs = render()
    assert [d["metadata"]["name"] for d in of_kind(docs, "Deployment")] == [
        "oam-uploader-api"
    ]
    assert of_kind(docs, "PersistentVolumeClaim") == []


def test_the_store_keeps_its_claim_in_the_manifest_set():
    """
    Distributed mode would put the data on a StatefulSet volumeClaimTemplate,
    whose PVC no GitOps prune can see - a torn-down environment would leave its
    imagery, and its bill, behind.
    """
    docs = render_rustfs()
    (claim,) = of_kind(docs, "PersistentVolumeClaim")
    assert claim["metadata"]["name"] == "oam-rustfs-data"
    assert claim["spec"]["storageClassName"] == "gp3-ephemeral"
    assert not [
        s for s in of_kind(docs, "StatefulSet") if "rustfs" in s["metadata"]["name"]
    ]


def test_the_store_logs_to_stdout_rather_than_a_second_volume():
    """A logs PVC on an ephemeral environment is litter a collector replaces."""
    claims = of_kind(render_rustfs(), "PersistentVolumeClaim")
    assert [c["metadata"]["name"] for c in claims] == ["oam-rustfs-data"]


def test_the_app_points_at_the_stores_real_service_name():
    """
    The subchart suffixes its Service with "-svc". Deriving the host as
    "<release>-rustfs" instead gives a name that does not resolve, and every
    upload fails on a DNS error.
    """
    docs = render_rustfs()
    service_names = [s["metadata"]["name"] for s in of_kind(docs, "Service")]
    assert "oam-rustfs-svc" in service_names
    assert app_env(docs)["S3_ENDPOINT"] == (
        "http://oam-rustfs-svc.default.svc.cluster.local:9000"
    )


def test_a_release_named_after_the_store_still_resolves():
    """
    The subchart drops the suffix when the release name already contains the
    chart name, so a naive "<release>-rustfs" would be wrong here.
    """
    values = {**RUSTFS_VALUES}
    args = ["helm", "template", "rustfs-oam", str(CHART_DIR)]
    for key, value in {**REQUIRED_VALUES, **values}.items():
        args += ["--set-json", f"{key.replace('__', '.')}={json.dumps(value)}"]
    out = subprocess.run(args, capture_output=True, text=True, check=True).stdout
    docs = [doc for doc in yaml.safe_load_all(out) if doc]
    service_names = [s["metadata"]["name"] for s in of_kind(docs, "Service")]
    assert "rustfs-oam-svc" in service_names
    assert app_env(docs)["S3_ENDPOINT"].startswith("http://rustfs-oam-svc.")


def test_asset_urls_are_derived_from_the_public_ingress():
    """
    STAC items store absolute hrefs. Point them at the service DNS and the
    catalogue is unreadable from anywhere outside the cluster.
    """
    env = app_env(render_rustfs(env__S3_BUCKET="oam-staging"))
    assert env["S3_EXTERNAL_ENDPOINT"] == "https://s3.stage.imagery.hotosm.org"
    # Path-style, matching app/uploads/s3.py: the bucket is part of the path.
    assert env["PUBLIC_ASSET_BASE_URL"] == (
        "https://s3.stage.imagery.hotosm.org/oam-staging"
    )


def test_explicit_s3_settings_win_over_the_derived_ones():
    """Keeping the bundled store while serving assets from a CDN."""
    env = app_env(
        render_rustfs(env__PUBLIC_ASSET_BASE_URL="https://cdn.example.org/imagery")
    )
    assert env["PUBLIC_ASSET_BASE_URL"] == "https://cdn.example.org/imagery"
    assert env["S3_ENDPOINT"] == "http://oam-rustfs-svc.default.svc.cluster.local:9000"


def test_the_bundled_store_refuses_an_endpoint_pointing_somewhere_else():
    """
    The bucket-init hook creates a bucket and replaces its whole bucket policy
    at whatever S3_ENDPOINT names. Deployed with the bundled store, an endpoint
    override is either a mistake or a way to make someone else's bucket world
    readable, so it is not a configuration this chart renders.
    """
    with pytest.raises(subprocess.CalledProcessError) as exc:
        render_rustfs(env__S3_ENDPOINT="http://someone-elses-store:9000")
    assert "S3_ENDPOINT" in exc.value.stderr


def test_a_store_with_no_public_address_refuses_to_render():
    """Without one there is nothing to presign against and no valid asset href."""
    with pytest.raises(subprocess.CalledProcessError) as exc:
        render_rustfs(s3__rustfs__ingress__enabled=False)
    assert "PUBLIC_ASSET_BASE_URL" in exc.value.stderr


def test_the_s3_ingress_serves_the_api_port_not_the_console():
    """
    The subchart ships an ingress of its own that backs onto the console port,
    which speaks no S3. Routing uploads there returns HTML.
    """
    (ingress,) = (
        i
        for i in of_kind(render_rustfs(), "Ingress")
        if i["metadata"]["name"].endswith("-s3")
    )
    (rule,) = ingress["spec"]["rules"]
    assert rule["host"] == "s3.stage.imagery.hotosm.org"
    (path,) = rule["http"]["paths"]
    backend = path["backend"]["service"]
    assert backend["name"] == "oam-rustfs-svc"
    assert backend["port"] == {"name": "endpoint"}
    # Imagery is PUT straight here, so the API's small-body limit must not apply.
    assert (
        ingress["metadata"]["annotations"][
            "nginx.ingress.kubernetes.io/proxy-body-size"
        ]
        == "0"
    )


def test_the_subcharts_own_ingress_stays_off():
    """Two ingresses on one hostname, one of them serving the console."""
    hosts = [
        rule["host"]
        for i in of_kind(render_rustfs(), "Ingress")
        for rule in i["spec"]["rules"]
    ]
    assert sorted(hosts) == ["s3.stage.imagery.hotosm.org"]


def test_the_bucket_is_created_before_the_seed_job_copies_into_it():
    """RustFS starts with no buckets, so seeding first has nowhere to write."""
    docs = render_rustfs(seed__enabled=True)
    weights = {
        j["metadata"]["name"].rsplit("-", 1)[-1]: int(
            j["metadata"]["annotations"]["helm.sh/hook-weight"]
        )
        for j in of_kind(docs, "Job")
    }
    assert weights["init"] < weights["seed"]


def test_bucket_init_allows_uploads_from_the_apps_own_origin():
    """
    The browser presigns and PUTs cross-origin, from the page the API serves.
    Without that origin on the bucket every upload fails its preflight.
    """
    env = bucket_init_env(
        render_rustfs(
            ingress__enabled=True,
            ingress__host="upload.stage.imagery.hotosm.org",
            ingress__tls__enabled=True,
        )
    )
    assert env["INIT_CORS_ORIGINS"] == "https://upload.stage.imagery.hotosm.org"
    assert env["INIT_PUBLIC_READ"] == "true"
    assert env["S3_ENDPOINT"] == "http://oam-rustfs-svc.default.svc.cluster.local:9000"


def test_bucket_init_leaves_cors_alone_when_nothing_is_cross_origin():
    """No API ingress means no browser origin to allow."""
    assert bucket_init_env(render_rustfs())["INIT_CORS_ORIGINS"] == ""


def store_pod(docs: list[dict]) -> dict:
    (deploy,) = (
        d for d in of_kind(docs, "Deployment") if "rustfs" in d["metadata"]["name"]
    )
    return deploy["spec"]["template"]["spec"]["containers"][0]


def test_the_store_reads_the_apps_own_credentials_without_copying_them():
    """
    Mapped rather than duplicated: a second copy is a second thing to keep in
    step, and drift shows up only as a runtime 403.
    """
    docs = render_rustfs()
    assert store_pod(docs)["env"] == [
        {
            "name": "RUSTFS_ACCESS_KEY",
            "valueFrom": {
                "secretKeyRef": {"name": "oam-s3-creds", "key": "S3_ACCESS_KEY"}
            },
        },
        {
            "name": "RUSTFS_SECRET_KEY",
            "valueFrom": {
                "secretKeyRef": {"name": "oam-s3-creds", "key": "S3_SECRET_KEY"}
            },
        },
    ]
    # No second copy of the material anywhere, and no keypair of the store's own.
    assert of_kind(docs, "Secret") == []


def test_nothing_needs_adding_to_the_apps_s3_secret():
    """An existing (possibly sealed) secret works untouched."""
    docs = render_rustfs(
        s3Secret__create=True,
        s3Secret__accessKeyId="key",
        s3Secret__secretAccessKey="secret",
    )
    (secret,) = of_kind(docs, "Secret")
    assert secret["stringData"] == {"S3_ACCESS_KEY": "key", "S3_SECRET_KEY": "secret"}


def test_a_renamed_s3_secret_without_a_remap_refuses_to_render():
    """The names are repeated in extraEnv, so drift has to be caught here."""
    with pytest.raises(subprocess.CalledProcessError) as exc:
        render_rustfs(s3Secret__name="my-creds")
    assert 'gives the app "my-creds"' in exc.value.stderr


def test_renamed_s3_secret_keys_without_a_remap_refuse_to_render():
    with pytest.raises(subprocess.CalledProcessError) as exc:
        render_rustfs(s3Secret__accessKeyIdKey="ACCESS_KEY")
    assert 'key "ACCESS_KEY"' in exc.value.stderr


def test_mapping_only_half_the_keypair_refuses_to_render():
    with pytest.raises(subprocess.CalledProcessError) as exc:
        render_rustfs(
            rustfs__extraEnv=[
                {
                    "name": "RUSTFS_ACCESS_KEY",
                    "valueFrom": {
                        "secretKeyRef": {
                            "name": "oam-s3-creds",
                            "key": "S3_ACCESS_KEY",
                        }
                    },
                }
            ]
        )
    assert "only one of" in exc.value.stderr


def test_a_consistently_renamed_secret_renders():
    """The mapping is overridable, as long as it stays pointed at s3Secret."""
    docs = render_rustfs(
        s3Secret__name="my-creds",
        rustfs__secret__existingSecret="my-creds",
        rustfs__extraEnv=[
            {
                "name": name,
                "valueFrom": {"secretKeyRef": {"name": "my-creds", "key": key}},
            }
            for name, key in (
                ("RUSTFS_ACCESS_KEY", "S3_ACCESS_KEY"),
                ("RUSTFS_SECRET_KEY", "S3_SECRET_KEY"),
            )
        ],
    )
    refs = [e["valueFrom"]["secretKeyRef"]["name"] for e in store_pod(docs)["env"]]
    assert refs == ["my-creds", "my-creds"]


def test_dropping_the_mapping_entirely_is_allowed():
    """The escape hatch for a secret that already carries RUSTFS_* keys."""
    docs = render_rustfs(rustfs__extraEnv=[])
    assert "env" not in store_pod(docs)


def test_workflow_egress_reaches_the_bundled_store():
    """
    The store sits on a cluster address, which is exactly what the egress policy
    exists to deny. Without this rule the convert step cannot read its input.
    """
    docs = render_rustfs(
        workflowNetworkPolicy__enabled=True,
        workflowNetworkPolicy__apiServerCIDRs=["10.0.0.1/32"],
    )
    (policy,) = of_kind(docs, "NetworkPolicy")
    selectors = [
        peer["podSelector"]["matchLabels"]
        for rule in policy["spec"]["egress"]
        for peer in rule.get("to", [])
        if "podSelector" in peer
    ]
    assert {
        "app.kubernetes.io/name": "rustfs",
        "app.kubernetes.io/instance": "oam",
    } in (selectors)
