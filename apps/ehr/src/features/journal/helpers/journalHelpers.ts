import { DateTime } from 'luxon';
import { FLAGGED_REASONS_FOR_VISIT } from 'src/constants';
import {
  getDrExternalLabEditUrl,
  getExternalLabOrderEditUrl,
  getInPersonVisitDetailsUrl,
  getRadiologyOrderEditUrl,
  getVisitDocumentsUrl,
  withEncounterIdParam,
} from 'src/features/visits/in-person/routing/helpers';
import { VisitStatusWithoutUnknown } from 'utils/lib/types/api/appointment.types';
import { JournalItem, JournalKind, JournalRow, JournalVisit } from 'utils/lib/types/api/provider-journal.types';
import { LAB_ORDER_TASK } from 'utils/lib/types/data/labs/labs.constants';

/** Colors from the Provider Journal panel mockup (v15). */
export const JOURNAL_COLORS = {
  line: '#DFE5E9',
  rowLine: '#B4C0CA',
  rowLineDash: '#7F8E9B',
  divider: 'rgba(0,0,0,.08)',
  bar: '#EEF0F2',
  text2: 'rgba(0,0,0,.6)',
  primaryTint: 'rgba(33,105,245,.06)',
  blueDot: '#2F7BEA',
  orangeDot: '#F5A623',
  greenDot: '#2E9E5B',
  purpleDot: '#8E44AD',
  red: '#D32F2F',
  warnTint: '#FFF6DE',
  warnLine: '#F5B82E',
  selected: '#E2F0FF',
  hover: '#FAFBFC',
  disabledIcon: 'rgba(0,0,0,.26)',
  disabledText: 'rgba(0,0,0,.38)',
  disabledLine: 'rgba(0,0,0,.12)',
};

export type JournalSectionKey = 'cu' | 'td' | 'tdd' | 'rc' | 'np' | 'pa';

export interface JournalRowRef {
  section: JournalSectionKey;
  row: JournalRow;
  /** Selection key, unique across sections. */
  key: string;
}

export const rowRef = (section: JournalSectionKey, row: JournalRow): JournalRowRef => ({
  section,
  row,
  key: `${section}:${row.patient?.patientId ?? row.items[0]?.id ?? row.visit?.encounterId ?? ''}`,
});

export const TASKS_URL = '/tasks';

export const inProgressStatus = (kind: JournalKind): VisitStatusWithoutUnknown =>
  kind === 'provider' ? 'provider' : 'intake';
export const inProgressLabel = (kind: JournalKind): string => (kind === 'provider' ? 'With provider' : 'In intake');
export const isInProgress = (row: JournalRow, kind: JournalKind): boolean =>
  row.visit?.status === inProgressStatus(kind);

/** "2d 5h", "1h 8m", "5m" — the mockup's rel(). */
export const formatAge = (iso: string, now: DateTime = DateTime.now()): string => {
  const m = Math.max(0, Math.round(now.diff(DateTime.fromISO(iso), 'minutes').minutes));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  if (h) return mm ? `${h}h ${mm}m` : `${h}h`;
  return `${mm}m`;
};

/** "Seen 4d ago" meta: whole days once a day has passed. */
export const formatSeenAgo = (iso: string, now: DateTime = DateTime.now()): string => {
  const days = Math.floor(now.diff(DateTime.fromISO(iso), 'days').days);
  return days >= 1 ? `${days}d` : formatAge(iso, now);
};

export const isToday = (iso: string, now: DateTime = DateTime.now()): boolean =>
  DateTime.fromISO(iso).hasSame(now, 'day');

/** "Today 2:30 PM" or "Nov 3 10:20 AM", in the browser's timezone. */
export const formatVisitLabel = (iso: string, now: DateTime = DateTime.now()): string => {
  const dt = DateTime.fromISO(iso);
  return dt.hasSame(now, 'day') ? `Today ${dt.toFormat('h:mm a')}` : dt.toFormat('MMM d h:mm a');
};

export const formatVisitDay = (iso: string): string => DateTime.fromISO(iso).toFormat('MMM d');

/** "<visit label> · In Person|Virtual · <serviceCategory>", the tracking board's visit-type words. */
export const visitHeading = (visit: JournalVisit, now?: DateTime): string =>
  [formatVisitLabel(visit.start, now), visit.isTelemed ? 'Virtual' : 'In Person', visit.serviceCategory]
    .filter(Boolean)
    .join(' · ');

export const isFlaggedReason = (reason: string | undefined): boolean =>
  !!reason && FLAGGED_REASONS_FOR_VISIT.includes(reason);

export const itemVisit = (item: JournalItem, row: JournalRow): JournalVisit | undefined =>
  item.encounterId ? row.visits.find((v) => v.encounterId === item.encounterId) : undefined;

/** The visit of the oldest open item that has one (the mockup's oldestVisit). */
export const oldestItemVisit = (row: JournalRow): JournalVisit | undefined =>
  [...row.items]
    .filter((item) => itemVisit(item, row))
    .sort((a, b) => a.since.localeCompare(b.since))
    .map((item) => itemVisit(item, row))[0];

/** Coming Up / today-done / Past rows use the row's visit; otherwise the oldest open item's visit. */
export const getRowVisit = (ref: JournalRowRef): JournalVisit | undefined => {
  const { section, row } = ref;
  if (section === 'cu' || section === 'tdd' || section === 'pa') return row.visit;
  return oldestItemVisit(row) ?? row.visit ?? row.visits[0];
};

/** Distinct visits among the row's open items, newest first. */
export const itemVisits = (row: JournalRow): JournalVisit[] => {
  const seen = new Set<string>();
  const visits: JournalVisit[] = [];
  row.items.forEach((item) => {
    const visit = itemVisit(item, row);
    if (visit && !seen.has(visit.encounterId)) {
      seen.add(visit.encounterId);
      visits.push(visit);
    }
  });
  return visits.sort((a, b) => b.start.localeCompare(a.start));
};

const chartUrl = (appointmentId: string, path: string): string => `/in-person/${appointmentId}/${path}`;

export const reviewAndSignUrl = (visit: Pick<JournalVisit, 'appointmentId' | 'encounterId' | 'isFollowUp'>): string =>
  withEncounterIdParam(
    chartUrl(visit.appointmentId, 'review-and-sign'),
    visit.isFollowUp ? visit.encounterId : undefined
  );

export const visitDetailsUrl = (visit: JournalVisit): string => getInPersonVisitDetailsUrl(visit.appointmentId);

export const patientRecordUrl = (patientId: string): string => `/patient/${patientId}`;

export const followUpUrl = (patientId: string, encounterId?: string): string =>
  `/patient/${patientId}/followup/add${encounterId ? `?encounter=${encodeURIComponent(encounterId)}` : ''}`;

/** Where an item's link goes; text-message items open the chat instead. */
export const journalItemLink = (item: JournalItem): string => {
  const { appointmentId, patientId } = item;
  // Chart links need ?encounterId= when the visit is a scheduled follow-up.
  const chart = (url: string): string => withEncounterIdParam(url, item.isFollowUpVisit ? item.encounterId : undefined);
  const patientUrl = patientId ? patientRecordUrl(patientId) : undefined;
  switch (item.kind) {
    case 'unsigned-note':
      return appointmentId ? chart(chartUrl(appointmentId, 'review-and-sign')) : TASKS_URL;
    case 'external-lab':
      // Same pages as the Tasks page (useTasks fhirTaskToTask).
      if (item.code === LAB_ORDER_TASK.code.matchUnsolicitedResult && item.diagnosticReportId) {
        return `/unsolicited-results/${item.diagnosticReportId}/match`;
      }
      if (item.isReflex && appointmentId && item.diagnosticReportId) {
        return chart(getDrExternalLabEditUrl(appointmentId, item.diagnosticReportId));
      }
      if (item.orderId && appointmentId) return chart(getExternalLabOrderEditUrl(appointmentId, item.orderId));
      if (item.diagnosticReportId) return `/unsolicited-results/${item.diagnosticReportId}/review`;
      return TASKS_URL;
    case 'radiology':
      return item.orderId && appointmentId ? chart(getRadiologyOrderEditUrl(appointmentId, item.orderId)) : TASKS_URL;
    case 'patient-request':
      if (appointmentId) {
        if (item.code === 'prescription-refill') return chart(chartUrl(appointmentId, 'erx'));
        if (item.code === 'school-work-note') return chart(chartUrl(appointmentId, 'plan'));
        if (item.code === 'follow-up') return chart(chartUrl(appointmentId, 'review-and-sign'));
      }
      return patientUrl ?? TASKS_URL;
    case 'fax':
      if (appointmentId) return chart(getVisitDocumentsUrl(appointmentId));
      if (patientId) {
        return `/patient/${patientId}/docs${item.folderId ? `?folderId=${encodeURIComponent(item.folderId)}` : ''}`;
      }
      return TASKS_URL;
    case 'task':
      if (appointmentId) return chart(chartUrl(appointmentId, 'review-and-sign'));
      return patientUrl ?? TASKS_URL;
    case 'erx':
    case 'text-message':
      return TASKS_URL;
  }
};

/** Search: every typed word starts a word of the patient's name (case-insensitive), e.g. "gus pen". */
export const matchesSearch = (name: string | undefined, query: string): boolean => {
  const typed = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!typed.length) return true;
  if (!name) return false;
  const words = name.toLowerCase().split(/\s+/);
  return typed.every((t) => words.some((word) => word.startsWith(t)));
};

export const rowMatchesSearch = (row: JournalRow, query: string): boolean => matchesSearch(row.patient?.name, query);

/** The Patients page prefilled from the search text. */
export const patientsSearchUrl = (query: string): string => {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const params = new URLSearchParams();
  if (words.length > 1) params.set('givenNames', words.slice(0, -1).join(' '));
  params.set('lastName', words[words.length - 1] ?? '');
  return `/patients?${params.toString()}`;
};

const SUMMARY_CATEGORIES: { matches: (item: JournalItem) => boolean; one: string; many: string }[] = [
  { matches: (i) => i.kind === 'unsigned-note', one: 'unsigned note', many: 'unsigned notes' },
  {
    matches: (i) => i.kind === 'external-lab' || i.kind === 'radiology',
    one: 'result to review',
    many: 'results to review',
  },
  { matches: (i) => i.kind === 'task' && !!i.isCallTask, one: 'follow-up call', many: 'follow-up calls' },
  { matches: (i) => i.kind === 'text-message', one: 'unread text', many: 'unread texts' },
  { matches: (i) => i.kind === 'patient-request', one: 'patient request', many: 'patient requests' },
  { matches: (i) => i.kind === 'fax', one: 'fax', many: 'faxes' },
  { matches: (i) => i.kind === 'erx', one: 'eRx notification', many: 'eRx notifications' },
  { matches: (i) => i.kind === 'task' && !i.isCallTask, one: 'task', many: 'tasks' },
];

/** "3 actions to take: 2 unsigned notes, 1 result to review" or "Nothing waiting", with an optional lead. */
export const summarizeItems = (items: JournalItem[], lead?: string): string => {
  const parts = SUMMARY_CATEGORIES.map(({ matches, one, many }) => {
    const n = items.filter(matches).length;
    return n ? `${n} ${n === 1 ? one : many}` : '';
  }).filter(Boolean);
  const body = items.length
    ? `${items.length} action${items.length === 1 ? '' : 's'} to take: ${parts.join(', ')}`
    : 'Nothing waiting';
  return lead ? `${lead} · ${body}` : body;
};

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

export const journalTitle = (ownerName: string, isMe: boolean): string =>
  isMe ? 'My Journal' : `${ownerName}'s Journal`;
