import { useEffect, useRef, useState } from "react";
import type { DatePreset, Filters } from "../utils/types";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
}

const btnBase =
  "px-4 py-2 bg-white rounded-full shadow-md text-sm font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 flex items-center gap-2 transition-all";
const activeBtn =
  "border-cyan-500 text-cyan-700 bg-cyan-50 ring-2 ring-cyan-100";

type MenuId = "platform" | "date" | "license" | null;

export default function MapFilterBar({ filters, onChange }: Props) {
  const [openMenu, setOpenMenu] = useState<MenuId>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (barRef.current && !barRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applyChange = (patch: Partial<Filters>) => {
    onChange({ ...filters, ...patch });
    setOpenMenu(null);
  };

  const platformLabel = (() => {
    const m: Record<string, string> = {
      satellite: "Satellite",
      uav: "Drone",
      aircraft: "Other",
    };
    return m[filters.platform] || "All Platforms";
  })();

  const dateLabel = (() => {
    if (filters.date === "week") return "Past Week";
    if (filters.date === "month") return "Past Month";
    if (filters.date === "year") return "This Year";
    return "Any Date";
  })();

  const licenseLabel = (() => {
    if (!filters.license) return "Any License";
    if (filters.license.includes("BY-SA")) return "CC BY-SA 4.0";
    if (filters.license.includes("BY-NC")) return "CC BY-NC 4.0";
    if (filters.license.includes("CC-BY")) return "CC BY 4.0";
    return "License";
  })();

  const toggleMenu = (m: MenuId) => setOpenMenu(openMenu === m ? null : m);
  const anyActive = !!(filters.platform || filters.date || filters.license);

  const datePresets: { label: string; val: DatePreset }[] = [
    { label: "Any Date", val: "" },
    { label: "Past Week", val: "week" },
    { label: "Past Month", val: "month" },
    { label: "This Year", val: "year" },
  ];

  return (
    <div ref={barRef} className="font-sans">
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <button
            onClick={() => toggleMenu("platform")}
            className={`${btnBase} ${filters.platform ? activeBtn : ""}`}
          >
            {platformLabel} <span className="text-[10px] text-gray-400">▼</span>
          </button>
          {openMenu === "platform" && (
            <div className="absolute top-full mt-2 left-0 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-1 overflow-hidden z-50">
              {(
                [
                  { label: "All Platforms", val: "" },
                  { label: "Satellite", val: "satellite" },
                  { label: "Drone (UAV)", val: "uav" },
                  { label: "Other / Aircraft", val: "aircraft" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => applyChange({ platform: opt.val })}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${
                    filters.platform === opt.val
                      ? "text-cyan-600 font-bold bg-cyan-50"
                      : "text-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => toggleMenu("date")}
            className={`${btnBase} ${filters.date ? activeBtn : ""}`}
          >
            {dateLabel} <span className="text-[10px] text-gray-400">▼</span>
          </button>
          {openMenu === "date" && (
            <div className="absolute top-full mt-2 left-0 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-1 overflow-hidden z-50">
              {datePresets.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => applyChange({ date: opt.val })}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${
                    filters.date === opt.val
                      ? "text-cyan-600 font-bold bg-cyan-50"
                      : "text-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => toggleMenu("license")}
            className={`${btnBase} ${filters.license ? activeBtn : ""}`}
          >
            {licenseLabel} <span className="text-[10px] text-gray-400">▼</span>
          </button>
          {openMenu === "license" && (
            <div className="absolute top-full mt-2 left-0 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-1 overflow-hidden z-50">
              {(
                [
                  { label: "Any License", val: "" },
                  { label: "CC BY 4.0", val: "CC-BY 4.0" },
                  { label: "CC BY-NC 4.0", val: "CC BY-NC 4.0" },
                  { label: "CC BY-SA 4.0", val: "CC BY-SA 4.0" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => applyChange({ license: opt.val })}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${
                    filters.license === opt.val
                      ? "text-cyan-600 font-bold bg-cyan-50"
                      : "text-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {anyActive && (
          <button
            onClick={() => onChange({ date: "", platform: "", license: "" })}
            className="px-3 py-2 bg-white/90 rounded-full text-xs font-bold text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 shadow-sm transition-all"
          >
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  );
}
