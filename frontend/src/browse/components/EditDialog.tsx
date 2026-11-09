import { useEffect, useRef, useState } from "react";
import { updateImagery, type MetadataChanges } from "../utils/imagery";
import { fetchItem } from "../utils/stac";
import type { ImageFeature } from "../utils/types";

interface Props {
  feature: ImageFeature;
  onClose: () => void;
  // Called once the uploader has written the changes.
  onDone: () => void;
}

type Fields = Required<MetadataChanges>;

interface Option {
  value: string;
  label: string;
}

// Same choices as the upload form.
const PLATFORMS: Option[] = [
  { value: "uav", label: "UAV / drone" },
  { value: "aircraft", label: "Aircraft" },
  { value: "balloon", label: "Balloon" },
  { value: "kite", label: "Kite" },
  { value: "satellite", label: "Satellite" },
];

// Same choices as the upload form, stored as ingest stores them.
const LICENCES: Option[] = [
  { value: "CC-BY-4.0", label: "CC-BY 4.0" },
  { value: "CC-BY-NC-4.0", label: "CC BY-NC 4.0" },
  { value: "CC-BY-SA-4.0", label: "CC BY-SA 4.0" },
];

// Older Items still carry `CC-BY 4.0`; match the uploader's normalisation.
const normaliseLicence = (value: string) =>
  value.toUpperCase().split(/\s+/).filter(Boolean).join("-");

const INPUT_CLASS =
  "mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm font-normal text-gray-800";

function fieldsOf(props: Record<string, unknown>): Fields {
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  const provider = (
    props.providers as { name?: unknown; description?: unknown }[] | undefined
  )?.[0];
  const instruments = props.instruments as unknown[] | undefined;
  return {
    title: text(props.title),
    provider: text(provider?.name) || text(props["oam:producer_name"]),
    contact: text(provider?.description),
    platform: text(props["oam:platform_type"]),
    sensor: text(instruments?.[0]),
    license: normaliseLicence(text(props.license)),
  };
}

// Corrects the descriptive metadata and licence of published imagery. Mounted
// only while open: closing it, by any means, unmounts it through onClose.
export default function EditDialog({ feature, onClose, onDone }: Props) {
  const dialog = useRef<HTMLElement | null>(null);
  const [original, setOriginal] = useState<Fields | null>(null);
  const [fields, setFields] = useState<Fields | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "busy" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  // The X button and Escape close the dialog on their own; follow them.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    el.addEventListener("wa-after-hide", onClose);
    return () => el.removeEventListener("wa-after-hide", onClose);
  }, [onClose]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchItem(feature.properties.collection, feature.properties.id, ctrl.signal)
      .then((item) => {
        const loaded = fieldsOf(item.properties ?? {});
        setOriginal(loaded);
        setFields(loaded);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setLoadError(err instanceof Error ? err.message : "Request failed.");
      });
    return () => ctrl.abort();
  }, [feature.properties.collection, feature.properties.id]);

  const set = (key: keyof Fields) => (value: string) =>
    setFields((f) => (f ? { ...f, [key]: value } : f));

  // Send only what changed, so a field someone else fixed meanwhile is kept.
  const changes: MetadataChanges = {};
  if (original && fields) {
    for (const key of Object.keys(fields) as (keyof Fields)[]) {
      if (fields[key].trim() !== original[key]) changes[key] = fields[key].trim();
    }
  }
  const changed = Object.keys(changes).length > 0;
  // The uploader refuses an empty title or provider, and cannot clear a sensor.
  const valid =
    !!fields?.title.trim() &&
    !!fields?.provider.trim() &&
    (!original?.sensor || !!fields?.sensor.trim());
  const busy = state.kind === "busy";

  const submit = async () => {
    if (!changed || !valid) return;
    setState({ kind: "busy" });
    try {
      await updateImagery(feature.properties.id, changes);
      onDone();
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Request failed." });
    }
  };

  // Keep a value the form does not offer, or none, selectable so it can stay.
  const withCurrent = (options: Option[], current: string | undefined) =>
    current === undefined || options.some((o) => o.value === current)
      ? options
      : [{ value: current, label: current || "Not set" }, ...options];
  const platforms = withCurrent(PLATFORMS, original?.platform);
  const licences = withCurrent(LICENCES, original?.license);

  return (
    <wa-dialog ref={dialog} open label="Edit imagery">
      <div className="space-y-3 text-sm text-gray-700">
        {!fields && !loadError && (
          <div className="flex justify-center py-6">
            <wa-spinner />
          </div>
        )}
        {fields && (
          <>
            <label className="block text-xs font-semibold text-gray-600">
              Title
              <input
                className={INPUT_CLASS}
                value={fields.title}
                maxLength={200}
                disabled={busy}
                onChange={(e) => set("title")(e.target.value)}
              />
            </label>
            <label className="block text-xs font-semibold text-gray-600">
              Provider / producer
              <input
                className={INPUT_CLASS}
                value={fields.provider}
                maxLength={500}
                disabled={busy}
                onChange={(e) => set("provider")(e.target.value)}
              />
            </label>
            <label className="block text-xs font-semibold text-gray-600">
              Contact
              <input
                className={INPUT_CLASS}
                value={fields.contact}
                maxLength={500}
                disabled={busy}
                onChange={(e) => set("contact")(e.target.value)}
              />
              <span className="block mt-1 font-normal text-gray-500">
                Email addresses are left out: the catalogue is public.
              </span>
            </label>
            <label className="block text-xs font-semibold text-gray-600">
              Platform type
              <select
                className={INPUT_CLASS}
                value={fields.platform}
                disabled={busy}
                onChange={(e) => set("platform")(e.target.value)}
              >
                {platforms.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-gray-600">
              Sensor
              <input
                className={INPUT_CLASS}
                value={fields.sensor}
                maxLength={500}
                disabled={busy}
                onChange={(e) => set("sensor")(e.target.value)}
              />
            </label>
            <label className="block text-xs font-semibold text-gray-600">
              Licence
              <select
                className={INPUT_CLASS}
                value={fields.license}
                disabled={busy}
                onChange={(e) => set("license")(e.target.value)}
              >
                {licences.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <span className="block mt-1 font-normal text-gray-500">
                People who already use this imagery keep the licence they got it under.
              </span>
            </label>
          </>
        )}
        {loadError && (
          <wa-callout variant="danger" size="s" class="text-xs">
            Could not load this imagery ({loadError}). Close the dialog and try again.
          </wa-callout>
        )}
        {state.kind === "error" && (
          <wa-callout variant="danger" size="s" class="text-xs">
            Could not save the changes ({state.message}). Try again.
          </wa-callout>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <wa-button size="s" appearance="outlined" onClick={onClose}>
            Cancel
          </wa-button>
          <wa-button
            size="s"
            variant="brand"
            appearance="filled"
            loading={busy}
            disabled={!changed || !valid}
            onClick={submit}
          >
            Save
          </wa-button>
        </div>
      </div>
    </wa-dialog>
  );
}
