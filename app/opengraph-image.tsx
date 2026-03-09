import { ImageResponse } from 'next/og';
import { siteConfig } from '@/lib/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16162a 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: siteConfig.accentColor,
            display: 'flex',
          }}
        />

        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="100"
          height="100"
          viewBox={siteConfig.logo.viewBox}
          fill="white"
          style={{ marginBottom: 24 }}
        >
          <path d={siteConfig.logo.svgPath} />
        </svg>

        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-0.02em',
            display: 'flex',
          }}
        >
          {siteConfig.name}
        </div>

        <div
          style={{
            fontSize: 28,
            color: '#a0a0b0',
            marginTop: 12,
            fontWeight: 400,
            letterSpacing: '0.04em',
            display: 'flex',
          }}
        >
          {siteConfig.tagline}
        </div>
      </div>
    ),
    { ...size },
  );
}
