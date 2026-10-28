// SF Symbols-style line icons (1.6 stroke, 16px grid by default). Decorative: hidden from assistive tech.

type IconProps = { size?: number; className?: string; strokeWidth?: number };

function Svg({ size = 16, className, strokeWidth = 1.6, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
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

export const WeekIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="1.8" y="2.6" width="12.4" height="10.8" rx="2.2" />
    <path d="M6 2.6v10.8M10 2.6v10.8" />
  </Svg>
);

export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="1.8" y="2.6" width="12.4" height="11" rx="2.2" />
    <path d="M1.8 6.2h12.4M5 1.4v2.4M11 1.4v2.4" />
    <path d="M4.8 8.8h.01M8 8.8h.01M11.2 8.8h.01M4.8 11.2h.01M8 11.2h.01" strokeWidth={2} />
  </Svg>
);

export const ChartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 14h12" />
    <rect x="3" y="8" width="2.4" height="4.2" rx=".7" />
    <rect x="6.8" y="4.5" width="2.4" height="7.7" rx=".7" />
    <rect x="10.6" y="2" width="2.4" height="10.2" rx=".7" />
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
    <path d="M8 2.8v10.4M2.8 8h10.4" />
  </Svg>
);

export const EllipsisIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.2}>
    <path d="M3.5 8h.01M8 8h.01M12.5 8h.01" />
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

export const ListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 4h7.5M6 8h7.5M6 12h7.5M2.6 4h.01M2.6 8h.01M2.6 12h.01" />
  </Svg>
);

/** Checkmark sized for checkboxes. */
export function CheckIcon({ size = 10, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" className={className}>
      <path d="M2 5.3 4.1 7.3 8 3" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
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

/** A flame with a small inner flame cut out, so it doesn't read as a drop at small sizes. */
export function FlameIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        d="M8.2 1C8.5 3.1 10.1 4.6 11.4 6.1 12.5 7.4 13.2 8.8 13.2 10.4 13.2 13.1 10.9 15 8 15 5.1 15 2.8 13.1 2.8 10.4 2.8 8.6 3.6 7.1 4.7 6 4.8 7.2 5.3 8.1 6.1 8.6 6.1 6 6.7 3.1 8.2 1ZM8.1 9.4C9 10.3 10 11.1 10 12.4 10 13.5 9.1 14.2 8 14.2 6.9 14.2 6 13.5 6 12.4 6 11.4 6.9 10.5 8.1 9.4Z"
      />
    </svg>
  );
}

export const SortIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 2.5v11M2.5 11 5 13.5 7.5 11M11 13.5v-11M8.5 5 11 2.5 13.5 5" />
  </Svg>
);

export const MoonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z" />
  </Svg>
);

/** Auto theme: a circle, half filled. */
export const AutoIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5.8" />
    <path d="M8 2.2v11.6A5.8 5.8 0 0 0 8 2.2Z" fill="currentColor" stroke="none" />
  </Svg>
);

/** Focus mode: a target. */
export const FocusIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5.8" />
    <circle cx="8" cy="8" r="2.4" />
  </Svg>
);

