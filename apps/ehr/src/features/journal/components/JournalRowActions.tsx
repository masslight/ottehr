import { Box, IconButton, Tooltip } from '@mui/material';
import { Fragment, MouseEvent, ReactElement } from 'react';
import { DEFAULT_TOOLTIP_PROPS } from 'src/components/WithTooltip';
import { JournalAction, ROW_ICON_ORDER, ROW_ICON_SEPARATOR_AFTER } from '../helpers/journalActions';
import { JOURNAL_COLORS } from '../helpers/journalHelpers';

const ICON_SX = {
  width: 34,
  height: 34,
  color: 'primary.main',
  '& svg': { width: 20, height: 20 },
  '&:hover': { bgcolor: JOURNAL_COLORS.primaryTint },
  '&.Mui-disabled': { color: JOURNAL_COLORS.disabledIcon },
};

/** The row's icon group; clicks never toggle the row. */
export const JournalRowActions = ({ actions }: { actions: JournalAction[] }): ReactElement | null => {
  const ordered = ROW_ICON_ORDER.map((key) => actions.find((a) => a.key === key)).filter(
    (a): a is JournalAction => !!a
  );
  if (!ordered.length) return null;
  const stop = (e: MouseEvent): void => e.stopPropagation();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={stop}>
      {ordered.map((action, index) => {
        const disabled = !!action.disabledReason;
        const button = (
          <IconButton
            aria-label={action.tooltip}
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
            <Tooltip {...DEFAULT_TOOLTIP_PROPS} title={action.disabledReason ?? action.tooltip}>
              {disabled ? <span>{button}</span> : button}
            </Tooltip>
            {action.key === ROW_ICON_SEPARATOR_AFTER && index < ordered.length - 1 && (
              <Box component="span" sx={{ color: JOURNAL_COLORS.line, flexShrink: 0 }}>
                |
              </Box>
            )}
          </Fragment>
        );
      })}
    </Box>
  );
};
