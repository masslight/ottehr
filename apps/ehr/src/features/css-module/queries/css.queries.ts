import { Operation } from 'fast-json-patch';
import { Patient } from 'fhir/r4b';
import { useMutation, useQuery } from 'react-query';
import { addOrReplaceOperation, GetOrUploadPatientProfilePhotoZambdaResponse, removeOperation } from 'utils';
import { getSignedPatientProfilePhotoUrl } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetSignedPatientProfilePhotoUrlQuery = (
  z3PhotoUrl?: string,
  onSuccess?: (response: GetOrUploadPatientProfilePhotoZambdaResponse) => void
) => {
  const { oystehrZambda } = useApiClients();
  return useQuery(
    ['Get-Signed-Patient-Profile-Photo-Url', z3PhotoUrl],
    async () => {
      return await getSignedPatientProfilePhotoUrl(oystehrZambda!, { z3PhotoUrl: z3PhotoUrl! });
    },
    {
      onSuccess,
      enabled: Boolean(oystehrZambda && z3PhotoUrl),
    }
  );
};

export type EditPatientProfilePhotoParams = {
  originalPatient: Patient;
  newPatientData: Patient;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useEditPatientProfilePhotoMutation = () => {
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
