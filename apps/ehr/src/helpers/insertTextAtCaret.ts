export type InsertTarget = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

export interface InsertContext {
  target: InsertTarget;
  range: Range | null;
}

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'password']);

export const getInsertTarget = (element: Element | null): InsertTarget | null => {
  if (element instanceof HTMLTextAreaElement) return element.readOnly || element.disabled ? null : element;
  if (element instanceof HTMLInputElement) {
    if (element.readOnly || element.disabled) return null;
    return TEXT_INPUT_TYPES.has(element.type) ? element : null;
  }
  if (element instanceof HTMLElement && element.isContentEditable) return element;
  return null;
};

const isFormField = (target: InsertTarget): target is HTMLInputElement | HTMLTextAreaElement =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

const tryExecInsertText = (text: string): boolean => {
  try {
    return document.execCommand('insertText', false, text);
  } catch {
    return false;
  }
};

const rangeInTarget = (target: HTMLElement): Range | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  return target.contains(range.commonAncestorContainer) ? range : null;
};

export const captureInsertContext = (element: Element | null): InsertContext | null => {
  const target = getInsertTarget(element);
  if (!target) return null;
  if (isFormField(target)) return { target, range: null };
  return { target, range: rangeInTarget(target)?.cloneRange() ?? null };
};

const setNativeValue = (target: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
  const prototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) {
    setter.call(target, value);
  } else {
    target.value = value;
  }
};

const withSeparator = (preceding: string | undefined, text: string): string =>
  preceding && !/\s/.test(preceding) && !/^\s/.test(text) ? ` ${text}` : text;

const insertIntoContentEditable = (target: HTMLElement, savedRange: Range | null, text: string): void => {
  target.focus();
  const selection = window.getSelection();
  if (savedRange && selection && target.contains(savedRange.commonAncestorContainer)) {
    selection.removeAllRanges();
    selection.addRange(savedRange);
  }

  const caretRange = rangeInTarget(target);
  if (caretRange) {
    const { startContainer, startOffset } = caretRange;
    const preceding =
      startContainer.nodeType === Node.TEXT_NODE ? startContainer.textContent?.[startOffset - 1] : undefined;
    text = withSeparator(preceding, text);
  }

  if (tryExecInsertText(text)) return;

  const range =
    caretRange ??
    (() => {
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
  target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
};

const insertIntoFormField = (
  target: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  start: number,
  end: number
): void => {
  target.focus();
  target.setSelectionRange(start, end);
  if (tryExecInsertText(text)) return;
  setNativeValue(target, target.value.slice(0, start) + text + target.value.slice(end));
  target.dispatchEvent(new Event('input', { bubbles: true }));
  const caret = start + text.length;
  target.setSelectionRange(caret, caret);
};

export const insertTextAtCaret = (context: InsertContext, text: string): void => {
  const { target, range } = context;

  if (!isFormField(target)) {
    window.requestAnimationFrame(() => insertIntoContentEditable(target, range, text));
    return;
  }

  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? start;
  text = withSeparator(target.value[start - 1], text);
  window.requestAnimationFrame(() => insertIntoFormField(target, text, start, end));
};
