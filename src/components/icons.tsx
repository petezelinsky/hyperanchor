// Line icons on a 16px grid, one family: every icon is drawn with the same hairline, 1.1px on screen whatever its size
// (the stroke doesn't scale with the icon; see `svg[data-icon]` in globals.css), with round caps and joins, and built
// from a few plain shapes with soft corners. Decorative: hidden from assistive tech.

/** The one line weight of the family, in px on screen. */
export const ICON_STROKE = 1.1;

type IconProps = { size?: number; className?: string };

function Svg({ size = 16, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      data-icon=""
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export const SunIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="2.8" />
    <path d="M8 1.6v1.3M8 13.1v1.3M1.6 8h1.3M13.1 8h1.3M3.5 3.5l.9.9M11.6 11.6l.9.9M3.5 12.5l.9-.9M11.6 4.4l.9-.9" />
  </Svg>
);

export const MoonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z" />
  </Svg>
);

/** Tasks: the planner itself (the day, the week, the month), signed by its box with a tick. */
export const TasksIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="2.5" width="12" height="11" rx="2.4" />
    <path d="m5.4 8.1 1.75 1.75L10.6 6.2" />
  </Svg>
);

/** Analytics: three bars in a rounded frame. */
export const ChartIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="2.5" width="12" height="11" rx="2.4" />
    <path d="M5.3 10.6V8.6M8 10.6V5.4M10.7 10.6V7.2" />
  </Svg>
);

/** Settings: two sliders. */
export const SlidersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 5H8.4M11.6 5H13.5M2.5 11h1.9M7.6 11h5.9" />
    <circle cx="10" cy="5" r="1.6" />
    <circle cx="6" cy="11" r="1.6" />
  </Svg>
);

/** Keyboard shortcuts: a keyboard with a row of keys and the space bar. */
export const KeyboardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="1.6" y="3.6" width="12.8" height="8.8" rx="2" />
    <path d="M4.6 6.6h.8M7.6 6.6h.8M10.6 6.6h.8M5.4 9.6h5.2" />
  </Svg>
);

export const ChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 3.5 5.5 8l4.5 4.5" />
  </Svg>
);

export const ChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3.5 10.5 8 6 12.5" />
  </Svg>
);

export const ChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 6 8 10.5 12.5 6" />
  </Svg>
);

export const ChevronUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 10 8 5.5l4.5 4.5" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3v10M3 8h10" />
  </Svg>
);

/** More: three dots. */
export const EllipsisIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
    <circle cx="3.6" cy="8" r="0.95" />
    <circle cx="8" cy="8" r="0.95" />
    <circle cx="12.4" cy="8" r="0.95" />
  </svg>
);

/** History: a clock whose hand turns back. */
export const HistoryIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.2 8a5.8 5.8 0 1 0 5.8-5.8 6.3 6.3 0 0 0-4.35 1.77L2.2 5.4" />
    <path d="M2.2 2.4v3h3" />
    <path d="M8 5v3l2.2 1.2" />
  </Svg>
);

export const XIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="4.4" />
    <path d="m10.3 10.3 3.2 3.2" />
  </Svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </Svg>
);

/** Back: an arrow to the left. */
export const ArrowLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 8H3M7 4 3 8l4 4" />
  </Svg>
);

/** Back to the present (today, this week, this month): an arrow that turns round. */
export const ReturnIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 6.2h6.7a3.4 3.4 0 0 1 0 6.8H6.5" />
    <path d="M5.6 3.6 3 6.2l2.6 2.6" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.8 4.3h10.4M6.4 4.3V3a1 1 0 0 1 1-1h1.2a1 1 0 0 1 1 1v1.3M4.2 4.3l.6 8.6a1.3 1.3 0 0 0 1.3 1.2h3.8a1.3 1.3 0 0 0 1.3-1.2l.6-8.6" />
  </Svg>
);

export const SignOutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 2.5H4a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 4 13.5h2.5M10.5 11 13.5 8l-3-3M13.5 8H6.5" />
  </Svg>
);

/** Checkmark sized for checkboxes: a touch firmer than the line icons, so it reads inside a small filled box. */
export function CheckIcon({ size = 10, className }: IconProps) {
  return (
    <svg data-icon="" width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" className={className}>
      <path d="M2 5.3 4.1 7.3 8 3" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Official Google "G" mark. */
export function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Apple's logo, in the current text color (Sign in with Apple guidelines). */
export function AppleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

export function PauseIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" className={className}>
      <rect x="2.5" y="2" width="2.4" height="8" rx="0.8" />
      <rect x="7.1" y="2" width="2.4" height="8" rx="0.8" />
    </svg>
  );
}

export function PlayIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M3.5 2.4v7.2c0 .5.55.8.97.53l5.5-3.6a.63.63 0 0 0 0-1.06l-5.5-3.6a.63.63 0 0 0-.97.53Z" />
    </svg>
  );
}

export const SortIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 2.5v11M2.5 11 5 13.5 7.5 11M11 13.5v-11M8.5 5 11 2.5 13.5 5" />
  </Svg>
);

/** Focus mode: a viewfinder's four corners around a single line, one task in frame. */
export const FocusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 5.75v-2a1.25 1.25 0 0 1 1.25-1.25h2" />
    <path d="M10.25 2.5h2a1.25 1.25 0 0 1 1.25 1.25v2" />
    <path d="M13.5 10.25v2a1.25 1.25 0 0 1-1.25 1.25h-2" />
    <path d="M5.75 13.5h-2a1.25 1.25 0 0 1-1.25-1.25v-2" />
    <path d="M5.5 8h5" />
  </Svg>
);

/** Goals: a milestone, the diamond a plan marks its goals with, its corners softened like the family's frames. */
export const GoalIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.85 3.05 12.95 7.15a1.2 1.2 0 0 1 0 1.7l-4.1 4.1a1.2 1.2 0 0 1-1.7 0l-4.1-4.1a1.2 1.2 0 0 1 0-1.7l4.1-4.1a1.2 1.2 0 0 1 1.7 0Z" />
  </Svg>
);

/** Timeline: three spans of time, one after another, as on a plan laid out along the days. */
export const TimelineIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="2.5" width="7" height="2.5" rx="1.25" />
    <rect x="5" y="6.75" width="9" height="2.5" rx="1.25" />
    <rect x="3.5" y="11" width="6" height="2.5" rx="1.25" />
  </Svg>
);

/** The agent, and anything the AI does: one four-pointed spark with slender points. */
export const SparkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2.25C8.3 6.3 9.7 7.7 13.75 8 9.7 8.3 8.3 9.7 8 13.75 7.7 9.7 6.3 8.3 2.25 8 6.3 7.7 7.7 6.3 8 2.25Z" />
  </Svg>
);
export const AgentIcon = SparkIcon;

/** More: three dots, one above the other. */
export const EllipsisVerticalIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
    <circle cx="8" cy="3.6" r="0.95" />
    <circle cx="8" cy="8" r="0.95" />
    <circle cx="8" cy="12.4" r="0.95" />
  </svg>
);

/** The sidebar: a panel with its edge (hide it, show it). */
export const SidebarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="2.5" width="12" height="11" rx="2.4" />
    <path d="M6.2 2.5v11" />
  </Svg>
);

/** Open in full: an arrow up and to the right. */
export const OpenIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 11 11 5M6.2 5H11v4.8" />
  </Svg>
);

/** Stop (listening): a filled square. */
export function StopIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" className={className}>
      <rect x="2.5" y="2.5" width="7" height="7" rx="1.8" />
    </svg>
  );
}

/** Offline: a cloud with a slash. */
export const CloudOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.2 5.2A3.6 3.6 0 0 0 4.4 12h7.1M8.4 4.5a3.6 3.6 0 0 1 3.4 3.1A2.4 2.4 0 0 1 13.6 11M2.5 2.5l11 11" />
  </Svg>
);

/** A stopwatch, for the focus timer. */
export const TimerIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="9" r="5" />
    <path d="M8 6.4V9l1.7 1.1M6.5 1.8h3" />
  </Svg>
);

/** Download (export). */
export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2.5v7.5M4.8 7 8 10.2 11.2 7M3 13h10" />
  </Svg>
);
