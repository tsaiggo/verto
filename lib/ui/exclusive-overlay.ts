export type ExclusiveOverlay = "mobile-navigation" | "reading-companion";

const EXCLUSIVE_OVERLAY_EVENT = "verto:exclusive-overlay-request";
let activeExclusiveOverlay: ExclusiveOverlay | null = null;

interface ExclusiveOverlayDetail {
  overlay: ExclusiveOverlay;
  open: boolean;
}

/**
 * Coordinates the app's viewport-filling overlays without coupling their
 * component state. On narrow screens Reading settings is a non-modal Radix
 * popover, so close its open trigger before handing control to an exclusive
 * overlay. Wide companion docks remain non-modal and may coexist with it.
 */
export function requestExclusiveOverlay(overlay: ExclusiveOverlay): void {
  if (typeof window === "undefined") return;

  activeExclusiveOverlay = overlay;

  if (!window.matchMedia("(min-width: 1400px)").matches) {
    document
      .querySelector<HTMLButtonElement>('button[aria-label="Reading settings"][data-state="open"]')
      ?.click();
  }

  window.dispatchEvent(
    new CustomEvent<ExclusiveOverlayDetail>(EXCLUSIVE_OVERLAY_EVENT, {
      detail: { overlay, open: true },
    })
  );
}

export function releaseExclusiveOverlay(overlay: ExclusiveOverlay): void {
  if (typeof window === "undefined") return;
  if (activeExclusiveOverlay === overlay) activeExclusiveOverlay = null;
  window.dispatchEvent(
    new CustomEvent<ExclusiveOverlayDetail>(EXCLUSIVE_OVERLAY_EVENT, {
      detail: { overlay, open: false },
    })
  );
}

export function onExclusiveOverlayChange(
  listener: (overlay: ExclusiveOverlay, open: boolean) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handleRequest = (event: Event) => {
    const overlay = (event as CustomEvent<ExclusiveOverlayDetail>).detail?.overlay;
    if (overlay === "mobile-navigation" || overlay === "reading-companion") {
      listener(overlay, Boolean((event as CustomEvent<ExclusiveOverlayDetail>).detail?.open));
    }
  };

  window.addEventListener(EXCLUSIVE_OVERLAY_EVENT, handleRequest);
  if (activeExclusiveOverlay) listener(activeExclusiveOverlay, true);
  return () => window.removeEventListener(EXCLUSIVE_OVERLAY_EVENT, handleRequest);
}
