import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { Operation } from 'fast-json-patch';
import { Patient } from 'fhir/r4b';
import { useSuccessQuery } from 'utils';
import { addOrReplaceOperation, GetOrUploadPatientProfilePhotoZambdaResponse, removeOperation } from 'utils';
import { getSignedPatientProfilePhotoUrl } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';

export const useGetSignedPatientProfilePhotoUrlQuery = (
  z3PhotoUrl?: string,
  onSuccess?: (response: GetOrUploadPatientProfilePhotoZambdaResponse | null) => void
): UseQueryResult<GetOrUploadPatientProfilePhotoZambdaResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  const queryResult = useQuery({
    queryKey: ['Get-Signed-Patient-Profile-Photo-Url', z3PhotoUrl],

    queryFn: async (): Promise<GetOrUploadPatientProfilePhotoZambdaResponse> => {
      const data = await getSignedPatientProfilePhotoUrl(oystehrZambda!, { z3PhotoUrl: z3PhotoUrl! });
      return data;
    },

    enabled: Boolean(oystehrZambda && z3PhotoUrl),
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export type EditPatientProfilePhotoParams = {
  originalPatient: Patient;
  newPatientData: Patient;
};

export const useEditPatientProfilePhotoMutation = (): UseMutationResult<
  Patient,
  Error,
  EditPatientProfilePhotoParams
> => {
  const { oystehr } = useApiClients();
  return useMutation({
    mutationFn: ({ originalPatient, newPatientData }: EditPatientProfilePhotoParams) => {
      if (!oystehr) {
        throw new Error('Oystehr not found');
      }

      const operations: Operation[] = [];
      const shouldRemovePhoto = !newPatientData.photo || newPatientData.photo?.length === 0;
      const hadPreviousPhotos = originalPatient.photo && originalPatient.photo.length !== 0;

      if (shouldRemovePhoto) {
        operations.push(removeOperation('/photo'));
      } else {
        operations.push(
          addOrReplaceOperation(hadPreviousPhotos ? hadPreviousPhotos : undefined, '/photo', newPatientData.photo)
        );
      }

      return oystehr.fhir.patch<Patient>({
        resourceType: 'Patient',
        id: newPatientData.id ?? '',
        operations: operations,
      });
    },
    onError: (err) => {
      console.error('Error during updating patient profile photo information: ', err);
    },
  });
};
