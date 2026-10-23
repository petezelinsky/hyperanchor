"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { addDays, formatMedium, parseYmd, relativeDay, startOfWeek, ymd } from "@/lib/dates";
import { parseTaskInput } from "@/lib/parseDate";
import { ArrowUpIcon, CalendarIcon, PlusIcon } from "./icons";
import { Menu, type Anchor } from "./ui";

export type QuickAddHandle = { focus: () => void };

/** The one input: type a task, optionally with a date ("Call mom tomorrow"), press Enter. */
export const QuickAdd = forwardRef<QuickAddHandle, { defaultDate: string; todayKey: string; onAdd: (title: string, date: string) => void }>(
  function QuickAdd({ defaultDate, todayKey, onAdd }, ref) {
    const [text, setText] = useState("");
    const [manual, setManual] = useState<string | null>(null);
    const [menu, setMenu] = useState<{ anchor: Anchor; el: HTMLElement } | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const [wide, setWide] = useState(true);
    useEffect(() => {
      const mq = window.matchMedia("(min-width: 640px)");
      const update = () => setWide(mq.matches);
      update();
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }, []);
    useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));

    const parsed = useMemo(() => parseTaskInput(text, todayKey), [text, todayKey]);
    const date = manual ?? parsed.date ?? defaultDate;
    const picked = !!(manual || parsed.date);
    const label = relativeDay(date, todayKey) ?? formatMedium(parseYmd(date));
    const ready = parsed.title.trim().length > 0;

    const choose = (key: string) => {
      setManual(key);
      if (parsed.phrase) setText(parsed.title); // the menu choice replaces a typed date
      input.current?.focus();
    };

    const today = parseYmd(todayKey);
    const options = [
      { key: todayKey, label: "Today" },
      { key: ymd(addDays(today, 1)), label: "Tomorrow" },
      { key: ymd(addDays(startOfWeek(today), 5)), label: "This weekend" },
      { key: ymd(addDays(startOfWeek(today), 7)), label: "Next week" },
      { key: ymd(addDays(today, 7)), label: "In a week" },
    ].filter((o, i, all) => all.findIndex((x) => x.key === o.key) === i && o.key >= todayKey);
    if (defaultDate !== todayKey && !options.some((o) => o.key === defaultDate)) options.unshift({ key: defaultDate, label: formatMedium(parseYmd(defaultDate)) });

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          onAdd(parsed.title, date);
          setText("");
          setManual(null);
        }}
        className="group flex h-14 items-center gap-1.5 rounded-[18px] border border-edge bg-paper pr-2 pl-4 transition-[border-color,box-shadow] duration-200 focus-within:border-ink focus-within:shadow-[0_10px_30px_-14px_rgba(10,10,10,0.25)]"
      >
        <PlusIcon size={18} className="flex-none text-faint transition-colors group-focus-within:text-ink" />
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              if (text) {
                setText("");
                setManual(null);
              } else input.current?.blur();
            }
          }}
          placeholder={wide ? "Add a task — try “Call mom tomorrow”" : "Add a task…"}
          aria-label="Add a task"
          maxLength={500}
          className="h-10 min-w-0 flex-1 bg-transparent px-2 text-[15.5px] text-ink"
        />
        <button
          key={date}
          type="button"
          aria-label={`Date: ${label}`}
          onClick={(e) => setMenu(menu ? null : { anchor: e.currentTarget.getBoundingClientRect(), el: e.currentTarget })}
          className={`flex h-8 flex-none items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors ${
            picked ? "animate-kick bg-ink text-on-ink" : "bg-fill text-ink-2 hover:bg-fill-on"
          }`}
        >
          <CalendarIcon size={13} />
          {label}
        </button>
        <button
          type="submit"
          aria-label="Add task"
          disabled={!ready}
          className={`flex size-10 flex-none items-center justify-center rounded-full transition-colors duration-200 ${ready ? "bg-ink text-on-ink" : "bg-fill-on text-faint"}`}
        >
          <ArrowUpIcon size={16} />
        </button>
        {menu && (
          <Menu
            anchor={menu.anchor}
            trigger={menu.el}
            align="end"
            label="Choose a date"
            onClose={() => setMenu(null)}
            entries={[
              { heading: "Add to" },
              ...options.map((o) => ({ label: o.label, shortcut: formatMedium(parseYmd(o.key)), onSelect: () => choose(o.key) })),
            ]}
          />
        )}
      </form>
    );
  },
);
