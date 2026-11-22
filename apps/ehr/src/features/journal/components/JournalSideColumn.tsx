import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import PhoneIcon from '@mui/icons-material/Phone';
import { Box, Button, ButtonGroup, Link, Menu, MenuItem, Skeleton, Tooltip, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement, ReactNode, useState } from 'react';
import { PatientDateOfBirth } from 'src/components/PatientDateOfBirth';
import { DEFAULT_TOOLTIP_PROPS } from 'src/components/WithTooltip';
import {
  JournalItem,
  JournalKind,
  JournalPatient,
  JournalRow,
  JournalVisit,
} from 'utils/lib/types/api/provider-journal.types';
import { JournalAction, SIDE_BUTTON_ORDER } from '../helpers/journalActions';
import {
  formatAge,
  formatSeenAgo,
  inProgressLabel,
  isFlaggedReason,
  isInProgress,
  isToday,
  itemVisit,
  itemVisits,
  JOURNAL_COLORS,
  journalItemLink,
  JournalRowRef,
  lookaheadLabel,
  visitHeading,
} from '../helpers/journalHelpers';
import { useJournalPhoneLabels } from '../hooks/useJournalPhoneLabels';
import { JournalItemLink } from './JournalItemLink';
import { FLAG_SX } from './JournalRow';

interface Props {
  selected: JournalRowRef | undefined;
  kind: JournalKind;
  now: DateTime;
  actions: JournalAction[];
  onOpenChat: (row: JournalRow, item: JournalItem) => void;
  onAddendum: (row: JournalRow, visit: JournalVisit) => void;
}

const PANEL_SX = {
  bgcolor: 'background.paper',
  border: `1px solid ${JOURNAL_COLORS.line}`,
  borderRadius: '8px',
  p: 2,
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  minWidth: 0,
};
const LINE_SX = { fontSize: '13.5px', lineHeight: 1.45 };
const META_SX = { color: JOURNAL_COLORS.text2, fontSize: '13px' };
const TODO_SX = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  padding: '6px 8px',
  border: `1px solid ${JOURNAL_COLORS.line}`,
  borderRadius: '6px',
};
const SECTION_HEADING_SX = {
  fontSize: '12px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  color: JOURNAL_COLORS.text2,
  margin: '2px 0 -4px',
};
const BUTTON_SX = {
  height: 34,
  padding: '0 14px 0 10px',
  borderRadius: '17px',
  fontSize: '13.5px',
  fontWeight: 500,
  textTransform: 'none',
  whiteSpace: 'nowrap',
  gap: '6px',
  '& svg': { width: 17, height: 17 },
  '&.Mui-disabled': { borderColor: JOURNAL_COLORS.disabledLine, color: JOURNAL_COLORS.disabledText },
};

const Panel = ({ children }: { children: ReactNode }): ReactElement => <Box sx={PANEL_SX}>{children}</Box>;

const Dot = (): ReactElement => (
  <Box component="span" sx={META_SX}>
    {' · '}
  </Box>
);

const SideButton = ({ action, primary }: { action: JournalAction; primary?: boolean }): ReactElement => {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const disabled = !!action.disabledReason;
  const main = (
    <Button
      variant={primary ? 'contained' : 'outlined'}
      size="small"
      startIcon={action.icon}
      disabled={disabled}
      sx={BUTTON_SX}
      {...(action.href && !disabled
        ? { component: 'a', href: action.href, target: '_blank', rel: 'noopener' }
        : { onClick: action.onClick })}
    >
      {action.label}
    </Button>
  );
  // A split button, like the Progress Note's Discharge: the main part does what the plain button does.
  const button =
    action.menu && !disabled ? (
      <>
        <ButtonGroup variant="outlined" size="small" sx={{ '& .MuiButtonGroup-grouped': { minWidth: 0 } }}>
          {main}
          <Button
            aria-label={`${action.label} options`}
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            sx={{ ...BUTTON_SX, padding: '0 6px' }}
          >
            <ArrowDropDownIcon fontSize="small" />
          </Button>
        </ButtonGroup>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          {action.menu.map((item) => (
            <MenuItem
              key={item.label}
              onClick={() => {
                setMenuAnchor(null);
                item.onClick();
              }}
            >
              {item.label}
            </MenuItem>
          ))}
        </Menu>
      </>
    ) : (
      main
    );
  return disabled ? (
    <Tooltip {...DEFAULT_TOOLTIP_PROPS} title={action.disabledReason}>
      <span>{button}</span>
    </Tooltip>
  ) : (
    button
  );
};

const AddendumLink = ({ onClick }: { onClick: () => void }): ReactElement => (
  <Link
    component="button"
    type="button"
    onClick={onClick}
    sx={{
      ml: 'auto',
      fontSize: '13px',
      fontWeight: 500,
      whiteSpace: 'nowrap',
      textDecoration: 'none',
      '&:hover': { textDecoration: 'underline' },
    }}
  >
    + Addendum
  </Link>
);

/** Everything a row does not show, with the icons as buttons. */
/** Account phones; each phone's consent signer loads when the patient is shown. */
const Phones = ({ patient }: { patient: JournalPatient }): ReactElement => {
  const { data, isLoading } = useJournalPhoneLabels(patient.patientId);
  return (
    <>
      <Box sx={SECTION_HEADING_SX}>Phones</Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {patient.phones.map((phone, index) => {
          const signer = data?.labels.find((l) => l.recipientResourceUri === phone.recipientResourceUri)?.signer;
          return (
            <Box
              key={`${phone.recipientResourceUri}-${index}`}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '13.5px',
                color: JOURNAL_COLORS.text2,
                userSelect: 'all',
              }}
            >
              <PhoneIcon sx={{ width: 13, height: 13 }} />
              {isLoading ? (
                <Skeleton variant="text" width={96} aria-label="Loading who signed for this phone" />
              ) : (
                signer && <span>{signer}</span>
              )}
              <Box component="b" sx={{ fontWeight: 500, color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
                {phone.number}
              </Box>
            </Box>
          );
        })}
      </Box>
    </>
  );
};

export const JournalSideColumn = ({ selected, kind, now, actions, onOpenChat, onAddendum }: Props): ReactElement => {
  if (!selected) {
    return (
      <Panel>
        <Box sx={{ color: JOURNAL_COLORS.text2, fontSize: '13.5px', textAlign: 'center', padding: '28px 8px' }}>
          Select a row
        </Box>
      </Panel>
    );
  }
  const { row, section } = selected;
  const patient = row.patient;

  const buttons = (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, borderTop: `1px solid ${JOURNAL_COLORS.divider}`, pt: 1.5 }}>
      {SIDE_BUTTON_ORDER.map((key) => actions.find((a) => a.key === key))
        .filter((a): a is JournalAction => !!a)
        .map((action) => (
          <SideButton key={action.key} action={action} />
        ))}
    </Box>
  );

  // An item with no patient (an unmatched fax, eRx notifications): the to-do and an Open button.
  if (!patient) {
    const item = row.items[0];
    if (!item) return <Panel>Select a row</Panel>;
    return (
      <Panel>
        <Typography component="h3" sx={{ fontSize: 18, fontWeight: 600, color: 'primary.dark' }}>
          {item.label}
        </Typography>
        <Box sx={{ ...LINE_SX, color: JOURNAL_COLORS.text2, fontVariantNumeric: 'tabular-nums' }}>
          {item.when} {formatAge(item.since, now)} ago
        </Box>
        <Box
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, borderTop: `1px solid ${JOURNAL_COLORS.divider}`, pt: 1.5 }}
        >
          <SideButton
            primary
            action={{ key: 'record', label: 'Open', tooltip: 'Open', icon: null, href: journalItemLink(item) }}
          />
        </Box>
      </Panel>
    );
  }

  const visitLine = (visit: JournalVisit): ReactElement => (
    <Box sx={{ ...LINE_SX, display: 'flex', alignItems: 'baseline', gap: 1 }}>
      <span>{visitHeading(visit, now)}</span>
      {visit.hasProgressNote && <AddendumLink onClick={() => onAddendum(row, visit)} />}
    </Box>
  );
  const todo = (item: JournalRow['items'][number]): ReactElement => (
    <Box
      key={item.id}
      sx={item.assignedTo ? { ...TODO_SX, border: `1px dashed ${JOURNAL_COLORS.rowLineDash}` } : TODO_SX}
    >
      <JournalItemLink item={item} now={now} onOpenChat={(item) => onOpenChat(row, item)} inPanel />
    </Box>
  );
  // Tasks on this provider's visits that someone else holds sit apart, under their own heading.
  const ownItems = row.items.filter((item) => !item.assignedTo);
  const othersItems = row.items.filter((item) => item.assignedTo);

  let meta: string | undefined;
  let body: ReactNode;
  if (section === 'np') {
    meta = 'No recent visit';
    body = ownItems.map(todo);
  } else if (section === 'cu' && row.visit) {
    const reason = row.visit.reasonForVisit;
    const flagged = isFlaggedReason(reason);
    body = (
      <>
        {visitLine(row.visit)}
        <Box sx={LINE_SX}>
          {row.lookahead || !row.waitingSince ? (
            lookaheadLabel(kind)
          ) : (
            <>
              Waiting{' '}
              <Box component="span" sx={{ color: JOURNAL_COLORS.text2, fontVariantNumeric: 'tabular-nums' }}>
                {formatAge(row.waitingSince, now)}
              </Box>
              {row.room ? ` in room ${row.room}` : ''}
            </>
          )}
          {reason && (
            <>
              <Dot />
              {flagged ? (
                <Box component="span" sx={FLAG_SX}>
                  {reason}
                </Box>
              ) : (
                reason
              )}
            </>
          )}
        </Box>
        {ownItems.map(todo)}
      </>
    );
  } else if (section === 'tdd' || section === 'pa' || (section === 'td' && isInProgress(row, kind))) {
    const visit = row.visit;
    const todayVisits = row.visits.filter((v) => isToday(v.start, now)).length;
    if (section === 'td' && todayVisits > 1) meta = `${todayVisits} visits today`;
    body = (
      <>
        {visit && visitLine(visit)}
        {visit?.reasonForVisit && <Box sx={LINE_SX}>{visit.reasonForVisit}</Box>}
        <Box sx={LINE_SX}>{section === 'td' ? inProgressLabel(kind) : 'Nothing to do'}</Box>
        {ownItems.map(todo)}
      </>
    );
  } else {
    // Grouped by visit, newest first; to-dos not from a visit (a text) sit on their own at the top.
    const visits = itemVisits({ ...row, items: ownItems });
    if (section === 'td') {
      const todayVisits = row.visits.filter((v) => isToday(v.start, now)).length;
      if (todayVisits > 1) meta = `${todayVisits} visits today`;
    } else if (row.lastSeen) {
      meta = `Seen ${formatSeenAgo(row.lastSeen, now)} ago`;
    }
    body = (
      <>
        {ownItems.filter((item) => !itemVisit(item, row)).map(todo)}
        {visits.map((visit) => (
          <Box
            key={visit.encounterId}
            sx={{
              borderLeft: `3px solid ${JOURNAL_COLORS.rowLine}`,
              padding: '2px 0 2px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <Box sx={{ fontWeight: 500, display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <span>{visitHeading(visit, now)}</span>
              {visit.hasProgressNote && <AddendumLink onClick={() => onAddendum(row, visit)} />}
            </Box>
            {visit.reasonForVisit && <Box sx={{ color: JOURNAL_COLORS.text2, mt: '-4px' }}>{visit.reasonForVisit}</Box>}
            {ownItems.filter((item) => itemVisit(item, row)?.encounterId === visit.encounterId).map(todo)}
          </Box>
        ))}
      </>
    );
  }

  return (
    <Panel>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography component="h3" sx={{ fontSize: 18, fontWeight: 600, color: 'primary.dark' }}>
          {patient.name}
        </Typography>
        {patient.birthDate && <PatientDateOfBirth dateOfBirth={patient.birthDate} />}
        {meta && <Box sx={{ ...META_SX, ml: 'auto' }}>{meta}</Box>}
      </Box>
      {body}
      {othersItems.length > 0 && (
        <>
          <Box sx={SECTION_HEADING_SX}>Assigned to others</Box>
          {othersItems.map(todo)}
        </>
      )}
      {patient.phones.length > 0 && <Phones patient={patient} />}
      {buttons}
    </Panel>
  );
};
