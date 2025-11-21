import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { OystehrAPIClient } from 'ui-components';
import { PromiseReturnType } from 'utils';

export const useCreateZ3ObjectMutation = (): UseMutationResult<
  PromiseReturnType<ReturnType<OystehrAPIClient['createZ3Object']>>,
  Error,
  {
    apiClient: OystehrAPIClient | null;
    fileType: string;
    fileFormat: string;
    file: File;
    appointmentID?: string;
  }
> =>
  useMutation({
    mutationFn: ({
      apiClient,
      fileType,
      fileFormat,
      file,
      appointmentID,
    }: {
      apiClient: OystehrAPIClient | null;
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
