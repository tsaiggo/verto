export interface TextareaCaretPosition {
  left: number;
  top: number;
  lineHeight: number;
}

export function measureTextareaCaret(
  textarea: HTMLTextAreaElement,
  caret: number
): TextareaCaretPosition {
  const computed = window.getComputedStyle(textarea);
  const textareaRect = textarea.getBoundingClientRect();
  const mirror = document.createElement("div");
  const marker = document.createElement("span");
  const copiedProperties = [
    "borderBottomWidth",
    "borderLeftWidth",
    "borderRightWidth",
    "borderTopWidth",
    "boxSizing",
    "fontFamily",
    "fontSize",
    "fontStretch",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
    "paddingBottom",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "tabSize",
    "textAlign",
    "textIndent",
    "textTransform",
    "wordSpacing",
  ] as const;

  Object.assign(mirror.style, {
    height: `${textarea.clientHeight}px`,
    left: `${textareaRect.left}px`,
    overflow: "hidden",
    overflowWrap: "break-word",
    position: "fixed",
    top: `${textareaRect.top}px`,
    visibility: "hidden",
    whiteSpace: "pre-wrap",
    width: `${textarea.clientWidth}px`,
    wordBreak: computed.wordBreak,
  });
  for (const property of copiedProperties) mirror.style[property] = computed[property];

  mirror.textContent = textarea.value.slice(0, caret);
  marker.textContent = textarea.value.slice(caret, caret + 1) || "\u200b";
  mirror.append(marker);
  document.body.append(mirror);
  const markerRect = marker.getBoundingClientRect();
  mirror.remove();
  const lineHeight =
    Number.parseFloat(computed.lineHeight) || Number.parseFloat(computed.fontSize) * 1.6 || 20;

  return {
    left: markerRect.left - textareaRect.left - textarea.scrollLeft,
    top: markerRect.top - textareaRect.top - textarea.scrollTop,
    lineHeight,
  };
}

export function scrollTextareaSelectionIntoView(textarea: HTMLTextAreaElement) {
  const position = measureTextareaCaret(textarea, textarea.selectionEnd);
  const visibleTop = textarea.scrollTop;
  const visibleBottom = visibleTop + textarea.clientHeight;
  const caretBottom = position.top + textarea.scrollTop + position.lineHeight;
  if (caretBottom > visibleBottom) textarea.scrollTop = caretBottom - textarea.clientHeight + 20;
  else if (position.top + textarea.scrollTop < visibleTop) textarea.scrollTop = position.top;
}

export function clampEditorMenuPosition(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
