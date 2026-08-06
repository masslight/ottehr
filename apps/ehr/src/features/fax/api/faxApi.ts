import {
  GetFaxPacketPreviewInput,
  GetFaxPacketPreviewOutput,
  GetFaxPacketStatusInput,
  GetFaxPacketStatusOutput,
  SendFaxPacketInput,
  SendFaxPacketOutput,
} from 'utils';

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

export const sendFaxPacket = async (apiClient: FaxApiClient, input: SendFaxPacketInput): Promise<SendFaxPacketOutput> =>
  apiClient.sendFaxPacket(input);

export const fetchFaxPacketStatus = async (
  apiClient: FaxApiClient,
  taskId: string
): Promise<GetFaxPacketStatusOutput> => apiClient.getFaxPacketStatus({ taskId });
