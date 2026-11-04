import { useEffect, useRef, useState } from "react";
import type { Owner } from "../useOwners";
import { transferImagery } from "../utils/imagery";
import type { ImageFeature } from "../utils/types";

interface Props {
  feature: ImageFeature;
  // Who the user may transfer to; the current owner is left out.
  owners: Owner[];
  onClose: () => void;
  // Called once the uploader has written the new owner.
  onDone: () => void;
}

// Hands published imagery to the user or one of their organisations. Mounted
// only while open: closing it, by any means, unmounts it through onClose.
export default function TransferDialog({ feature, owners, onClose, onDone }: Props) {
  const dialog = useRef<HTMLElement | null>(null);
  const choices = owners.filter((o) => o.id !== feature.properties.ownerId);
  const [ownerId, setOwnerId] = useState(choices[0]?.id ?? "");
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "busy" } | { kind: "error"; message: string }
  >({
    kind: "idle",
  });

  // The X button and Escape close the dialog on their own; follow them.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    el.addEventListener("wa-after-hide", onClose);
    return () => el.removeEventListener("wa-after-hide", onClose);
  }, [onClose]);

  const submit = async () => {
    if (!ownerId) return;
    setState({ kind: "busy" });
    try {
      await transferImagery(feature.properties.id, ownerId);
      onDone();
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Request failed." });
    }
  };

  return (
    <wa-dialog ref={dialog} open label="Transfer imagery">
      <div className="space-y-4 text-sm text-gray-700">
        <p>
          Move <strong>{feature.properties.title}</strong> to another owner. They manage it from
          then on; you stay recorded as the uploader.
        </p>
        <label className="block text-xs font-semibold text-gray-600">
          New owner
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            disabled={state.kind === "busy"}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm font-normal text-gray-800"
          >
            {choices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        {state.kind === "error" && (
          <wa-callout variant="danger" size="s" class="text-xs">
            Could not transfer the imagery ({state.message}). Try again.
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
            loading={state.kind === "busy"}
            disabled={!ownerId}
            onClick={submit}
          >
            Transfer
          </wa-button>
        </div>
      </div>
    </wa-dialog>
  );
}
