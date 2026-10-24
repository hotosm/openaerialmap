import { useEffect, useRef } from "react";
import { collectionLabel } from "../utils/constants";
import type { DatePreset, Filters, ResolutionPreset } from "../utils/types";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  // Collection IDs seen in the tiles, not hardcoded.
  availableCollections?: string[];
}

type WaSelectEvent = CustomEvent<{ item: HTMLElement & { value: string } }>;

interface Option<V extends string> {
  label: string;
  value: V;
}

const PLATFORMS: Option<string>[] = [
  { label: "All Platforms", value: "" },
  { label: "Satellite", value: "satellite" },
  { label: "Drone (UAV)", value: "uav" },
  { label: "Other / Aircraft", value: "aircraft" },
];

const DATES: Option<DatePreset>[] = [
  { label: "Any Date", value: "" },
  { label: "Past Week", value: "week" },
  { label: "Past Month", value: "month" },
  { label: "This Year", value: "year" },
];

const RESOLUTIONS: Option<ResolutionPreset>[] = [
  { label: "Any Resolution", value: "" },
  { label: "< 0.5 m", value: "lt05" },
  { label: "0.5 - 2 m", value: "05to2" },
  { label: "2 - 10 m", value: "2to10" },
  { label: "> 10 m", value: "gt10" },
];

const LICENSES: Option<string>[] = [
  { label: "Any License", value: "" },
  { label: "CC BY 4.0", value: "CC-BY 4.0" },
  { label: "CC BY-NC 4.0", value: "CC BY-NC 4.0" },
  { label: "CC BY-SA 4.0", value: "CC BY-SA 4.0" },
];

// Attach a wa-select listener imperatively. React doesn't recognise
// custom events (onWaSelect isn't a real prop), and TypeScript would
// reject it in JSX, so we bind through a ref.
function useWaSelect(ref: React.RefObject<HTMLElement | null>, onSelect: (value: string) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: Event) => {
      const value = (e as WaSelectEvent).detail?.item?.value ?? "";
      onSelect(value);
    };
    el.addEventListener("wa-select", handler);
    return () => el.removeEventListener("wa-select", handler);
  }, [ref, onSelect]);
}

interface FilterDropdownProps<V extends string> {
  label: string;
  active: boolean;
  value: V;
  options: Option<V>[];
  onChange: (v: V) => void;
}

function FilterDropdown<V extends string>({
  label,
  active,
  value,
  options,
  onChange,
}: FilterDropdownProps<V>) {
  const ref = useRef<HTMLElement | null>(null);
  useWaSelect(ref, (v) => onChange(v as V));
  return (
    <wa-dropdown ref={ref} distance="6">
      {/*
        wa-button's `with-caret` renders the chevron inside the button's
        own shadow DOM at ::part(caret), spaced by WA's own tokens - no
        outer wa-icon means no 1.25em host-box slack that we had to
        chase manually before. `pill` + `size="s"` gives the chip
        shape. Variant/appearance toggle sets the HOT brand colours via
        the wa-color-brand-* theme layer.
      */}
      <wa-button
        slot="trigger"
        pill
        with-caret
        size="s"
        variant={active ? "brand" : "neutral"}
        appearance={active ? "filled" : "outlined"}
      >
        {label}
      </wa-button>
      {options.map((opt) => (
        <wa-dropdown-item
          key={opt.value}
          value={opt.value}
          type={value === opt.value ? "checkbox" : undefined}
          checked={value === opt.value}
        >
          {opt.label}
        </wa-dropdown-item>
      ))}
    </wa-dropdown>
  );
}

export default function MapFilterBar({ filters, onChange, availableCollections = [] }: Props) {
  const applyChange = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  // Keep the active selection listed even when out of view.
  const collectionIds = Array.from(
    new Set([...availableCollections, ...(filters.collection ? [filters.collection] : [])]),
  ).sort();
  const SOURCES: Option<string>[] = [
    { label: "All Sources", value: "" },
    ...collectionIds.map((id) => ({ label: collectionLabel(id), value: id })),
  ];

  const platformLabel =
    PLATFORMS.find((o) => o.value === filters.platform)?.label ?? "All Platforms";
  const dateLabel = DATES.find((o) => o.value === filters.date)?.label ?? "Any Date";
  const resolutionLabel =
    RESOLUTIONS.find((o) => o.value === filters.resolution)?.label ?? "Any Resolution";
  const licenseLabel = (() => {
    if (!filters.license) return "Any License";
    return LICENSES.find((o) => o.value === filters.license)?.label ?? "License";
  })();

  const sourceLabel = filters.collection ? collectionLabel(filters.collection) : "All Sources";

  const anyActive = !!(
    filters.platform ||
    filters.date ||
    filters.resolution ||
    filters.license ||
    filters.collection
  );

  return (
    <div className="font-sans">
      <div className="inline-flex flex-wrap gap-2 items-center rounded-2xl bg-white/75 backdrop-blur-md px-2.5 py-2 shadow-md ring-1 ring-black/5">
        {/* Only show the filter when more than one collection is available. */}
        {collectionIds.length > 1 && (
          <FilterDropdown
            label={sourceLabel}
            active={!!filters.collection}
            value={filters.collection}
            options={SOURCES}
            onChange={(v) => applyChange({ collection: v })}
          />
        )}
        <FilterDropdown
          label={platformLabel}
          active={!!filters.platform}
          value={filters.platform}
          options={PLATFORMS}
          onChange={(v) => applyChange({ platform: v })}
        />
        <FilterDropdown
          label={dateLabel}
          active={!!filters.date}
          value={filters.date}
          options={DATES}
          onChange={(v) => applyChange({ date: v as DatePreset })}
        />
        <FilterDropdown
          label={resolutionLabel}
          active={!!filters.resolution}
          value={filters.resolution}
          options={RESOLUTIONS}
          onChange={(v) => applyChange({ resolution: v as ResolutionPreset })}
        />
        <FilterDropdown
          label={licenseLabel}
          active={!!filters.license}
          value={filters.license}
          options={LICENSES}
          onChange={(v) => applyChange({ license: v })}
        />

        {anyActive && (
          // `appearance="filled"` gives it a visible danger-tinted
          // background so it stands out from the semi-transparent
          // filter bar behind. No slot="start" icon: WA gives slotted
          // icons a 0.75em trailing margin (shadow-DOM concern we can't
          // easily override), which pushes the label off-centre. Label
          // "Clear" plus the danger colour is enough affordance.
          <wa-button
            pill
            size="s"
            variant="danger"
            appearance="filled"
            onClick={() =>
              onChange({
                date: "",
                platform: "",
                resolution: "",
                license: "",
                collection: "",
              })
            }
          >
            Clear
          </wa-button>
        )}
      </div>
    </div>
  );
}
