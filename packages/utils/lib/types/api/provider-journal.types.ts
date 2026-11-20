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
  /** The action, e.g. "Review & sign", "Review CBC", "Reply to text", or the task title. */
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
  /** ServiceRequest id of the lab or radiology order. */
  orderId?: string;
  diagnosticReportId?: string;
  /** Task.code for patient requests and faxes, for the quick-action mapping. */
  code?: string;
  /** Review-fax task: the folder the document was filed into. */
  folderId?: string;
  /** Manual "Patient Follow-up" tasks: the Free form note dialog offers to complete them. */
  isCallTask?: boolean;
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
  firstName?: string;
  lastName?: string;
  phones: JournalPhone[];
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
