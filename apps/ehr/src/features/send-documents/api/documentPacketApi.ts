import {
  GetDocumentPacketPreviewInput,
  GetDocumentPacketPreviewOutput,
  GetDocumentPacketStatusInput,
  GetDocumentPacketStatusOutput,
  SendDocumentPacketInput,
  SendDocumentPacketOutput,
} from 'utils/lib/types/api/document-packet.types';
import { MedicalRecordDateRange } from 'utils/lib/types/data/get-patient-medical-record.types';

/** Only the methods the fax slice needs from the app's zambda API client, so the slice stays decoupled
 * from the client's (legacy, telemed-flavoured) concrete type. */
export interface DocumentPacketApiClient {
  getDocumentPacketPreview: (input: GetDocumentPacketPreviewInput) => Promise<GetDocumentPacketPreviewOutput>;
  sendDocumentPacket: (input: SendDocumentPacketInput) => Promise<SendDocumentPacketOutput>;
  getDocumentPacketStatus: (input: GetDocumentPacketStatusInput) => Promise<GetDocumentPacketStatusOutput>;
}

export const fetchDocumentPacketPreview = async (
  apiClient: DocumentPacketApiClient,
  appointmentId: string
): Promise<GetDocumentPacketPreviewOutput> => apiClient.getDocumentPacketPreview({ appointmentId });

/**
 * The number outbound faxes are sent from. It is the one part of the preview that does not depend on a
 * visit, so it is asked for without one — the patient-level dialogs have no visit to name.
 * `null` rather than `undefined` because a query function may not resolve to `undefined`.
 */
export const fetchFaxSenderFaxNumber = async (apiClient: DocumentPacketApiClient): Promise<string | null> =>
  (await apiClient.getDocumentPacketPreview({})).senderFaxNumber ?? null;

export const fetchMedicalRecordDocumentCount = async (
  apiClient: DocumentPacketApiClient,
  patientId: string,
  dateRange: MedicalRecordDateRange
): Promise<number | undefined> =>
  (await apiClient.getDocumentPacketPreview({ medicalRecord: { patientId, dateRange } })).documentCount;

export const sendDocumentPacket = async (
  apiClient: DocumentPacketApiClient,
  input: SendDocumentPacketInput
): Promise<SendDocumentPacketOutput> => apiClient.sendDocumentPacket(input);

export const fetchDocumentPacketStatus = async (
  apiClient: DocumentPacketApiClient,
  taskId: string
): Promise<GetDocumentPacketStatusOutput> => apiClient.getDocumentPacketStatus({ taskId });
