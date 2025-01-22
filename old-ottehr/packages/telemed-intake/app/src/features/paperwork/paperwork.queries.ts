import { DateTime } from 'luxon';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { ZapEHRAPIClient } from 'ottehr-components';
import { FileURLs, PromiseReturnType, isNullOrUndefined } from 'ottehr-utils';
import { useZapEHRAPIClient } from '../../utils';
import { useAppointmentStore } from '../appointments';

export const useGetPaperwork = (
  onSuccess?: (data: PromiseReturnType<ReturnType<ZapEHRAPIClient['getPaperwork']>>) => void,
  params?: {
    enabled?: boolean;
    staleTime?: number;
    onError?: (error: any) => void;
  },
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const apiClient = useZapEHRAPIClient();
  const appointmentID = useAppointmentStore((state) => state.appointmentID);

  return useQuery(
    ['paperwork', appointmentID],
    () => {
      if (apiClient && appointmentID) {
        return apiClient.getPaperwork({
          appointmentID: appointmentID,
        });
      }

      throw new Error('api client not defined or appointmentID is not provided');
    },
    {
      enabled:
        (params?.enabled && Boolean(apiClient && appointmentID)) ||
        (isNullOrUndefined(params?.enabled) && Boolean(apiClient && appointmentID)),
      staleTime: params?.staleTime,
      onSuccess,
      onError:
        params?.onError ||
        ((err) => {
          console.error('Error during fetching get paperwork: ', err);
        }),
    },
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useUpdatePaperworkMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      apiClient,
      appointmentID,
      paperwork,
      files,
    }: {
      apiClient: ZapEHRAPIClient;
      appointmentID: string;
      paperwork?: any;
      files?: FileURLs;
    }) => {
      await apiClient.updatePaperwork({
        appointmentID,
        paperwork: paperwork ? paperwork : [],
        files: files || ({} as FileURLs),
        timezone: DateTime.now().zoneName,
      });
      return queryClient.invalidateQueries(['paperwork']);
    },
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useCreatePaperworkMutation = () =>
  useMutation({
    mutationFn: ({
      apiClient,
      appointmentID,
      paperwork,
      files,
    }: {
      apiClient: ZapEHRAPIClient;
      appointmentID: string;
      paperwork: any;
      files?: FileURLs;
    }) => {
      return apiClient.createPaperwork({
        appointmentID,
        paperwork,
        files: files || ({} as FileURLs),
        timezone: DateTime.now().zoneName,
      });
    },
  });
