"use client";

import { XIcon } from "./icons";
import { IconButton, Kbd, Modal } from "./ui";

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Anywhere",
    items: [
      ["N", "New task"],
      ["T", "Go to today"],
      ["← →", "Previous / next"],
      ["D W M A", "Switch view"],
      ["?", "This sheet"],
    ],
  },
  {
    title: "In a list",
    items: [
      ["↑ ↓", "Select a task"],
      ["Space", "Mark as done"],
      ["↵", "Edit the title"],
      ["⌫", "Delete"],
      ["Esc", "Cancel or deselect"],
    ],
  },
];

export function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} label="Keyboard shortcuts" className="max-w-[600px] p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mono-label">Shortcuts</div>
          <h2 className="mt-2 text-[22px] leading-tight font-medium tracking-[-0.02em]">
            Move faster. <span className="text-faint">Everything has a key.</span>
          </h2>
        </div>
        <IconButton label="Close" onClick={onClose} className="-mt-1 -mr-2">
          <XIcon />
        </IconButton>
      </div>
      <div className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mono-label mb-2">{g.title}</div>
            {g.items.map(([keys, what]) => (
              <div key={what} className="flex h-11 items-center justify-between gap-4 border-t border-line text-[14px]">
                <span className="text-ink-2">{what}</span>
                <span className="flex gap-1">
                  {keys.split(" ").map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-6 text-[13px] text-muted">
        Quick add understands dates: <span className="text-ink">“Report fri”</span>, <span className="text-ink">“Dentist oct 28”</span>,{" "}
        <span className="text-ink">“Review in 3 days”</span>.
      </p>
    </Modal>
  );
}
