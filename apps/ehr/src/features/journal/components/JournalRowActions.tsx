import { Box, IconButton, Tooltip } from '@mui/material';
import { FocusEvent, Fragment, MouseEvent, ReactElement, useState } from 'react';
import { DEFAULT_TOOLTIP_PROPS } from 'src/components/WithTooltip';
import { JournalAction, ROW_ICON_ORDER, ROW_ICON_SEPARATOR_AFTER } from '../helpers/journalActions';
import { JOURNAL_COLORS, ROW_ACTIONS_CLASS } from '../helpers/journalHelpers';

const ICON_SX = {
  width: 34,
  height: 34,
  color: 'primary.main',
  '& svg': { width: 20, height: 20 },
  '&:hover': { bgcolor: JOURNAL_COLORS.primaryTint },
  '&.Mui-disabled': { color: JOURNAL_COLORS.disabledIcon },
};

/**
 * The row's icon group; clicks never toggle the row. One hover popup serves all the icons and points at the one under
 * the pointer or keyboard: a popup per icon was most of a row's cost, and a journal can draw hundreds of rows.
 */
export const JournalRowActions = ({ actions }: { actions: JournalAction[] }): ReactElement | null => {
  const [pointed, setPointed] = useState<HTMLElement>();
  const ordered = ROW_ICON_ORDER.map((key) => actions.find((a) => a.key === key)).filter(
    (a): a is JournalAction => !!a
  );
  if (!ordered.length) return null;
  const stop = (e: MouseEvent): void => e.stopPropagation();
  const point = (e: MouseEvent | FocusEvent): void => {
    const icon = (e.target as HTMLElement).closest<HTMLElement>('[data-action-key]') ?? undefined;
    setPointed((current) => (current === icon ? current : icon));
  };
  const clear = (): void => setPointed(undefined);
  const pointedAction = pointed && ordered.find((a) => a.key === pointed.dataset.actionKey);
  return (
    <Tooltip
      {...DEFAULT_TOOLTIP_PROPS}
      title={pointedAction ? pointedAction.disabledReason ?? pointedAction.tooltip : ''}
      open={!!pointedAction}
      describeChild
      disableHoverListener
      disableFocusListener
      disableTouchListener
      slotProps={{ popper: { anchorEl: pointed } }}
    >
      <Box
        className={ROW_ACTIONS_CLASS}
        sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        onClick={stop}
        onMouseOver={point}
        onMouseLeave={clear}
        onFocus={point}
        onBlur={clear}
      >
        {ordered.map((action, index) => {
          const disabled = !!action.disabledReason;
          const button = (
            <IconButton
              aria-label={action.tooltip}
              data-action-key={disabled ? undefined : action.key}
              sx={ICON_SX}
              disabled={disabled}
              {...(action.href && !disabled
                ? { component: 'a', href: action.href, target: '_blank', rel: 'noopener' }
                : { onClick: action.onClick })}
            >
              {action.icon}
            </IconButton>
          );
          return (
            <Fragment key={action.key}>
              {/* A disabled button gets no pointer events; its wrapper does, so its hover says why. */}
              {disabled ? <span data-action-key={action.key}>{button}</span> : button}
              {action.key === ROW_ICON_SEPARATOR_AFTER && index < ordered.length - 1 && (
                <Box component="span" sx={{ color: JOURNAL_COLORS.line, flexShrink: 0 }}>
                  |
                </Box>
              )}
            </Fragment>
          );
        })}
      </Box>
    </Tooltip>
  );
};
