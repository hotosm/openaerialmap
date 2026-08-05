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
  const title = fieldValue(form, "title").trim();
  const metadata = {
    title,
    provider: fieldValue(form, "provider").trim(),
    platform: fieldValue(form, "platform"),
    product_type: fieldValue(form, "product_type"),
    license: fieldValue(form, "license"),
    acquisition_start: fieldValue(form, "acquisition_start"),
    acquisition_end: fieldValue(form, "acquisition_end"),
    sensor: fieldValue(form, "sensor").trim(),
    contact: fieldValue(form, "contact").trim(),
  };

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
  await postJSON("/api/v1/s3/completemultipart", {
    key,
    upload_id,
    title,
    filename: file.name,
    parts,
  });
  localStorage.removeItem(store);
  setProgress(1, "Queued! Track progress in ‘Your uploads’ below.");
  if (window.htmx) window.htmx.trigger("#uploads-list", "load");
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("upload-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = document.getElementById("file-input").files[0];
    const submit = document.getElementById("submit-btn");
    if (!file) return;
    submit.disabled = true;
    try {
      await uploadFile(form, file);
    } catch (err) {
      // textContent prevents server messages from injecting HTML.
      const errBox = document.getElementById("upload-error");
      errBox.innerHTML = '<wa-callout variant="danger"><span></span></wa-callout>';
      errBox.querySelector("span").textContent = err.message;
    } finally {
      submit.disabled = false;
    }
  });
});
