import { ImageResponse } from "next/og";

export const alt = "Hyperanchor — own your day, week and month";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#171717";
const ACCENT = INK;

function Row({ title, done }: { title: string; done: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 0", borderTop: "2px solid #ededed" }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: done ? ACCENT : "transparent",
          border: done ? "none" : "3px solid #b8b8b8",
        }}
      >
        {done && (
          <svg width="18" height="18" viewBox="0 0 12 12">
            <path d="M2.6 6.3 5 8.6 9.4 3.7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div style={{ fontSize: 26, color: done ? "#6b6b6b" : INK }}>{title}</div>
    </div>
  );
}

/** The link preview: the logo, the promise and a small Today card. */
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: "#ffffff", padding: "0 80px", gap: 64 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          {/* The name, as text (no logo for now). */}
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1.6, color: INK, display: "flex" }}>hyperanchor</div>
          <div style={{ marginTop: 56, fontSize: 76, fontWeight: 700, lineHeight: 1.08, letterSpacing: -3, color: INK, display: "flex", flexDirection: "column" }}>
            <span>Own your day,</span>
            <span>week and month.</span>
          </div>
          <div style={{ marginTop: 28, fontSize: 32, color: "#525252" }}>A calm, fast planner.</div>
        </div>
        <div
          style={{
            width: 430,
            display: "flex",
            flexDirection: "column",
            padding: "34px 36px 20px",
            borderRadius: 32,
            background: "#ffffff",
            boxShadow: "0 0 0 2px rgba(0,0,0,0.06), 0 24px 60px -20px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 34, fontWeight: 700, color: INK, letterSpacing: -1 }}>Today</div>
              <div style={{ fontSize: 20, color: "#6b6b6b", marginTop: 4 }}>2 of 4 done</div>
            </div>
            <svg width="52" height="52" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e2e2" strokeWidth="4" />
              <circle cx="18" cy="18" r="15" fill="none" stroke={ACCENT} strokeWidth="4" strokeLinecap="round" strokeDasharray="94.25" strokeDashoffset="47.12" />
            </svg>
          </div>
          <Row title="Plan the week" done />
          <Row title="Send the proposal" done />
          <Row title="Gym, 45 minutes" done={false} />
          <Row title="Call mom" done={false} />
        </div>
      </div>
    ),
    size,
  );
}
