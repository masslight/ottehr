import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { Patient } from 'fhir/r4b';
import { useApiClients } from '../../hooks/useAppClients';

export const useEditPatientBirthDateMutation = (): UseMutationResult<Patient, Error, { patientData: Patient }> => {
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
            path: '/birthDate',
            value: patientData.birthDate,
          },
        ],
      });
    },
    onError: (err) => {
      console.error('Error during updating patient date of birth: ', err);
    },
  });
};
