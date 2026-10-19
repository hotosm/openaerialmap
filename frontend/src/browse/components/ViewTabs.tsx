import type { BrowseMode } from "../utils/types";

interface Props {
  mode: BrowseMode;
  onChange: (mode: BrowseMode) => void;
}

const TABS: { mode: BrowseMode; label: string }[] = [
  { mode: "all", label: "All imagery" },
  { mode: "mine", label: "My imagery" },
];

// Shown only to signed-in users; see Browse.tsx.
export default function ViewTabs({ mode, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Imagery to list"
      className="flex bg-white border-b border-gray-200"
    >
      {TABS.map((tab) => {
        const active = tab.mode === mode;
        return (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.mode)}
            className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              active
                ? "border-cyan-500 text-cyan-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
