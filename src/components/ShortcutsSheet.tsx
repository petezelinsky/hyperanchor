"use client";

import { XIcon } from "./icons";
import { IconButton, Kbd, Modal } from "./ui";

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Anywhere",
    items: [
      ["N", "New task"],
      ["F", "Focus: one task at a time"],
      ["T", "Go to today"],
      ["← →", "Previous / next"],
      ["D W M A", "Switch view"],
      ["?", "Show shortcuts"],
      [",", "Settings"],
    ],
  },
  {
    title: "In a list",
    items: [
      ["↑ ↓", "Select a task"],
      ["Space", "Complete"],
      ["↵", "Edit the title"],
      ["Tab", "Title or notes"],
      ["⌫", "Delete"],
      ["Esc", "Cancel or deselect"],
    ],
  },
  {
    title: "In focus",
    items: [
      ["Space", "Done"],
      ["→", "Not now"],
      ["N", "Jot something down"],
      ["Esc", "Leave focus"],
    ],
  },
];

export function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="Keyboard shortcuts" onClose={onClose} className="max-w-[580px] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.015em]">Keyboard shortcuts</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">Everything has a key.</p>
        </div>
        <IconButton label="Close" size="sm" onClick={onClose} className="-mt-1 -mr-1">
          <XIcon size={14} />
        </IconButton>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-1 text-[12px] font-medium text-ink-3">{g.title}</div>
            {g.items.map(([keys, what]) => (
              <div key={what} className="flex h-9 items-center justify-between gap-4 border-b border-line text-[13.5px] last:border-0">
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
    </Modal>
  );
}
