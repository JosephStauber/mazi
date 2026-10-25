import { ImageResponse } from "next/og";

// Link-preview card for every page (Open Graph + Twitter fall back to it).
// CSS variables don't exist in the image renderer, so the Editorial Ink
// light-theme values from app/globals.css are repeated here.
const paper = "#faf6ef";
const ink = "#1f1b16";
const muted = "#7a7164";
const border = "#e4dccd";
const accent = "#e8552d";

export const alt = "Mazi — Social, without the noise. No algorithm, no ads, no tracking.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: paper,
          color: ink,
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>
          mazi<span style={{ color: accent }}>.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 104, lineHeight: 1.02, fontWeight: 700 }}>
            Social, without
          </div>
          <div style={{ display: "flex", fontSize: 104, lineHeight: 1.02, fontWeight: 700 }}>
            the&nbsp;<span style={{ color: accent, fontStyle: "italic" }}>noise.</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            paddingTop: 32,
            borderTop: `2px solid ${border}`,
            fontSize: 32,
            color: muted,
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: 6, background: accent }} />
          No algorithm · No ads · No tracking — mazi.social
        </div>
      </div>
    ),
    size,
  );
}
