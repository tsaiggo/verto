# Mail sender brand assets

This local pack identifies common service senders. These are brand marks, not contact photos or authentication badges. They are served locally; avatar display does not send an email address to a logo service.

Assets retrieved on 2026-10-01. Logo proportions are preserved. The avatar component supplies a white surface and visual padding in both themes; marks do not contain an avatar frame or status badge.

## Sources and transformations

| File | Mark | Source | Snapshot / provenance | Transformation |
| --- | --- | --- | --- | --- |
| `google.svg` | Google classic four-color G | [Source](https://www.gstatic.com/images/branding/productlogos/googleg/v6/24px.svg) | Google primary asset; v6 | Fixed size removed; original vector geometry and colors. |
| `gmail.svg` | Gmail | [Source](https://www.gstatic.com/images/branding/productlogos/gmail_2026/v2/web/192px.svg) | Google primary asset; gmail_2026/v2 | Fixed size removed; viewBox cropped to mark bounds; paths and gradients unchanged. |
| `apple.svg` | Apple | [Source](https://raw.githubusercontent.com/simple-icons/simple-icons/16.33.0/icons/apple.svg) | Simple Icons 16.33.0; CC0-1.0 | Added upstream brand fill #000000. |
| `microsoft.svg` | Microsoft | [Source](https://blogs.microsoft.com/blog/2012/08/23/microsoft-unveils-a-new-look/) | Microsoft primary reference | Native four-square geometry, 11-unit squares / 1-unit gutters; standard symbol palette. |
| `github.svg` | GitHub | [Source](https://raw.githubusercontent.com/simple-icons/simple-icons/16.33.0/icons/github.svg) | Simple Icons 16.33.0; CC0-1.0 | Added upstream brand fill #181717. |
| `notion.svg` | Notion | [Source](https://raw.githubusercontent.com/simple-icons/simple-icons/16.33.0/icons/notion.svg) | Simple Icons 16.33.0; CC0-1.0 | Added upstream brand fill #000000. |
| `amazon.svg` | Amazon | [Source](https://raw.githubusercontent.com/simple-icons/simple-icons/14.15.0/icons/amazon.svg) | Simple Icons 14.15.0; CC0-1.0 | Split existing closed subpaths into black a (#232F3E) and orange smile (#FF9900); vector geometry unchanged. |
| `spotify.svg` | Spotify | [Source](https://raw.githubusercontent.com/simple-icons/simple-icons/16.33.0/icons/spotify.svg) | Simple Icons 16.33.0; CC0-1.0 | Added upstream brand fill #1ED760. |
| `slack.svg` | Slack | [Source](https://a.slack-edge.com/9cc0056/marketing/img/nav/logo.svg) | Slack primary asset; 9cc0056 | Fixed size removed; paths, colors and clipping unchanged. |
| `dropbox.svg` | Dropbox | [Source](https://raw.githubusercontent.com/simple-icons/simple-icons/16.33.0/icons/dropbox.svg) | Simple Icons 16.33.0; CC0-1.0 | Added upstream brand fill #0061FF. |

Google's `v6` G is the recognizable classic four-color version, not a claim to be the latest Google identity. The current [Google Identity download](https://developers.google.com/identity/branding-guidelines) included an SVG with HTML `foreignObject` content; this pack uses Google's safe native SVG instead. Gmail uses the current 2026 asset linked by the [official Gmail product page](https://workspace.google.com/products/gmail/). Slack's source is linked by its [official media kit](https://slack.com/media-kit).

Simple Icons 16.33.0 is pinned to Git tree `e01988cc57a3aca39621023f9881e9b733ebcd77`. Amazon is intentionally pinned to 14.15.0 because it is absent from 16.33.0. Simple Icons provides these vectors under [CC0 1.0 Universal](https://github.com/simple-icons/simple-icons/blob/16.33.0/LICENSE.md); the upstream logo names and marks remain those of their respective owners. Primary Google, Microsoft and Slack assets are not represented as CC0 assets.

Upstream brand references from Simple Icons metadata: [Apple](https://www.apple.com), [GitHub](https://github.com/logos), [Notion](https://www.notion.so), [Amazon](https://www.amazon.com), [Spotify](https://developer.spotify.com/documentation/general/design-and-branding/#using-our-logo), [Dropbox](https://www.dropbox.com/branding).

## Local SVG constraints

All ten files are self-contained native SVG. They contain no scripts, event attributes, external image/reference requests, HTML `foreignObject` content, or embedded contact information. Every gradient, clip and mask reference targets a definition within its own file.

## Checksums

SHA-256 of the delivered SVG files:

- `google.svg`: `af0188679ede2c341aeebe48063a09c4567d4dc46e0774b1caca34c91c503bed`
- `gmail.svg`: `47e23cc3d06a2ad4fc952def5ff38191615cf391ec33851c46f9e8a92dcb39a5`
- `apple.svg`: `7b6e6e3a4d8a94d5c66b7d6a614d9bc69e254a8311bc6f3a3b33f90a6b72e11f`
- `microsoft.svg`: `b920527ad899bfb19b2799010e74556d6e783668ad216a566bb9becf9aa90767`
- `github.svg`: `65e98835a3317f62f0f57dcf28cb142cb0d47163c56ccbe3d7c185c55622a97b`
- `notion.svg`: `9c063cc47a0475e6431593687a0f746370a2538543ec47c3ea64b53b82e59648`
- `amazon.svg`: `c7fc35d0855825ab26daa58981954478b60f0193dff64175a569e4ab67187c88`
- `spotify.svg`: `f9a5953fa2eb85e465280ef16c1d82211d7be47817a217a3a8f0631287213ced`
- `slack.svg`: `4b182f21bb9b4f3e18b31d3410a259569cf9595d876174cfcf74af8f558b65d0`
- `dropbox.svg`: `5866286a0bf367d12e9b3593d7a540ac6a0c83cf7db245d9e7261a5609dc7d1c`
