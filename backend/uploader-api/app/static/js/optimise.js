// Runs browser GDAL in a worker. Files stay on disk (OPFS), not in memory.
const APP_NAME = "oam-optimiser";
// Loaded on click: it is tens of MB.
const BUNDLE_URL = "/optimiser/oam-optimiser-wasm-wasm32-mt-release.browser.js";
const OPFS_ROOT = "/opfs";
// Each tab has its own folder, and holds a lock with the same name while open.
const TAB_FOLDER = `tab-${crypto.randomUUID()}`;
const TAB_DIR = `${OPFS_ROOT}/${APP_NAME}/${TAB_FOLDER}`;
// Input copy, plus output and GDAL's temp files.
const DISK_FACTOR = 2;
const TICK_MS = 1000;

const byId = (id) => document.getElementById(id);

function formatSize(bytes) {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.ceil(bytes / 1e6)} MB`;
}

function formatElapsed(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

let gdalModule;
let runCount = 0;

// Removes folders of closed tabs. Open tabs still hold their lock.
async function clearClosedTabs() {
  const root = await navigator.storage.getDirectory();
  const app = await root.getDirectoryHandle(APP_NAME, { create: true });
  const { held } = await navigator.locks.query();
  const open = new Set(held.map((lock) => lock.name));
  for await (const name of app.keys()) {
    if (name.startsWith("tab-") && !open.has(name)) {
      await app.removeEntry(name, { recursive: true });
    }
  }
}

async function opfsFile(path) {
  const parts = path.slice(OPFS_ROOT.length + 1).split("/");
  const name = parts.pop();
  let dir = await navigator.storage.getDirectory();
  for (const part of parts) dir = await dir.getDirectoryHandle(part);
  const handle = await dir.getFileHandle(name);
  return handle.getFile();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("Could not download the optimiser. Check your connection and try again."));
    document.head.append(script);
  });
}

async function loadGdal() {
  if (gdalModule) return gdalModule;
  await clearClosedTabs();
  await loadScript(BUNDLE_URL);
  // initNative comes from the bundle.
  gdalModule = await initNative({ path: "/optimiser/", useWorker: true });
  return gdalModule;
}

async function removeRun(dir) {
  for (const { path } of await gdalModule.getFileList(dir)) {
    await gdalModule.FS.unlink(path);
  }
  await gdalModule.FS.rmdir(dir);
}

async function checkDiskSpace(file) {
  const needed = file.size * DISK_FACTOR;
  const { quota, usage } = await navigator.storage.estimate();
  if (quota - usage < needed) {
    throw new Error(
      `Not enough free disk space: this file needs about ${formatSize(needed)}, ` +
        `and the browser can use ${formatSize(quota - usage)}.`,
    );
  }
}

async function optimise(file, setStep) {
  if (!window.crossOriginIsolated || !navigator.storage?.getDirectory || !navigator.locks) {
    throw new Error("This browser can't run the optimiser. Try a recent Chrome, Edge or Firefox.");
  }
  setStep("Downloading the optimiser (tens of MB, cached after the first run)");
  const gdal = await loadGdal();
  // Without OPFS, files go to memory and large ones fail.
  if ((await gdal.getDefaultPath()) !== OPFS_ROOT) {
    throw new Error("This browser cannot give the optimiser disk storage. Try a recent Chrome, Edge or Firefox.");
  }
  await checkDiskSpace(file);
  // A folder per run, so a new run never deletes a result still downloading.
  runCount += 1;
  const runDir = `${TAB_DIR}/${runCount}`;
  await gdal.FS.mkdirTree(runDir);
  try {
    setStep("Copying the file into browser storage");
    const [src] = await gdal.autoMountFiles([file], runDir);
    const dst = `${runDir}/${file.name.replace(/\.tiff?$/i, "")}-optimised.tif`;
    setStep("Optimising");
    const error = await gdal.Optimiser.run(src, dst);
    await gdal.FS.unlink(src);
    if (error) throw new Error(error);
    return { file: await opfsFile(dst), runDir };
  } catch (err) {
    await removeRun(runDir);
    // A failed run, such as out of memory, can leave GDAL unusable. Start fresh.
    initNative.terminate();
    gdalModule = undefined;
    throw err;
  }
}

function showResult(original, { file: optimised, runDir }) {
  const box = byId("optimise-result");
  box.innerHTML = `
    <wa-callout variant="success">
      <p><strong></strong></p>
      <p>Save it, then choose the saved file on the <a href="/">upload page</a>.</p>
      <p><a download><wa-button variant="brand">Save optimised file</wa-button></a></p>
      <p>Once it has saved, delete the browser's copy to free the disk space.</p>
      <p><wa-button id="delete-btn" variant="neutral">Delete browser copy</wa-button></p>
    </wa-callout>`;
  // textContent: the file name is user input.
  box.querySelector("strong").textContent =
    `${original.name}: ${formatSize(original.size)} → ${formatSize(optimised.size)}`;
  const link = box.querySelector("a[download]");
  link.download = optimised.name;
  link.href = URL.createObjectURL(optimised);
  // Not deleted on save: the download still reads from it.
  byId("delete-btn").addEventListener("click", async () => {
    URL.revokeObjectURL(link.href);
    await removeRun(runDir);
    box.innerHTML = '<wa-callout variant="neutral">Browser copy deleted.</wa-callout>';
  });
}

function showError(message) {
  const box = byId("optimise-result");
  box.innerHTML = '<wa-callout variant="danger"><span></span></wa-callout>';
  box.querySelector("span").textContent = message;
}

function confirmLeave(e) {
  e.preventDefault();
}

function showDiskWarning(file) {
  const warning = byId("optimise-disk");
  warning.hidden = !file;
  if (!file) return;
  warning.querySelector("span").textContent =
    `This file needs about ${formatSize(file.size * DISK_FACTOR)} of free disk space ` +
    "while it is optimised.";
}

document.addEventListener("DOMContentLoaded", () => {
  // Never resolves, so the lock is held until the tab closes.
  navigator.locks?.request(TAB_FOLDER, () => new Promise(() => {}));
  const input = byId("optimise-input");
  input.addEventListener("change", () => showDiskWarning(input.files[0]));
  const form = byId("optimise-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = byId("optimise-input").files[0];
    if (!file) {
      showError("Choose a GeoTIFF to optimise.");
      return;
    }
    const button = byId("optimise-btn");
    const started = Date.now();
    let step = "";
    const render = () => {
      byId("optimise-label").textContent = `${step}… ${formatElapsed(Date.now() - started)}`;
    };
    const setStep = (label) => {
      step = label;
      render();
    };
    const timer = setInterval(render, TICK_MS);
    window.addEventListener("beforeunload", confirmLeave);
    button.disabled = true;
    byId("optimise-result").innerHTML = "";
    byId("optimise-progress").hidden = false;
    try {
      showResult(file, await optimise(file, setStep));
    } catch (err) {
      showError(err.message);
    } finally {
      clearInterval(timer);
      window.removeEventListener("beforeunload", confirmLeave);
      byId("optimise-progress").hidden = true;
      button.disabled = false;
    }
  });
});
