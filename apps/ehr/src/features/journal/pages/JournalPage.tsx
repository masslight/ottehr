import { Box, Link, MenuItem, Paper, Select, Skeleton, TextField, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assignPractitioner } from 'src/api/api';
import { visitQuickTextsContext } from 'src/features/chat/chat.queries';
import ChatModal from 'src/features/chat/ChatModal';
import { getChiefComplaintUrl } from 'src/features/visits/in-person/routing/helpers';
import { getOfficePhoneNumber, PLACEHOLDER_PHONE_NUMBER } from 'src/helpers/getOfficePhoneNumber';
import { handleChangeInPersonVisitStatus } from 'src/helpers/inPersonVisitStatusUtils';
import { adjustTopForBannerHeight, NAVBAR_HEIGHT_CSS_VAR } from 'src/helpers/misc.helper';
import { useApiClients } from 'src/hooks/useAppClients';
import { useSupportPhonesMap } from 'src/hooks/useLocationSupportPhones';
import PageContainer from 'src/layout/PageContainer';
import { AppointmentMessaging } from 'utils/lib/types/api/messaging.types';
import { JournalItem, JournalRow as JournalRowData } from 'utils/lib/types/api/provider-journal.types';
import { PRACTITIONER_CODINGS } from 'utils/lib/types/data/appointments/appointments.types';
import { SupportChatModal } from '../../support-chat/components/SupportChatModal';
import { TaskNotesDialog } from '../../tasks/components/TaskNotesDialog';
import { NOTE_CREATED_PREVIEW_LENGTH } from '../../tasks/pages/Tasks';
import { JournalDot } from '../components/JournalDot';
import { JournalNoteDialog, JournalNoteTarget } from '../components/JournalNoteDialog';
import { JournalRow } from '../components/JournalRow';
import { JournalSideColumn } from '../components/JournalSideColumn';
import { buildJournalActions, JournalActionHandlers } from '../helpers/journalActions';
import {
  getChartVisit,
  inProgressStatus,
  isInProgress,
  JOURNAL_COLORS,
  JournalRowRef,
  journalTitle,
  opensTaskNotes,
  patientsSearchUrl,
  plural,
  reviewAndSignUrl,
  rowMatchesSearch,
  rowRef,
  rowRole,
  summarizeItems,
} from '../helpers/journalHelpers';
import { useJournalOwners } from '../hooks/useJournalOwners';
import { useProviderJournal } from '../hooks/useProviderJournal';

/* Two columns: min 420px main, 280-360px sticky side, 16px gap, one column under 716px (the procedures layout). */
const MAIN_MIN_WIDTH = 420;
const SIDE_MIN_WIDTH = 280;
const SIDE_MAX_WIDTH = 360;
const COLUMN_GAP_PX = 16;
const TWO_COLUMN_QUERY = `@container (min-width: ${MAIN_MIN_WIDTH + COLUMN_GAP_PX + SIDE_MIN_WIDTH}px)`;

const META_SX = { color: JOURNAL_COLORS.text2, fontSize: '13px' };
/** Recent rows drawn before "+ N more": drawing hundreds at once freezes the page for seconds. */
const RECENT_FIRST_ROWS = 50;
const MORE_SX = {
  fontSize: '13px',
  color: JOURNAL_COLORS.text2,
  padding: '2px 4px 4px',
  cursor: 'pointer',
  textAlign: 'left',
  '&:hover': { color: 'primary.main' },
};

const Section = ({
  title,
  meta,
  sumbar,
  children,
}: {
  /** Past has no title: its collapsed bar is the heading. */
  title?: string;
  meta?: string;
  sumbar?: string;
  children?: ReactNode;
}): ReactElement => (
  <Box
    sx={{
      padding: '10px 16px 6px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      '& + &': { borderTop: `1px solid ${JOURNAL_COLORS.divider}` },
    }}
  >
    {title && (
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <Typography component="h2" sx={{ fontSize: 16, fontWeight: 600 }}>
          {title}
        </Typography>
        {meta && <Box sx={META_SX}>{meta}</Box>}
      </Box>
    )}
    {sumbar && (
      <Box sx={{ bgcolor: JOURNAL_COLORS.bar, borderRadius: '6px', padding: '6px 12px', fontSize: '13.5px' }}>
        {sumbar}
      </Box>
    )}
    {children}
  </Box>
);

/** Placeholder sections in the journal's shape while it loads, like the side column's phone labels. */
const LoadingSections = (): ReactElement => (
  <Box role="progressbar" aria-label="Loading the journal" aria-busy="true">
    {[3, 4].map((rows, section) => (
      <Section key={section}>
        <Skeleton variant="text" width={120} sx={{ fontSize: 16 }} />
        {Array.from({ length: rows }, (_, row) => (
          <Skeleton key={row} variant="rounded" height={46} />
        ))}
      </Section>
    ))}
  </Box>
);

export const JournalPage = (): ReactElement => {
  const { oystehrZambda } = useApiClients();
  const { owners, myPractitionerId, iAmProvider, isLoading: ownersLoading } = useJournalOwners();
  const [pickedOwnerId, setPickedOwnerId] = useState<string>();
  // While the staff list loads, start on the user's own journal rather than wait for it. A user without a journal
  // gets a failed request, hidden behind the spinner, then the first owner's once the list arrives.
  const ownerId =
    pickedOwnerId ??
    (ownersLoading || owners.some((o) => o.practitionerId === myPractitionerId)
      ? myPractitionerId
      : owners[0]?.practitionerId);
  const owner = owners.find((o) => o.practitionerId === ownerId);
  const isMe = ownerId === myPractitionerId;

  const { data, isLoading, refetch } = useProviderJournal(ownerId);

  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>();
  const [showMore, setShowMore] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [noteTarget, setNoteTarget] = useState<JournalNoteTarget>();
  const [chatRef, setChatRef] = useState<JournalRowRef>();
  const chatRow = chatRef?.row;
  /** Chats marked read since the last load, like the tracking board row's local unread state (reset on new data). */
  const [readChatPatientIds, setReadChatPatientIds] = useState<string[]>([]);
  useEffect(() => setReadChatPatientIds([]), [data]);
  /** An unread Support Chat request: opens the Tasks page's Support Chat dialog. */
  const [supportChatItem, setSupportChatItem] = useState<JournalItem>();
  const [notesTaskId, setNotesTaskId] = useState<string>();
  const openChat = (row: JournalRowData, item: JournalItem): void => {
    if (opensTaskNotes(item)) setNotesTaskId(item.taskId);
    else if (item.kind === 'text-message') setChatRow(row);
    else setSupportChatItem(item);
  };

  // Ages count to when the journal loaded, so rows stay memoized; every reload (tab focus, actions) moves it on.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => DateTime.now(), [data]);
  const q = query.trim().toLowerCase();

  const refs = useMemo(() => {
    if (!data) return undefined;
    const comingUp = [...data.comingUp.filter((r) => !r.lookahead), ...data.comingUp.filter((r) => r.lookahead)];
    return {
      cu: comingUp.map((r) => rowRef('cu', r)),
      td: data.today
        .filter((r) => r.items.length || r.waitingSince || isInProgress(r, data.kind))
        .map((r) => rowRef('td', r)),
      tdd: data.todayDone.map((r) => rowRef('tdd', r)),
      rc: data.recent.filter((r) => r.items.length).map((r) => rowRef('rc', r)),
      np: data.notTied.map((r) => rowRef('np', r)),
      pa: data.past.map((r) => rowRef('pa', r)),
    };
  }, [data]);

  const allRefs = useMemo(() => (refs ? Object.values(refs).flat() : []), [refs]);
  const selected = allRefs.find((r) => r.key === selectedKey);
  /** The chat keeps the row's section: it fills quick texts from the visit Progress Note opens. */
  const setChatRow = (row?: JournalRowData): void => setChatRef(row && allRefs.find((r) => r.row === row));

  const changeOwner = (id: string): void => {
    setPickedOwnerId(id);
    setSelectedKey(undefined);
    setShowMore(false);
    setShowAllRecent(false);
    setShowPast(false);
  };

  const kind = data?.kind ?? 'provider';

  const handlers: JournalActionHandlers = {
    myPractitionerId,
    onSelect: (key) => setSelectedKey(key),
    onStart: async (row) => {
      if (!row.visit) return;
      try {
        await handleChangeInPersonVisitStatus(
          { encounterId: row.visit.encounterId, updatedStatus: inProgressStatus(rowRole(row, kind)) },
          oystehrZambda
        );
        window.open(getChiefComplaintUrl(row.visit.appointmentId), '_blank');
        setSelectedKey(undefined);
        await refetch();
      } catch (error) {
        console.error(error);
        enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
      }
    },
    onText: (row) => setChatRow(row),
    onNote: (row) => {
      if (!row.patient) return;
      setNoteTarget({
        mode: 'free-form',
        patient: row.patient,
        completableTasks: row.items.filter(
          (i) => (i.isCallTask || i.kind === 'text-message') && !!myPractitionerId && i.assigneeId === myPractitionerId
        ),
      });
    },
    onAddendum: (row, visit) => {
      if (!row.patient) return;
      setNoteTarget({ mode: 'addendum', patient: row.patient, visit });
    },
    // A covering provider takes the visit over, as "Assign Current Chart to Me" does in the command palette.
    onMakeMeProvider:
      !isMe && myPractitionerId && oystehrZambda && iAmProvider
        ? async (visit) => {
            try {
              await assignPractitioner(oystehrZambda, {
                encounterId: visit.encounterId,
                practitionerId: myPractitionerId,
                userRole: PRACTITIONER_CODINGS.Attender,
              });
              enqueueSnackbar('You are now the provider for this chart.', { variant: 'success' });
              window.open(reviewAndSignUrl(visit), '_blank');
              setSelectedKey(undefined);
              await refetch();
            } catch (error) {
              console.error(error);
              enqueueSnackbar('An error occurred trying to assign you to this chart. Please try again.', {
                variant: 'error',
              });
            }
          }
        : undefined,
  };

  // Rows are memoized, so they get handlers that never change and call this render's.
  const latest = useRef({ handlers, openChat });
  latest.current = { handlers, openChat };
  const canMakeMeProvider = Boolean(handlers.onMakeMeProvider);
  const rowHandlers = useMemo<JournalActionHandlers>(
    () => ({
      onSelect: (key) => latest.current.handlers.onSelect(key),
      onStart: (row) => latest.current.handlers.onStart(row),
      onText: (row) => latest.current.handlers.onText(row),
      onNote: (row) => latest.current.handlers.onNote(row),
      onAddendum: (row, visit) => latest.current.handlers.onAddendum(row, visit),
      onMakeMeProvider: canMakeMeProvider ? (visit) => latest.current.handlers.onMakeMeProvider?.(visit) : undefined,
    }),
    [canMakeMeProvider]
  );
  const rowOpenChat = useCallback((row: JournalRowData, item: JournalItem) => latest.current.openChat(row, item), []);
  const toggleSelected = useCallback(
    (key: string) => setSelectedKey((current) => (current === key ? undefined : key)),
    []
  );

  const renderRow = (ref: JournalRowRef): ReactElement => (
    <JournalRow
      key={ref.key}
      rowRef={ref}
      kind={kind}
      now={now}
      selected={ref.key === selectedKey}
      handlers={rowHandlers}
      onSelect={toggleSelected}
      onOpenChat={rowOpenChat}
    />
  );

  const { phonesByLocationName } = useSupportPhonesMap();
  const chatVisit = chatRef && getChartVisit(chatRef);
  // The paperwork link, AI interview link and booking time: today's visit, or the patient's upcoming booking, never a visit that's over.
  const linkVisit =
    chatRef?.section === 'cu' || chatRef?.section === 'td' || chatRef?.section === 'tdd'
      ? chatRow?.visit
      : chatRow?.visits.filter((v) => v.status === 'pending' && DateTime.fromISO(v.start) >= now.startOf('day')).at(-1);
  // A row with no visit: its newest to-do's own Location.
  const chatLocation = chatVisit?.location ?? chatRow?.location;
  const chatMessaging: AppointmentMessaging | undefined = useMemo(() => {
    if (!chatRow?.patient) return undefined;
    const { patient } = chatRow;
    return {
      id: chatVisit?.appointmentId ?? patient.patientId,
      encounterId: chatVisit?.encounterId ?? patient.patientId,
      patient: { id: patient.patientId, firstName: patient.firstName, lastName: patient.lastName, dateOfBirth: '' },
      smsModel: {
        recipients: patient.phones.map((p) => ({ recipientResourceUri: p.recipientResourceUri, smsNumber: p.number })),
        hasUnreadMessages: Boolean(patient.hasUnreadTexts) && !readChatPatientIds.includes(patient.patientId),
      },
    };
  }, [chatRow, chatVisit, readChatPatientIds]);

  let content: ReactNode;
  if (ownersLoading || (isLoading && ownerId)) {
    content = <LoadingSections />;
  } else if (!data || !refs) {
    content = (
      <Typography color="error" sx={{ p: 2 }}>
        {ownerId ? 'Could not load the journal' : 'No providers or clinicians found'}
      </Typography>
    );
  } else {
    const match = (list: JournalRowRef[]): JournalRowRef[] =>
      q ? list.filter((r) => rowMatchesSearch(r.row, q)) : list;
    const cu = match(refs.cu);
    const td = match(refs.td);
    const tdd = match(refs.tdd);
    const rc = match(refs.rc);
    const np = q ? refs.np.filter((r) => r.row.patient && rowMatchesSearch(r.row, q)) : refs.np;
    const pa = match(refs.pa);
    const readyCount = cu.filter((r) => !r.row.lookahead).length;
    const nothingMatches = q && !cu.length && !td.length && !tdd.length && !rc.length && !np.length && !pa.length;

    content = (
      <>
        {nothingMatches && (
          <Box sx={{ color: JOURNAL_COLORS.text2, fontSize: '13.5px', textAlign: 'center', padding: '28px 8px' }}>
            No match on this journal ·{' '}
            <Link href={patientsSearchUrl(query)} target="_blank" rel="noopener" sx={{ fontWeight: 500 }}>
              Search all patients
            </Link>
          </Box>
        )}
        {cu.length > 0 && (
          <Section title="Coming Up" meta={`${plural(readyCount, 'patient')} ready`}>
            {cu.map(renderRow)}
          </Section>
        )}
        {(!q || td.length > 0 || tdd.length > 0) && (
          <Section
            title="Today"
            sumbar={summarizeItems(
              td.flatMap((r) => r.row.items),
              `${plural(q ? td.length + tdd.length : data.seenTodayCount, 'patient')} seen`
            )}
          >
            {td.map(renderRow)}
            {q ? (
              tdd.map(renderRow)
            ) : refs.tdd.length > 0 ? (
              <>
                {showMore && refs.tdd.map(renderRow)}
                <Box
                  component="button"
                  type="button"
                  onClick={() => setShowMore(!showMore)}
                  sx={{ ...MORE_SX, border: 0, background: 'none', font: 'inherit' }}
                >
                  {showMore
                    ? 'Show fewer'
                    : `+ ${refs.tdd.length} ${refs.td.length ? 'more ' : ''}${
                        refs.tdd.length === 1 ? 'patient' : 'patients'
                      } seen today, nothing to do`}
                </Box>
              </>
            ) : null}
          </Section>
        )}
        {(!q || rc.length > 0) && (
          <Section title="Recent" sumbar={summarizeItems(rc.flatMap((r) => r.row.items))}>
            {(showAllRecent || q ? rc : rc.slice(0, RECENT_FIRST_ROWS)).map(renderRow)}
            {!q && rc.length > RECENT_FIRST_ROWS && (
              <Box
                component="button"
                type="button"
                onClick={() => setShowAllRecent(!showAllRecent)}
                sx={{ ...MORE_SX, border: 0, background: 'none', font: 'inherit' }}
              >
                {showAllRecent
                  ? 'Show fewer'
                  : `+ ${rc.length - RECENT_FIRST_ROWS} more ${
                      rc.length - RECENT_FIRST_ROWS === 1 ? 'patient' : 'patients'
                    } with to-dos`}
              </Box>
            )}
          </Section>
        )}
        {np.length > 0 && <Section title="Not tied to a recent visit">{np.map(renderRow)}</Section>}
        {refs.pa.length > 0 && (!q || pa.length > 0) && (
          <Section>
            {!q && (
              <Box
                role="button"
                tabIndex={0}
                onClick={() => setShowPast(!showPast)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowPast(!showPast);
                  }
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  border: `1px solid ${JOURNAL_COLORS.line}`,
                  borderRadius: '6px',
                  padding: '7px 12px',
                  margin: '4px 0 6px',
                  cursor: 'pointer',
                }}
              >
                <Box component="b" sx={{ fontWeight: 600, fontSize: 15 }}>
                  {showPast ? '⌄' : '›'} Past
                </Box>
                <Box sx={{ ...META_SX, flex: 1 }}>
                  {plural(refs.pa.length, 'patient')} in the last 7 days, nothing left to do
                </Box>
                <Box
                  sx={{
                    color: 'primary.main',
                    fontWeight: 500,
                    fontSize: '13.5px',
                    whiteSpace: 'nowrap',
                    padding: '2px 4px',
                  }}
                >
                  {showPast ? 'Hide' : 'Show'}
                </Box>
              </Box>
            )}
            {(q ? pa : showPast ? refs.pa : []).map(renderRow)}
          </Section>
        )}
      </>
    );
  }

  return (
    <PageContainer tabTitle="Journal">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Box sx={{ display: 'flex', gap: '18px', flexWrap: 'wrap', color: JOURNAL_COLORS.text2, fontSize: '12.5px' }}>
          {(
            [
              ['blue', 'Ready to see'],
              ['purple', 'With provider'],
              ['orange', 'Needs action'],
              ['green', 'No action required'],
            ] as const
          ).map(([color, label]) => (
            <Box key={label} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <JournalDot color={color} />
              {label}
            </Box>
          ))}
        </Box>
        <Box sx={{ containerType: 'inline-size' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              gap: `${COLUMN_GAP_PX}px`,
              alignItems: 'start',
              [TWO_COLUMN_QUERY]: {
                gridTemplateColumns: `minmax(${MAIN_MIN_WIDTH}px, 1fr) minmax(${SIDE_MIN_WIDTH}px, ${SIDE_MAX_WIDTH}px)`,
              },
            }}
          >
            <Paper
              elevation={0}
              sx={{ borderRadius: '8px', boxShadow: `0 0 0 1px ${JOURNAL_COLORS.line}`, overflow: 'hidden' }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${JOURNAL_COLORS.line}`,
                  flexWrap: 'wrap',
                }}
              >
                <Typography
                  component="h1"
                  sx={{ fontSize: 22, fontWeight: 600, color: 'primary.dark', flex: 1, minWidth: 160 }}
                >
                  {owner ? journalTitle(owner.name, isMe) : 'Journal'}
                </Typography>
                <Select
                  size="small"
                  value={ownerId ?? ''}
                  onChange={(e) => changeOwner(e.target.value)}
                  inputProps={{ 'aria-label': 'Journal for' }}
                  sx={{ height: 36, fontSize: 14 }}
                  displayEmpty
                >
                  {owners.map((o) => (
                    <MenuItem key={o.practitionerId} value={o.practitionerId}>
                      Journal for: {o.name}
                      {o.practitionerId === myPractitionerId ? ' (me)' : ''}
                    </MenuItem>
                  ))}
                </Select>
                <TextField
                  size="small"
                  type="search"
                  placeholder="Search patients"
                  inputProps={{ 'aria-label': 'Search patients' }}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  sx={{ width: 220, '& .MuiInputBase-root': { height: 36, fontSize: 14 } }}
                />
              </Box>
              {owner && !isMe && (
                <Box
                  sx={{
                    margin: '10px 16px 0',
                    bgcolor: JOURNAL_COLORS.warnTint,
                    border: `1px solid ${JOURNAL_COLORS.warnLine}`,
                    borderRadius: '6px',
                    padding: '7px 12px',
                    fontSize: '13.5px',
                  }}
                >
                  You&apos;re viewing {owner.name}&apos;s journal. What you can do follows your own permissions.
                </Box>
              )}
              {content}
            </Paper>
            <Box
              component="aside"
              aria-label="Details"
              sx={{
                [TWO_COLUMN_QUERY]: {
                  position: 'sticky',
                  top: `calc(${adjustTopForBannerHeight(COLUMN_GAP_PX)}px + var(${NAVBAR_HEIGHT_CSS_VAR}, 0px))`,
                  maxHeight: `calc(100vh - ${adjustTopForBannerHeight(
                    COLUMN_GAP_PX * 2
                  )}px - var(${NAVBAR_HEIGHT_CSS_VAR}, 0px))`,
                  overflowY: 'auto',
                },
              }}
            >
              {data && (
                <JournalSideColumn
                  selected={selected}
                  kind={kind}
                  now={now}
                  actions={selected ? buildJournalActions(selected, kind, handlers) : []}
                  onOpenChat={openChat}
                  onAddendum={handlers.onAddendum}
                />
              )}
            </Box>
          </Box>
        </Box>
        {noteTarget && (
          <JournalNoteDialog
            target={noteTarget}
            onClose={() => setNoteTarget(undefined)}
            onSaved={() => void refetch()}
          />
        )}
        {notesTaskId && (
          // The Tasks page's Task notes dialog, with its "Note created" message.
          <TaskNotesDialog
            taskId={notesTaskId}
            onClose={() => setNotesTaskId(undefined)}
            onNoteCreated={(text) => {
              setNotesTaskId(undefined);
              const preview =
                text.length > NOTE_CREATED_PREVIEW_LENGTH ? `${text.slice(0, NOTE_CREATED_PREVIEW_LENGTH)}…` : text;
              enqueueSnackbar(`Note created: ${preview}`, { variant: 'success' });
            }}
          />
        )}
        {supportChatItem?.taskId && (
          <SupportChatModal
            task={{
              id: supportChatItem.taskId,
              category: supportChatItem.category ?? '',
              createdDate: supportChatItem.since,
              title: supportChatItem.title ?? '',
              subtitle: '',
              status: 'ready',
              completable: true,
              chat: { hasUnread: true },
            }}
            onClose={() => {
              setSupportChatItem(undefined);
              void refetch();
            }}
          />
        )}
        {chatRow?.patient && chatMessaging && (
          <ChatModal
            appointment={chatMessaging}
            onClose={() => setChatRow(undefined)}
            onMarkAllRead={() => {
              // ChatModal marks read on close without waiting, so reload once the read is saved.
              setReadChatPatientIds((ids) => [...ids, chatRow.patient!.patientId]);
              void refetch();
            }}
            quickTextsContext={{
              ...visitQuickTextsContext({
                patientFirstName: chatRow.patient.firstName,
                patientLastName: chatRow.patient.lastName,
                visitId: linkVisit?.appointmentId,
                start: linkVisit?.start,
                location: chatLocation,
                // The visit's or to-do's own Location only, never the tracking board's last-selected one.
                officePhone: chatLocation ? getOfficePhoneNumber(chatLocation) : PLACEHOLDER_PHONE_NUMBER,
                phonesByLocationName,
              }),
              noVisit: !chatVisit,
              noLinkVisit: !linkVisit,
              noLocation: !chatVisit && !chatLocation,
              linkVisitLocation:
                linkVisit?.location && linkVisit.location.id !== chatLocation?.id
                  ? visitQuickTextsContext({
                      location: linkVisit.location,
                      officePhone: getOfficePhoneNumber(linkVisit.location),
                      phonesByLocationName,
                    })
                  : undefined,
            }}
          />
        )}
      </Box>
    </PageContainer>
  );
};
