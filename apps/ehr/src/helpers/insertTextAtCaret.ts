/** A focused element the command palette can insert text into. */
export type InsertTarget = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

// Input types whose selectionStart/End are readable; others (checkbox, date, email…) throw or have no caret.
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'password']);

/** Returns `element` when it is a text-capable input/textarea/contentEditable, otherwise null. */
export const getInsertTarget = (element: Element | null): InsertTarget | null => {
  if (element instanceof HTMLTextAreaElement) return element;
  if (element instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(element.type) ? element : null;
  if (element instanceof HTMLElement && element.isContentEditable) return element;
  return null;
};

const isFormField = (target: InsertTarget): target is HTMLInputElement | HTMLTextAreaElement =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

const setNativeValue = (target: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
  // Use the prototype setter so React's value tracker sees the change and the
  // subsequent 'input' event reaches controlled fields (react-hook-form, debounced autosave).
  const prototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) {
    setter.call(target, value);
  } else {
    target.value = value;
  }
};

/** Prefixes a space when `text` would otherwise run straight into a preceding non-whitespace character. */
const withSeparator = (preceding: string | undefined, text: string): string =>
  preceding && !/\s/.test(preceding) && !/^\s/.test(text) ? ` ${text}` : text;

const insertIntoContentEditable = (target: HTMLElement, text: string): void => {
  target.focus();
  const selection = window.getSelection();
  const hasRangeInTarget =
    !!selection && selection.rangeCount > 0 && target.contains(selection.getRangeAt(0).commonAncestorContainer);
  if (hasRangeInTarget) {
    const { startContainer, startOffset } = selection.getRangeAt(0);
    const preceding =
      startContainer.nodeType === Node.TEXT_NODE ? startContainer.textContent?.[startOffset - 1] : undefined;
    text = withSeparator(preceding, text);
  }
  // execCommand keeps editors (TipTap/ProseMirror, plain contentEditable) in sync with their own state.
  if (document.execCommand('insertText', false, text)) return;
  const range = hasRangeInTarget
    ? selection.getRangeAt(0)
    : (() => {
        const endRange = document.createRange();
        endRange.selectNodeContents(target);
        endRange.collapse(false);
        return endRange;
      })();
  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
};

const insertIntoFormField = (
  target: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  start: number,
  end: number
): void => {
  // Restore the selection captured before the palette opened: some browsers reset it on blur.
  target.focus();
  target.setSelectionRange(start, end);
  // execCommand replaces the selection, pushes a browser undo entry, and fires the native 'input'
  // event React/react-hook-form listen to; it leaves the caret after the inserted text.
  try {
    if (document.execCommand('insertText', false, text)) return;
  } catch {
    // Unsupported (no editing host) — fall through to the manual insert below.
  }
  setNativeValue(target, target.value.slice(0, start) + text + target.value.slice(end));
  target.dispatchEvent(new Event('input', { bubbles: true }));
  const caret = start + text.length;
  target.setSelectionRange(caret, caret);
};

/**
 * Inserts `text` at the caret of `target`, replacing any selection. A single space is prepended when
 * the caret directly follows a non-whitespace character (so "Plan:" + phrase becomes "Plan: phrase"),
 * unless the phrase itself starts with whitespace. Meant to be called right before the command palette
 * closes: the selection is captured synchronously (the palette may still hold focus), then the insert
 * runs on the next frame — after MUI Dialog has handed focus back to the target — via execCommand,
 * which makes it undoable through the browser's undo stack. Falls back to a direct value set when
 * execCommand is unavailable.
 */
export const insertTextAtCaret = (target: InsertTarget, text: string): void => {
  if (!isFormField(target)) {
    window.requestAnimationFrame(() => insertIntoContentEditable(target, text));
    return;
  }

  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? start;
  text = withSeparator(target.value[start - 1], text);
  window.requestAnimationFrame(() => insertIntoFormField(target, text, start, end));
};
