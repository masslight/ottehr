import { Location } from 'fhir/r4b';
import { z } from 'zod';
import { TaskAlertCode } from '../data/tasks/types';
import { VisitStatusLabel } from './appointment.types';

export const GetProviderJournalInputSchema = z.object({
  /** The Provider or Clinician whose journal is shown. The server checks the role; the picker is not trusted. */
  practitionerId: z.string().uuid(),
  /** The browser's IANA timezone; "today" is computed in it. */
  timezone: z.string().min(1),
});
export type GetProviderJournalInput = z.infer<typeof GetProviderJournalInputSchema>;

export const CompleteJournalTaskInputSchema = z.object({
  taskId: z.string().uuid(),
});
export type CompleteJournalTaskInput = z.infer<typeof CompleteJournalTaskInputSchema>;

export interface CompleteJournalTaskOutput {
  taskId: string;
  status: 'completed';
}

/** Provider = visits where they are the attender; clinician = visits where they are the admitter (intake). */
export type JournalKind = 'provider' | 'clinician';

export type JournalItemKind =
  | 'unsigned-note'
  | 'external-lab'
  | 'radiology'
  | 'text-message'
  | 'patient-request'
  | 'fax'
  | 'erx'
  | 'task';

/** What the age counts from: "Review CBC, resulted 2d 5h ago". */
export type JournalItemWhen =
  | 'discharged'
  /** An unsigned note on a visit that was never discharged: counts from the visit. */
  | 'seen'
  /** The same, on a visit the provider never saw (still in intake or ready for provider). */
  | 'visit'
  | 'resulted'
  | 'read'
  | 'received'
  | 'assigned'
  | 'created'
  | 'first notified';

export interface JournalItem {
  /** Task id, or `note:<encounterId>` for an unsigned note. */
  id: string;
  kind: JournalItemKind;
  /** The action, e.g. "Review & Sign", "Review CBC", "Reply to text", or the task title. */
  label: string;
  when: JournalItemWhen;
  /** ISO time the age counts from. */
  since: string;
  taskId?: string;
  patientId?: string;
  appointmentId?: string;
  encounterId?: string;
  /** The visit is a scheduled follow-up (chart links need `?encounterId=`). */
  isFollowUpVisit?: boolean;
  /** ServiceRequest id of the lab or radiology order; other tasks: the order the task was created from. */
  orderId?: string;
  diagnosticReportId?: string;
  /** Task.code for patient requests, faxes and lab results, for the quick-action mapping. */
  code?: string;
  /** A reflex lab result (no Ottehr order): opens its report page, as on the Tasks page. */
  isReflex?: boolean;
  /** Other tasks: Task category and inputs, for the Tasks page's "Go to task" link. */
  category?: string;
  /** A completed practice form's PDF (Patient Follow-up tasks from submit-paperwork). */
  documentReferenceId?: string;
  /** The Progress Note section the task was created from, e.g. "vitals". */
  progressNoteSection?: string;
  /** Review-fax task: the folder the document was filed into. */
  folderId?: string;
  /** Fax task: the fax's Communication id, for the Tasks page's Match Inbound Fax link. */
  communicationId?: string;
  /** Manual "Patient Follow-up" tasks: the Free form note dialog offers to complete them. */
  isCallTask?: boolean;
  /** Patient Follow-up tasks: the assignee's practitioner id (only the assignee can mark it done, like Complete). */
  assigneeId?: string;
  /** Text tasks: the patient has unread texts ("Reply to text"); Support Chat requests: unread messages. */
  unread?: boolean;
  /** Unread Support Chat requests: the task title, for the Support Chat dialog. */
  title?: string;
  /** The Tasks page's alert, e.g. an abnormal lab result. */
  alert?: TaskAlertCode;
}

export interface JournalVisit {
  appointmentId: string;
  encounterId: string;
  /** ISO start. */
  start: string;
  isTelemed: boolean;
  isFollowUp: boolean;
  status: VisitStatusLabel;
  serviceCategory?: string;
  reasonForVisit?: string;
  /** The progress note exists once the visit has reached intake (the chart is open). */
  hasProgressNote: boolean;
  /** The encounter's Location, trimmed to what quick texts use: name, phone, review link. */
  location?: Location;
}

export interface JournalPhone {
  number: string;
  /** `RelatedPerson/<id>` of the account phone, the SMS recipient the chat uses. */
  recipientResourceUri: string;
  /** Consent signer of the newest visit this phone booked, e.g. "Mei Chen (Parent)". */
  signer?: string;
}

export interface JournalPatient {
  patientId: string;
  name: string;
  /** Shown next to the name, as on the tracking board. */
  birthDate?: string;
  firstName?: string;
  lastName?: string;
  phones: JournalPhone[];
  /** An unread text from an account phone (the tracking board's unread rule); opening the chat marks it read. */
  hasUnreadTexts?: boolean;
}

export interface JournalRow {
  /** Missing only for items with no patient (unmatched fax, eRx notifications) in "Not tied to a recent visit". */
  patient?: JournalPatient;
  /** This journal's visits for the patient in the window, newest first. */
  visits: JournalVisit[];
  /** Open items, newest first. */
  items: JournalItem[];
  /** Coming Up: the visit about to be seen; Today/Past: the visit of the day. */
  visit?: JournalVisit;
  /** Coming Up only. */
  room?: string;
  /** Coming Up: ISO time the visit became ready for this journal's owner. */
  waitingSince?: string;
  /** Coming Up: "In intake, next up" (provider journal lookahead). */
  lookahead?: boolean;
  /** Recent: ISO start of the newest visit on this journal the patient was seen at. */
  lastSeen?: string;
  /** A row with no visit: its newest to-do's own Location, trimmed like `JournalVisit.location` (chat quick texts). */
  location?: Location;
}

export interface GetProviderJournalResponse {
  kind: JournalKind;
  comingUp: JournalRow[];
  /** Seen today with something to do, or currently in the room. */
  today: JournalRow[];
  /** Seen today, nothing to do ("+ N more patients seen today, nothing to do"). */
  todayDone: JournalRow[];
  seenTodayCount: number;
  recent: JournalRow[];
  notTied: JournalRow[];
  /** Last 7 days (not today), nothing left to do. */
  past: JournalRow[];
}
