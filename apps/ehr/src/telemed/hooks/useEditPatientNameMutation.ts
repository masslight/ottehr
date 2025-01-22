import { Patient } from 'fhir/r4b';
import { useMutation } from 'react-query';
import { useApiClients } from '../../hooks/useAppClients';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useEditPatientNameMutation = () => {
  const { oystehr } = useApiClients();
  return useMutation({
    mutationFn: ({ patientData }: { patientData: Patient }) => {
      if (!oystehr) {
        throw new Error('Oystehr not found');
      }
      return oystehr.fhir.patch<Patient>({
        resourceType: 'Patient',
        id: patientData.id ?? '',
        operations: [
          {
            op: 'replace',
            path: '/name',
            value: patientData.name,
          },
        ],
      });
    },
    onError: (err) => {
      console.error('Error during editing patient name: ', err);
    },
  });
};
