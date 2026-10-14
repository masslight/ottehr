import { Tooltip } from '@mui/material';
import { FC, ReactElement } from 'react';
import { AUTOCHART_LOCKED_TOOLTIP } from './useAutochartLock';

/**
 * Explains a control that is off because the chart is locked. The span is what the tooltip listens on: a
 * disabled button fires no pointer events of its own.
 */
export const LockedHint: FC<{ locked: boolean; children: ReactElement }> = ({ locked, children }) =>
  locked ? (
    <Tooltip title={AUTOCHART_LOCKED_TOOLTIP} placement="top" arrow>
      <span style={{ display: 'inline-flex', cursor: 'not-allowed' }}>{children}</span>
    </Tooltip>
  ) : (
    children
  );
