import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
// Required for Next.js static export (`output: 'export'`, used by the Tauri build).
export const dynamic = "force-static";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: siteConfig.accentColor,
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="110"
        height="110"
        viewBox={siteConfig.logo.viewBox}
        fill="white"
      >
        <path d={siteConfig.logo.svgPath} />
      </svg>
    </div>,
    { ...size }
  );
}
