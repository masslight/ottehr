import { useMemo } from 'react';
import { useApiClients } from '../../hooks/useAppClients';
import { getOystehrTelemedAPI } from '../data';

export const useOystehrAPIClient = (): ReturnType<typeof getOystehrTelemedAPI> | null => {
  const { oystehrZambda } = useApiClients();

  const apiClient = useMemo(() => {
    if (oystehrZambda)
      return getOystehrTelemedAPI(
        {
          syncUserZambdaID: 'sync-user',
          getTelemedAppointmentsZambdaID: 'get-telemed-appointments',
          initTelemedSessionZambdaID: 'init-telemed-session',
          getChartDataZambdaID: 'get-chart-data',
          saveChartDataZambdaID: 'save-chart-data',
          deleteChartDataZambdaID: 'delete-chart-data',
          changeTelemedAppointmentStatusZambdaID: 'change-telemed-appointment-status',
          changeInPersonVisitStatusZambdaID: 'change-in-person-visit-status',
          assignPractitionerZambdaID: 'assign-practitioner',
          unassignPractitionerZambdaID: 'unassign-practitioner',
          signAppointmentZambdaID: 'sign-appointment',
          getPatientInstructionsZambdaID: 'get-patient-instructions',
          savePatientInstructionZambdaID: 'save-patient-instruction',
          deletePatientInstructionZambdaID: 'delete-patient-instruction',
          createUpdateMedicationOrderZambdaID: 'create-update-medication-order',
          getMedicationOrdersZambdaID: 'get-medication-orders',
          icdSearchZambdaId: 'icd-search',
          isAppLocal: import.meta.env.VITE_APP_IS_LOCAL,
          getPatientAccountZambdaID: 'get-patient-account',
          updatePatientAccountZambdaID: 'update-patient-account',
          removePatientCoverageZambdaID: 'remove-patient-coverage',
          sendFaxZambdaID: 'send-fax',
          externalLabResourceSearchID: 'get-create-lab-order-resources',
        },
        oystehrZambda
      );
    return null;
  }, [oystehrZambda]);

  return apiClient;
};
