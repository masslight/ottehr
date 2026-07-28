import { GetFaxPacketPreviewInput, GetFaxPacketPreviewOutput, SendFaxPacketInput, SendFaxPacketOutput } from 'utils';

export interface FaxApiClient {
  getFaxPacketPreview: (input: GetFaxPacketPreviewInput) => Promise<GetFaxPacketPreviewOutput>;
  sendFaxPacket: (input: SendFaxPacketInput) => Promise<SendFaxPacketOutput>;
}

export const fetchFaxPacketPreview = async (
  apiClient: FaxApiClient,
  appointmentId: string
): Promise<GetFaxPacketPreviewOutput> => apiClient.getFaxPacketPreview({ appointmentId });

export const sendFaxPacket = async (apiClient: FaxApiClient, input: SendFaxPacketInput): Promise<SendFaxPacketOutput> =>
  apiClient.sendFaxPacket(input);
