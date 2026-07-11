# App icons

Tauri requires a set of platform icons in this directory before
`tauri build` will succeed. They are deliberately **not** checked in so
they don't bloat the repo. The Verto scripts generate them automatically for
`npm run build:tauri` and `npm run tauri:dev`.

Generate them once locally from any square source image (≥ 1024×1024
PNG, preferably with transparency). The repo ships `icon.png` at the
root for this purpose:

```bash
npm run generate:tauri-icons
```

That writes `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`,
`icon.ico`, plus the Windows Store `Square*.png` set, all into this
folder. CI does the same step automatically — see
`.github/workflows/release.yml`.
