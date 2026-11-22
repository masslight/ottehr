import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import EditIcon from '@mui/icons-material/Edit';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PersonIcon from '@mui/icons-material/Person';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import PostAddIcon from '@mui/icons-material/PostAdd';
import VideocamIcon from '@mui/icons-material/Videocam';
import { ReactNode } from 'react';
import { getChiefComplaintUrl } from 'src/features/visits/in-person/routing/helpers';
import { sidebarMenuIcons } from 'src/features/visits/shared/components/sidebarMenuIcons';
import { JournalKind, JournalRow, JournalVisit } from 'utils/lib/types/api/provider-journal.types';
import {
  followUpUrl,
  getChartVisit,
  getRowVisit,
  itemVisits,
  JournalRowRef,
  patientRecordUrl,
  reviewAndSignUrl,
  visitDetailsUrl,
} from './journalHelpers';

export type JournalActionKey =
  | 'record'
  | 'progress'
  | 'details'
  | 'start'
  | 'join'
  | 'text'
  | 'note'
  | 'addendum'
  | 'followup'
  | 'rx';

export interface JournalAction {
  key: JournalActionKey;
  /** Side column button text. */
  label: string;
  /** Row icon hover text. */
  tooltip: string;
  icon: ReactNode;
  /** Opens in a new tab. */
  href?: string;
  onClick?: () => void;
  /** Set when the control is disabled; shown as its hover text. */
  disabledReason?: string;
  /** Side column only: the button's ▾ menu. */
  menu?: { label: string; onClick: () => void }[];
}

export interface JournalActionHandlers {
  onStart: (row: JournalRow) => void;
  onText: (row: JournalRow) => void;
  onNote: (row: JournalRow) => void;
  onAddendum: (row: JournalRow, visit: JournalVisit) => void;
  onSelect: (key: string) => void;
  /** Set only when the signed-in user is a provider looking at a colleague's journal. */
  onMakeMeProvider?: (visit: JournalVisit) => void;
}

/** Row icon order: the first three, a separator, then the rest. */
export const ROW_ICON_ORDER: JournalActionKey[] = [
  'record',
  'progress',
  'details',
  'start',
  'join',
  'text',
  'note',
  'addendum',
  'followup',
  'rx',
];
export const ROW_ICON_SEPARATOR_AFTER: JournalActionKey = 'details';
export const SIDE_BUTTON_ORDER: JournalActionKey[] = [
  'start',
  'join',
  'record',
  'progress',
  'details',
  'text',
  'note',
  'followup',
  'rx',
];

export const RX_DISABLED_REASON = 'Available once the new eRx is released';
export const NO_PROGRESS_NOTE_REASON = 'No Progress Note yet';

export const buildJournalActions = (
  ref: JournalRowRef,
  kind: JournalKind,
  handlers: JournalActionHandlers
): JournalAction[] => {
  const { row, section } = ref;
  const patient = row.patient;
  if (!patient) return [];
  const visit = getRowVisit(ref);
  const chartVisit = getChartVisit(ref);
  const actions: JournalAction[] = [
    {
      key: 'record',
      label: 'Patient Record',
      tooltip: 'Patient Record',
      icon: <PersonIcon />,
      href: patientRecordUrl(patient.patientId),
    },
  ];
  if (chartVisit) {
    actions.push(
      {
        key: 'progress',
        label: 'Progress Note',
        tooltip: 'Progress Note',
        icon: <DescriptionIcon />,
        href: reviewAndSignUrl(chartVisit),
        menu:
          kind === 'provider' && handlers.onMakeMeProvider
            ? [{ label: 'Make me provider and open note', onClick: () => handlers.onMakeMeProvider?.(chartVisit) }]
            : undefined,
      },
      {
        key: 'details',
        label: 'Visit Details',
        tooltip: 'Visit Details',
        icon: <InfoOutlinedIcon />,
        href: visitDetailsUrl(chartVisit),
      }
    );
  }
  if (section === 'cu' && row.visit && !row.lookahead) {
    // The tracking board's actions: on a virtual visit ready for the provider, Start Provider only opens the chart.
    if (row.visit.isTelemed && kind === 'provider') {
      actions.push({
        key: 'join',
        label: 'Start Provider',
        tooltip: 'Start Provider (opens the chart in a new tab)',
        icon: <VideocamIcon />,
        href: getChiefComplaintUrl(row.visit.appointmentId),
      });
    } else {
      const label = kind === 'provider' ? 'Start Provider' : 'Start Intake';
      actions.push({
        key: 'start',
        label,
        tooltip: `${label} (opens the chart in a new tab)`,
        icon: <PlayCircleIcon />,
        onClick: () => handlers.onStart(row),
      });
    }
  }
  actions.push(
    {
      key: 'text',
      label: 'Text',
      tooltip: 'Text the patient',
      icon: <ChatBubbleOutlineIcon />,
      onClick: () => handlers.onText(row),
      disabledReason: patient.phones.length ? undefined : 'No phone number on file',
    },
    {
      key: 'note',
      label: 'Free Form',
      tooltip: 'Add a Free Form',
      icon: <EditIcon />,
      onClick: () => handlers.onNote(row),
    }
  );
  if (visit) {
    // One visit with a note opens the dialog; several visits open the side column to pick one.
    // With no to-do on this journal's visits, it's the row's own visit (the one Progress Note opens).
    const noteVisits = itemVisits(row).filter((v) => v.hasProgressNote);
    const target =
      noteVisits.length === 0 && visit.hasProgressNote ? visit : noteVisits.length === 1 ? noteVisits[0] : undefined;
    // Before intake nothing is charted yet, so there is nothing to add an addendum to.
    const anyNote = noteVisits.some((v) => v.hasProgressNote) || visit.hasProgressNote || !!row.visit?.hasProgressNote;
    actions.push({
      key: 'addendum',
      label: 'Addendum',
      tooltip: 'Add an addendum to the Progress Note',
      icon: <PostAddIcon />,
      disabledReason: anyNote ? undefined : NO_PROGRESS_NOTE_REASON,
      onClick: target ? () => handlers.onAddendum(row, target) : () => handlers.onSelect(ref.key),
    });
  }
  actions.push({
    key: 'followup',
    label: 'Follow-up',
    tooltip: 'Add a follow-up',
    icon: <EventRepeatIcon />,
    href: followUpUrl(patient.patientId, chartVisit?.encounterId),
  });
  if (visit) {
    actions.push({
      key: 'rx',
      label: 'Prescription',
      tooltip: 'Add a prescription (available once the new eRx is released)',
      icon: sidebarMenuIcons.Prescription,
      disabledReason: RX_DISABLED_REASON,
    });
  }
  return actions;
};
