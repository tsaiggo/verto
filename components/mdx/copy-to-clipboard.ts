export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyWithLegacyFallback(text);
  }
}

function copyWithLegacyFallback(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";

  try {
    document.body.appendChild(textarea);
    textarea.select();
    return document.execCommand("copy") === true;
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
