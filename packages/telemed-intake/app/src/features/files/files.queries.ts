import { useMutation } from 'react-query';
import { ZapEHRAPIClient } from 'ottehr-components';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useCreateZ3ObjectMutation = () =>
  useMutation({
    mutationFn: ({
      apiClient,
      fileType,
      fileFormat,
      file,
      appointmentID,
    }: {
      apiClient: ZapEHRAPIClient | null;
      fileType: string;
      fileFormat: string;
      file: File;
      appointmentID?: string;
    }) => {
      if (!apiClient) {
        throw new Error('apiClient is not defined');
      }

      if (appointmentID) {
        return apiClient.createZ3Object(appointmentID, fileType, fileFormat, file);
      }

      throw new Error('appointmentID is not provided');
    },
  });
