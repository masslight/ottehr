import { RefObject, useEffect, useRef } from 'react';

// what takes the cursor in a field: its input (not a Select's hidden one), or the Select itself
const FOCUSABLE = 'input:not([type="hidden"]):not([aria-hidden="true"]), textarea, [tabindex="0"]';

const scrollToMiddle = (field: HTMLElement): void => field.scrollIntoView({ behavior: 'smooth', block: 'center' });

// After a save that fails validation, once its errors are on screen: puts the cursor in the first field
// showing one (in page order) and scrolls it to the middle of the view. Only a save does this, not
// errors coming and going while the biller fixes things. Takes react-hook-form's submitCount and
// errors, which arrive together; `within` limits the search to part of the page, such as a dialog.
export function useRevealFirstError(submitCount: number, errors: object, within?: RefObject<HTMLElement>): void {
  const handled = useRef(submitCount);
  const waitingToScroll = useRef<MutationObserver | null>(null);

  useEffect(() => () => waitingToScroll.current?.disconnect(), []);

  useEffect(() => {
    if (submitCount === handled.current) return;
    handled.current = submitCount;
    waitingToScroll.current?.disconnect();
    if (Object.keys(errors).length === 0) return;
    const marked = (within?.current ?? document).querySelector('.Mui-error');
    const field = marked?.closest<HTMLElement>('.MuiFormControl-root') ?? marked;
    if (!(field instanceof HTMLElement)) return;
    field.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });

    // In a section the save just opened (a collapsed claim), the field only reaches its place once the
    // section has finished sliding open, so the scroll waits for that.
    const opening = field.closest('.MuiCollapse-root:not(.MuiCollapse-entered)');
    if (!opening) {
      scrollToMiddle(field);
      return;
    }
    const observer = new MutationObserver(() => {
      if (!opening.classList.contains('MuiCollapse-entered')) return;
      observer.disconnect();
      scrollToMiddle(field);
    });
    observer.observe(opening, { attributes: true, attributeFilter: ['class'] });
    waitingToScroll.current = observer;
  }, [submitCount, errors, within]);
}
