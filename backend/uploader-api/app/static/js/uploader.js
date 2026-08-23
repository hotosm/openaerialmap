const PART_SIZE = 100 * 1024 * 1024; // 100 MiB

async function postJSON(url, body) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed: ${resp.status}`);
  }
  return resp.json();
}

function setProgress(fraction, label) {
  const wrap = document.getElementById("upload-progress");
  wrap.hidden = false;
  document.getElementById("progress-bar").value = Math.round(fraction * 100);
  document.getElementById("progress-label").textContent = label;
}

function fieldValue(form, name) {
  const el = form.querySelector(`[name="${name}"]`);
  return el && el.value != null ? el.value : "";
}

// Fields a prefill link may set. All of them are shown for confirmation first.
const PREFILL_FIELDS = [
  "title",
  "provider",
  "platform",
  "license",
  "acquisition_start",
  "acquisition_end",
  "sensor",
  "contact",
  "product_type",
  "external_id",
  "external_url",
  "source_url",
];

// Date inputs only hold YYYY-MM-DD, so a prefilled timestamp would lose its
// time. Keep the original and reuse it unless the user edits the date.
const DATE_FIELDS = ["acquisition_start", "acquisition_end"];

function setFieldValue(el, value) {
  // The attribute too: a custom element that has not upgraded yet would
  // otherwise overwrite the property during its own initialisation.
  el.setAttribute("value", value);
  el.value = value;
}

// Prefer the fragment: it never reaches the server, so a presigned source_url
// stays out of access and ingress logs. A query string still works.
function handoffParams() {
  const fragment = window.location.hash.replace(/^#\/?/, "");
  const fromFragment = new URLSearchParams(fragment);
  if (PREFILL_FIELDS.some((name) => fromFragment.get(name))) return fromFragment;
  return new URLSearchParams(window.location.search);
}

// Leaving source_url in the address bar leaves it in history and bookmarks.
function scrubHandoffUrl() {
  if (!window.location.search && !window.location.hash) return;
  window.history.replaceState(null, "", window.location.pathname);
}

function applyPrefill(form) {
  const params = handoffParams();
  for (const name of PREFILL_FIELDS) {
    const raw = params.get(name);
    if (raw == null || raw === "") continue;
    const el = form.querySelector(`[name="${name}"]`);
    if (!el) continue;
    if (DATE_FIELDS.includes(name)) {
      const datePart = raw.slice(0, 10);
      // Keep the full value so an untouched field does not lose its time.
      el.dataset.prefillIso = raw;
      el.dataset.prefillDate = datePart;
      setFieldValue(el, datePart);
    } else {
      setFieldValue(el, raw);
    }
  }
  const sourceUrl = params.get("source_url") || "";
  scrubHandoffUrl();
  return sourceUrl;
}

// Restore a prefilled timestamp when the user left the date alone.
function dateFieldValue(form, name) {
  const el = form.querySelector(`[name="${name}"]`);
  if (!el) return "";
  const current = el.value || "";
  if (el.dataset.prefillIso && current === el.dataset.prefillDate) {
    return el.dataset.prefillIso;
  }
  return current;
}

function collectMetadata(form) {
  return {
    title: fieldValue(form, "title").trim(),
    provider: fieldValue(form, "provider").trim(),
    platform: fieldValue(form, "platform"),
    product_type: fieldValue(form, "product_type"),
    license: fieldValue(form, "license"),
    acquisition_start: dateFieldValue(form, "acquisition_start"),
    acquisition_end: dateFieldValue(form, "acquisition_end"),
    sensor: fieldValue(form, "sensor").trim(),
    contact: fieldValue(form, "contact").trim(),
  };
}

function externalLink(form) {
  return {
    external_id: fieldValue(form, "external_id").trim() || null,
    external_url: fieldValue(form, "external_url").trim() || null,
  };
}

// Advisory only: the server decides, in `app/uploads/source_links.py`. Keep these
// hosts in step with it so the form never promises a rewrite it will not do.
const DRIVE_HOSTS = ["drive.google.com", "docs.google.com", "drive.usercontent.google.com"];
const DROPBOX_HOSTS = ["www.dropbox.com", "dropbox.com"];
const ONEDRIVE_HOSTS = ["1drv.ms", "onedrive.live.com"];
const ODM_ASSET_PATH = /^\/task\/[\w-]+\/download\/([^/]+)$/;
const WEBODM_ASSET_PATH = /^\/api\/projects\/\d+\/tasks\/[^/]+\/download\/([^/]+)\/?$/;

function sourceHint(raw) {
  const value = raw.trim();
  if (!value) return "";
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "";
  }
  if (parsed.protocol !== "https:") {
    return "The link has to start with https:// to be imported.";
  }
  const host = parsed.hostname.toLowerCase();
  if (DRIVE_HOSTS.includes(host)) {
    return (
      "Google Drive link. We will rewrite it to Drive's download endpoint. " +
      "If Drive refuses to serve the file, upload it instead."
    );
  }
  if (DROPBOX_HOSTS.includes(host)) {
    return "Dropbox link. We will switch it to a direct download.";
  }
  if (ONEDRIVE_HOSTS.includes(host) || host.endsWith(".sharepoint.com")) {
    return "OneDrive link. We will switch it to a direct download.";
  }
  const webodmAsset = parsed.pathname.match(WEBODM_ASSET_PATH);
  if (webodmAsset) {
    const asset = webodmAsset[1].toLowerCase();
    if (asset === "orthophoto.tif") return "Public WebODM orthophoto link.";
    if (asset === "all.zip") {
      return "Public WebODM assets archive. We will safely extract only the orthophoto.";
    }
    return `We cannot use '${webodmAsset[1]}'. Link to orthophoto.tif or all.zip instead.`;
  }
  const asset = parsed.pathname.match(ODM_ASSET_PATH);
  if (asset) {
    const name = asset[1].toLowerCase();
    if (name === "orthophoto.tif" || name === "all.zip") {
      return "NodeODM link. We will download all.zip and safely extract only the orthophoto.";
    }
    return `We can only read the orthophoto, not '${asset[1]}'. Use the all.zip download link.`;
  }
  return "";
}

function currentMode(form) {
  const picked = form.querySelector('input[name="source_mode"]:checked');
  return picked ? picked.value : "file";
}

// `required` has to come off the input the user cannot see, or submit blocks silently.
function applySourceMode(form) {
  const mode = currentMode(form);
  const fileInput = document.getElementById("file-input");
  const urlInput = document.getElementById("source-url");
  document.getElementById("file-picker").hidden = mode !== "file";
  document.getElementById("url-picker").hidden = mode !== "url";
  if (fileInput) fileInput.required = mode === "file";
  if (urlInput) urlInput.required = mode === "url";
  const submit = document.getElementById("submit-btn");
  if (submit) submit.textContent = mode === "url" ? "Import imagery" : "Start upload";
}

// Switch the form from "pick a file" to "confirm this source".
function enterRemoteSourceMode(sourceUrl) {
  const fileInput = document.getElementById("file-input");
  if (fileInput) fileInput.required = false;
  const urlInput = document.getElementById("source-url");
  if (urlInput) urlInput.required = false;
  // The source is already decided, so the choice would only be misleading.
  for (const id of ["source-choice", "file-picker", "url-picker"]) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }

  let host = sourceUrl;
  try {
    host = new URL(sourceUrl).host;
  } catch {
    // Leave the raw value; the server rejects anything unfetchable anyway.
  }
  const panel = document.getElementById("remote-source");
  const detail = document.getElementById("remote-source-detail");
  // textContent, not innerHTML: this string comes from the query string.
  if (detail) {
    detail.textContent = `OpenAerialMap will download the imagery from ${host} after you confirm. You do not need to upload a file.`;
  }
  if (panel) panel.hidden = false;
  const submit = document.getElementById("submit-btn");
  if (submit) submit.textContent = "Create OAM record";
}

async function submitRemoteSource(form, sourceUrl) {
  const metadata = collectMetadata(form);
  setProgress(0.5, "Registering the dataset…");
  const result = await postJSON("/api/v1/uploads", {
    source_url: sourceUrl,
    title: metadata.title,
    metadata,
    ...externalLink(form),
  });
  setProgress(1, "Queued! Track progress in ‘Your uploads’ below.");
  if (window.htmx) window.htmx.trigger("#uploads-list", "load");
  return result;
}

// Use a stable hash so the same upload can resume after a reload.
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

// Metadata is included so edited details start a new upload session.
function sessionKey(file, metadata) {
  return `oam-upload:${file.name}:${file.size}:${file.lastModified}:${hash(JSON.stringify(metadata))}`;
}

async function uploadFile(form, file) {
  const errorBox = document.getElementById("upload-error");
  errorBox.innerHTML = "";
  const metadata = collectMetadata(form);
  const title = metadata.title;

  // Reuse a session for the same file + metadata across reloads.
  const store = sessionKey(file, metadata);
  let key, upload_id, existing;
  const saved = JSON.parse(localStorage.getItem(store) || "null");
  if (saved) {
    try {
      existing = await postJSON("/api/v1/s3/listparts", saved);
      ({ key, upload_id } = saved);
    } catch {
      localStorage.removeItem(store);
    }
  }
  if (!key) {
    ({ key, upload_id } = await postJSON("/api/v1/s3/createmultipart", {
      filename: file.name,
      title,
      content_type: file.type || "image/tiff",
      size_bytes: file.size,
      metadata,
      ...externalLink(form),
    }));
    localStorage.setItem(store, JSON.stringify({ key, upload_id }));
    existing = await postJSON("/api/v1/s3/listparts", { key, upload_id });
  }

  // Skip parts already stored by the resumed session.
  const doneByNumber = new Map(existing.map((p) => [p.PartNumber, p.ETag]));

  const totalParts = Math.ceil(file.size / PART_SIZE);
  const parts = [];
  for (let n = 1; n <= totalParts; n++) {
    if (doneByNumber.has(n)) {
      parts.push({ ETag: doneByNumber.get(n), PartNumber: n });
      setProgress(n / totalParts, `Resumed part ${n}/${totalParts}`);
      continue;
    }
    const blob = file.slice((n - 1) * PART_SIZE, n * PART_SIZE);
    const { url } = await postJSON("/api/v1/s3/signedurl", {
      key,
      upload_id,
      part_number: n,
    });
    const put = await fetch(url, { method: "PUT", body: blob });
    if (!put.ok) throw new Error(`Failed uploading part ${n}`);
    parts.push({ ETag: put.headers.get("ETag"), PartNumber: n });
    setProgress(n / totalParts, `Uploaded part ${n}/${totalParts}`);
  }

  setProgress(1, "Finalising and queueing for processing…");
  await postJSON("/api/v1/s3/completemultipart", { key, upload_id, parts });
  localStorage.removeItem(store);
  setProgress(1, "Queued! Track progress in ‘Your uploads’ below.");
  if (window.htmx) window.htmx.trigger("#uploads-list", "load");
}

function showError(message) {
  const errBox = document.getElementById("upload-error");
  errBox.innerHTML = '<wa-callout variant="danger"><span></span></wa-callout>';
  // textContent prevents server messages from injecting HTML.
  errBox.querySelector("span").textContent = message;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("upload-form");
  if (!form) return;
  // A prefilled URL is a partner handoff: it answers this form's first question.
  const prefilledUrl = applyPrefill(form);
  if (prefilledUrl) {
    enterRemoteSourceMode(prefilledUrl);
  } else {
    applySourceMode(form);
    for (const radio of form.querySelectorAll('input[name="source_mode"]')) {
      radio.addEventListener("change", () => applySourceMode(form));
    }
    const urlInput = document.getElementById("source-url");
    const note = document.getElementById("source-url-note");
    if (urlInput && note) {
      const showHint = () => {
        const hint = sourceHint(urlInput.value || "");
        note.textContent = hint;
        note.hidden = !hint;
      };
      // Which event a wa-input re-emits varies by version; the handler is idempotent.
      for (const name of ["input", "wa-input", "change"]) {
        urlInput.addEventListener(name, showHint);
      }
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = document.getElementById("submit-btn");
    document.getElementById("upload-error").innerHTML = "";
    const urlInput = document.getElementById("source-url");
    const typedUrl = urlInput && !prefilledUrl ? (urlInput.value || "").trim() : "";
    const remoteMode = Boolean(prefilledUrl) || currentMode(form) === "url";
    const sourceUrl = prefilledUrl || typedUrl;
    const file = remoteMode ? null : document.getElementById("file-input").files[0];

    if (remoteMode && !sourceUrl) {
      showError("Paste a link to the orthophoto, or upload a file instead.");
      return;
    }
    if (!remoteMode && !file) return;

    submit.disabled = true;
    try {
      if (remoteMode) {
        await submitRemoteSource(form, sourceUrl);
      } else {
        await uploadFile(form, file);
      }
    } catch (err) {
      showError(err.message);
    } finally {
      submit.disabled = false;
    }
  });
});
