import { useMemo } from 'react';
import { useApiClients } from '../../hooks/useAppClients';
import { getOystehrTelemedAPI } from '../data';

export const useOystehrAPIClient = (): ReturnType<typeof getOystehrTelemedAPI> | null => {
  const { oystehrZambda } = useApiClients();

  const apiClient = useMemo(() => {
    if (oystehrZambda)
      return getOystehrTelemedAPI(
        {
          syncUserZambdaID: import.meta.env.VITE_APP_SYNC_USER_ZAMBDA_ID,
          getTelemedAppointmentsZambdaID: import.meta.env.VITE_APP_GET_TELEMED_APPOINTMENTS_ZAMBDA_ID,
          initTelemedSessionZambdaID: import.meta.env.VITE_APP_INIT_TELEMED_SESSION_ZAMBDA_ID,
          getChartDataZambdaID: import.meta.env.VITE_APP_GET_CHART_DATA_ZAMBDA_ID,
          saveChartDataZambdaID: import.meta.env.VITE_APP_SAVE_CHART_DATA_ZAMBDA_ID,
          deleteChartDataZambdaID: import.meta.env.VITE_APP_DELETE_CHART_DATA_ZAMBDA_ID,
          changeTelemedAppointmentStatusZambdaID: import.meta.env.VITE_APP_CHANGE_TELEMED_APPOINTMENT_STATUS_ZAMBDA_ID,
          changeInPersonVisitStatusZambdaID: import.meta.env.VITE_APP_CHANGE_IN_PERSON_VISIT_STATUS_ZAMBDA_ID,
          assignPractitionerZambdaID: import.meta.env.VITE_APP_ASSIGN_PRACTITIONER_ZAMBDA_ID,
          unassignPractitionerZambdaID: import.meta.env.VITE_APP_UNASSIGN_PRACTITIONER_ZAMBDA_ID,
          signAppointmentZambdaID: import.meta.env.VITE_APP_SIGN_APPOINTMENT_ZAMBDA_ID,
          getPatientInstructionsZambdaID: import.meta.env.VITE_APP_GET_PATIENT_INSTRUCTIONS_ZAMBDA_ID,
          savePatientInstructionZambdaID: import.meta.env.VITE_APP_SAVE_PATIENT_INSTRUCTION_ZAMBDA_ID,
          deletePatientInstructionZambdaID: import.meta.env.VITE_APP_DELETE_PATIENT_INSTRUCTION_ZAMBDA_ID,
          createUpdateMedicationOrderZambdaID: import.meta.env.VITE_APP_CREATE_UPDATE_MEDICATION_ORDER_ZAMBDA_ID,
          getMedicationOrdersZambdaID: import.meta.env.VITE_APP_GET_MEDICATION_ORDERS_ZAMBDA_ID,
          icdSearchZambdaId: import.meta.env.VITE_APP_ICD_SEARCH_ZAMBDA_ID,
          isAppLocal: import.meta.env.VITE_APP_IS_LOCAL,
          getPatientAccountZambdaID: import.meta.env.VITE_APP_GET_PATIENT_ACCOUNT_ZAMBDA_ID,
          updatePatientAccountZambdaID: import.meta.env.VITE_APP_UPDATE_PATIENT_ACCOUNT_ZAMBDA_ID,
          removePatientCoverageZambdaID: import.meta.env.VITE_APP_REMOVE_PATIENT_COVERAGE_ZAMBDA_ID,
          sendFaxZambdaID: import.meta.env.VITE_APP_SEND_FAX_ZAMBDA_ID,
          externalLabResourceSearchID: import.meta.env.VITE_APP_GET_CREATE_LAB_ORDER_RESOURCES,
        },
        oystehrZambda
      );
    return null;
  }, [oystehrZambda]);

  return apiClient;
};
