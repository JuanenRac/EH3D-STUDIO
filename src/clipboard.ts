/** Puts a text in the clipboard. The clipboard of the browser (navigator.clipboard) exists only on a secure page (HTTPS or localhost) and Studio is usually
 * served over plain HTTP from the CM5, so there the old way is used: a hidden box with the text, selected, and the copy command. Says whether it worked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof window !== "undefined" && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // refused (no permission, no focus): the old way below
  }
  return copyWithSelection(text);
}

export function copyWithSelection(text: string, doc: Document | undefined = typeof document === "undefined" ? undefined : document): boolean {
  if (!doc || !doc.body) return false;
  const box = doc.createElement("textarea");
  box.value = text;
  box.setAttribute("readonly", "");
  box.setAttribute("aria-hidden", "true");
  box.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none";
  const before = doc.activeElement as HTMLElement | null;
  doc.body.appendChild(box);
  try {
    box.focus();
    box.select();
    box.setSelectionRange(0, text.length);
    return doc.execCommand("copy");
  } catch {
    return false;
  } finally {
    doc.body.removeChild(box);
    before?.focus?.();
  }
}
