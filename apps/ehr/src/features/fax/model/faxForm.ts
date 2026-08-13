import { FAX_MAX_VISITS, GetFaxPacketPreviewOutput } from 'utils/lib/types/api/fax.types';
import { initialRecipients } from './faxRecipients';
import { FaxFormValues, FaxVisitOption } from './types';

/**
 * Initial form values: the first recipient prefilled from the patient's PCP when a preview supplied one,
 * and every offered visit selected. Pure, so the form can seed itself via `useForm` default values at
 * mount — no syncing effect required.
 */
export const buildDefaultFormValues = (
  preview: GetFaxPacketPreviewOutput | undefined,
  visits?: FaxVisitOption[]
): FaxFormValues => ({
  recipients: initialRecipients(preview?.pcp, preview?.hasSavedPcp ?? false),
  // Start from the newest visits the packet can hold rather than letting the user find the ceiling on send.
  ...(visits ? { selectedAppointmentIds: visits.slice(0, FAX_MAX_VISITS).map((visit) => visit.appointmentId) } : {}),
});
