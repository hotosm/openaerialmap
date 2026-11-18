import { useEffect, useRef, useState } from "react";
import { updateImagery, type MetadataChanges } from "../utils/imagery";
import { fetchItem } from "../utils/stac";
import type { ImageFeature } from "../utils/types";

interface Props {
  feature: ImageFeature;
  onClose: () => void;
  // Called with what the uploader wrote.
  onDone: (changes: MetadataChanges) => void;
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

// What a CC BY licence adds to attribution; null for any other licence.
const restrictions = (licence: string) => {
  const match = /^CC-BY((?:-(?:NC|ND|SA))*)-\d+(?:\.\d+)?$/.exec(licence); // codespell:ignore
  return match ? match[1].split("-").filter(Boolean) : null;
};

// The uploader refuses a licence that allows less than the current one, since
// people already rely on its terms. An Item without one can get any.
const opensUp = (current: string, next: string) => {
  if (!current) return true;
  const from = restrictions(current);
  const to = restrictions(next);
  return !!from && !!to && to.every((r) => from.includes(r));
};

// The uploader's rule: an email address must not reach the public catalogue.
const cleanContact = (value: string) =>
  value
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && !p.includes("@"))
    .join(", ");

const INPUT_CLASS =
  "mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm font-normal text-gray-800";

const HINT_CLASS = "block mt-1 font-normal text-gray-500";

const PROBLEM_CLASS = "block mt-1 font-normal text-red-700";

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

  // Send only what changed, so a field someone else fixed meanwhile is kept,
  // with the value it had here, so the uploader can tell if it changed since.
  const changes: MetadataChanges = {};
  const seen: MetadataChanges = {};
  // An untouched contact is left as stored, even if an older Item has an email in it.
  const contactEdited = !!fields && fields.contact.trim() !== original?.contact;
  const contact = cleanContact(fields?.contact ?? "");
  if (original && fields) {
    for (const key of Object.keys(fields) as (keyof Fields)[]) {
      const value = key === "contact" && contactEdited ? contact : fields[key].trim();
      if (value !== original[key]) {
        changes[key] = value;
        seen[key] = original[key];
      }
    }
  }
  const changed = Object.keys(changes).length > 0;
  // The uploader refuses an empty title or provider, and cannot clear a sensor.
  const noTitle = !!fields && !fields.title.trim();
  const noProvider = !!fields && !fields.provider.trim();
  const sensorRemoved = !!original?.sensor && !!fields && !fields.sensor.trim();
  const contactDropped = contactEdited && !!fields?.contact.trim() && !contact;
  const valid = !noTitle && !noProvider && !sensorRemoved;
  const busy = state.kind === "busy";

  const submit = async () => {
    if (!changed || !valid) return;
    setState({ kind: "busy" });
    try {
      await updateImagery(feature.properties.id, changes, seen);
      onDone(changes);
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
  const licences = withCurrent(
    LICENCES.filter((l) => !original || opensUp(original.license, l.value)),
    original?.license,
  );

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
                required
                disabled={busy}
                onChange={(e) => set("title")(e.target.value)}
              />
              {noTitle && <span className={PROBLEM_CLASS}>A title is required.</span>}
            </label>
            <label className="block text-xs font-semibold text-gray-600">
              Provider / producer
              <input
                className={INPUT_CLASS}
                value={fields.provider}
                maxLength={500}
                required
                disabled={busy}
                onChange={(e) => set("provider")(e.target.value)}
              />
              {noProvider && <span className={PROBLEM_CLASS}>A provider is required.</span>}
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
              {contactDropped ? (
                <span className={PROBLEM_CLASS}>
                  Email addresses are left out, so this leaves no contact.
                </span>
              ) : (
                <span className={HINT_CLASS}>
                  Email addresses are left out: the catalogue is public.
                </span>
              )}
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
              {sensorRemoved && (
                <span className={PROBLEM_CLASS}>A sensor cannot be removed, only replaced.</span>
              )}
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
              <span className={HINT_CLASS}>
                It can only change to a less restrictive licence: people already use this imagery
                under the current one.
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
            Could not save the changes. {state.message}
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
