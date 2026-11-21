import { Box, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { Fragment, ReactElement, ReactNode } from 'react';
import { PatientDateOfBirth } from 'src/components/PatientDateOfBirth';
import { JournalItem, JournalKind, JournalRow as JournalRowData } from 'utils/lib/types/api/provider-journal.types';
import { JournalAction } from '../helpers/journalActions';
import {
  formatAge,
  formatVisitDay,
  inProgressLabel,
  isInProgress,
  JOURNAL_COLORS,
  JournalRowRef,
  lookaheadLabel,
} from '../helpers/journalHelpers';
import { DotColor, JournalDot } from './JournalDot';
import { JournalItemLink } from './JournalItemLink';
import { JournalRowActions } from './JournalRowActions';

interface Props {
  rowRef: JournalRowRef;
  kind: JournalKind;
  now: DateTime;
  selected: boolean;
  actions: JournalAction[];
  onSelect: (key: string) => void;
  onOpenChat: (row: JournalRowData, item: JournalItem) => void;
}

export const QUIET_SX = { color: JOURNAL_COLORS.text2, fontSize: '13.5px' };
export const FLAG_SX = { color: JOURNAL_COLORS.red, fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap' };

const dotColor = (ref: JournalRowRef, kind: JournalKind): DotColor => {
  switch (ref.section) {
    case 'cu':
      return ref.row.lookahead ? 'none' : 'blue';
    case 'td':
      return isInProgress(ref.row, kind) ? 'purple' : 'orange';
    case 'tdd':
    case 'pa':
      return 'green';
    default:
      return 'orange';
  }
};

export const ItemSeparator = (): ReactElement => (
  <Box component="span" sx={{ color: JOURNAL_COLORS.line, flexShrink: 0 }}>
    |
  </Box>
);

export const JournalRow = ({ rowRef, kind, now, selected, actions, onSelect, onOpenChat }: Props): ReactElement => {
  const { row, section } = rowRef;
  const items = row.items.map((item, index) => (
    <Fragment key={item.id}>
      {index > 0 && <ItemSeparator />}
      <JournalItemLink item={item} now={now} onOpenChat={(item) => onOpenChat(row, item)} />
    </Fragment>
  ));

  let todo: ReactNode;
  if (section === 'cu') {
    // The reason and any flag show in the side column, as in the mockup; open to-dos follow, so the provider walks in knowing.
    todo = (
      <>
        <Box component="span" sx={QUIET_SX}>
          {row.lookahead || !row.waitingSince ? (
            lookaheadLabel(kind)
          ) : (
            <>
              Waiting{' '}
              <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatAge(row.waitingSince, now)}
              </Box>
              {row.room ? ` in room ${row.room}` : ''}
            </>
          )}
        </Box>
        {items.length > 0 && <ItemSeparator />}
        {items}
      </>
    );
  } else if (section === 'tdd') {
    todo = (
      <Box component="span" sx={QUIET_SX}>
        Nothing to do
      </Box>
    );
  } else if (section === 'pa') {
    todo = (
      <Box component="span" sx={QUIET_SX}>
        {row.visit ? `${formatVisitDay(row.visit.start)} · ` : ''}Nothing to do
      </Box>
    );
  } else if (section === 'td' && isInProgress(row, kind)) {
    todo = (
      <>
        <Box component="span" sx={QUIET_SX}>
          {inProgressLabel(kind)}
        </Box>
        {items.length > 0 && <ItemSeparator />}
        {items}
      </>
    );
  } else {
    todo = items;
  }

  const lookahead = section === 'cu' && !!row.lookahead;
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(rowRef.key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(rowRef.key);
        }
      }}
      sx={(theme) => ({
        display: 'grid',
        gridTemplateColumns: '10px 150px minmax(0, 1fr) auto',
        columnGap: '12px',
        alignItems: 'center',
        minHeight: 40,
        padding: '3px 6px 3px 10px',
        border: lookahead ? `1.5px dashed ${JOURNAL_COLORS.rowLineDash}` : `1px solid ${JOURNAL_COLORS.rowLine}`,
        borderRadius: '6px',
        cursor: 'pointer',
        '&:hover': { bgcolor: JOURNAL_COLORS.hover },
        ...(selected && {
          borderColor: theme.palette.primary.main,
          bgcolor: JOURNAL_COLORS.selected,
          boxShadow: `inset 3px 0 0 ${theme.palette.primary.main}`,
          '&:hover': { bgcolor: JOURNAL_COLORS.selected },
        }),
        [theme.breakpoints.down('md')]: {
          gridTemplateColumns: '10px minmax(0, 1fr) auto',
          rowGap: '2px',
          py: '6px',
          '& .journal-todo': { gridColumn: '2 / -1', gridRow: 2 },
        },
      })}
    >
      <JournalDot color={dotColor(rowRef, kind)} />
      {row.patient ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Typography
            component="span"
            sx={{
              fontWeight: 600,
              fontSize: 14,
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {row.patient.name}
          </Typography>
          {row.patient.birthDate && <PatientDateOfBirth dateOfBirth={row.patient.birthDate} />}
        </Box>
      ) : (
        <span />
      )}
      <Box
        className="journal-todo"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2px 6px',
          alignItems: 'center',
          minWidth: 0,
          fontSize: '13.5px',
        }}
      >
        {todo}
      </Box>
      <JournalRowActions actions={actions} />
    </Box>
  );
};
