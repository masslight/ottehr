import { DOCUMENT_PACKET_MAX_VISITS, GetDocumentPacketPreviewOutput } from 'utils/lib/types/api/document-packet.types';
import { initialRecipients } from './recipients';
import { PacketVisitOption, SendDocumentsFormValues } from './types';

/**
 * Initial form values: the first recipient prefilled from the patient's PCP when a preview supplied one,
 * and every offered visit selected. Pure, so the form can seed itself via `useForm` default values at
 * mount — no syncing effect required.
 */
export const buildDefaultFormValues = (
  preview: GetDocumentPacketPreviewOutput | undefined,
  visits?: PacketVisitOption[]
): SendDocumentsFormValues => ({
  // Patient-level sources have no preview and do not offer PCP management. Treat them as already
  // having a PCP so their blank recipient never opts into replacing generalPractitioner.
  recipients: initialRecipients(preview?.pcp, preview ? preview.hasSavedPcp : true),
  // Start from the newest visits the packet can hold rather than letting the user find the ceiling on send.
  ...(visits
    ? { selectedAppointmentIds: visits.slice(0, DOCUMENT_PACKET_MAX_VISITS).map((visit) => visit.appointmentId) }
    : {}),
});
