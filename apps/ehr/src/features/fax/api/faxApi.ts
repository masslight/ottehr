import {
  GetFaxPacketPreviewInput,
  GetFaxPacketPreviewOutput,
  GetFaxPacketStatusInput,
  GetFaxPacketStatusOutput,
  SendFaxPacketInput,
  SendFaxPacketOutput,
} from 'utils/lib/types/api/fax.types';

/** Only the methods the fax slice needs from the app's zambda API client, so the slice stays decoupled
 * from the client's (legacy, telemed-flavoured) concrete type. */
export interface FaxApiClient {
  getFaxPacketPreview: (input: GetFaxPacketPreviewInput) => Promise<GetFaxPacketPreviewOutput>;
  sendFaxPacket: (input: SendFaxPacketInput) => Promise<SendFaxPacketOutput>;
  getFaxPacketStatus: (input: GetFaxPacketStatusInput) => Promise<GetFaxPacketStatusOutput>;
}

export const fetchFaxPacketPreview = async (
  apiClient: FaxApiClient,
  appointmentId: string
): Promise<GetFaxPacketPreviewOutput> => apiClient.getFaxPacketPreview({ appointmentId });

/**
 * The number outbound faxes are sent from. It is the one part of the preview that does not depend on a
 * visit, so it is asked for without one — the patient-level dialogs have no visit to name.
 * `null` rather than `undefined` because a query function may not resolve to `undefined`.
 */
export const fetchFaxSenderFaxNumber = async (apiClient: FaxApiClient): Promise<string | null> =>
  (await apiClient.getFaxPacketPreview({})).senderFaxNumber ?? null;

export const sendFaxPacket = async (apiClient: FaxApiClient, input: SendFaxPacketInput): Promise<SendFaxPacketOutput> =>
  apiClient.sendFaxPacket(input);

export const fetchFaxPacketStatus = async (
  apiClient: FaxApiClient,
  taskId: string
): Promise<GetFaxPacketStatusOutput> => apiClient.getFaxPacketStatus({ taskId });
