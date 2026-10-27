import { Calculate } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { FC, ReactNode, useId, useState } from 'react';
import { BlankPopper } from '../procedures/narrative/InlineBlanks';

/** The calculator icon after a dose blank: a click opens the dose calculator under the line, and Escape, a click
 * away or `close` (from "Use this dose") shuts it. It never opens by itself. `label` names the icon where there are
 * several (a suggestion row's). */
export const DoseCalculatorPopup: FC<{ children: (close: () => void) => ReactNode; label?: string }> = ({
  children,
  label = 'Dose calculator',
}) => {
  const popupId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = (restoreFocus = true): void => {
    if (restoreFocus) anchor?.focus();
    setAnchor(null);
  };
  return (
    <>
      <IconButton
        size="small"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? popupId : undefined}
        onClick={(event) => (anchor ? close() : setAnchor(event.currentTarget))}
        color="primary"
        sx={{ p: '2px', mx: '2px', verticalAlign: '-3px', ...(anchor && { backgroundColor: 'action.selected' }) }}
      >
        <Calculate sx={{ fontSize: 18 }} />
      </IconButton>
      {anchor && (
        <BlankPopper
          anchor={anchor}
          id={popupId}
          title="Dose calculator"
          onClose={close}
          hideTitle
          paperSx={{ p: 0, minWidth: 0, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100dvh - 32px)' }}
        >
          {children(() => close())}
        </BlankPopper>
      )}
    </>
  );
};
