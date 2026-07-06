import { useMemo } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { getOystehrTelemedAPI } from '../api/oystehrApi';

export const useOystehrAPIClient = (): ReturnType<typeof getOystehrTelemedAPI> | null => {
  const { oystehrZambda } = useApiClients();

  const apiClient = useMemo(() => {
    if (oystehrZambda)
      return getOystehrTelemedAPI(
        {
          syncUserZambdaID: 'sync-user',
          initTelemedSessionZambdaID: 'init-telemed-session',
          getChartDataZambdaID: 'get-chart-data',
          saveChartDataZambdaID: 'save-chart-data',
          deleteChartDataZambdaID: 'delete-chart-data',
          changeInPersonVisitStatusZambdaID: 'change-in-person-visit-status',
          assignPractitionerZambdaID: 'assign-practitioner',
          unassignPractitionerZambdaID: 'unassign-practitioner',
          signAppointmentZambdaID: 'sign-appointment',
          unlockAppointmentZambdaID: 'unlock-appointment',
          getPatientInstructionsZambdaID: 'get-patient-instructions',
          savePatientInstructionZambdaID: 'save-patient-instruction',
          deletePatientInstructionZambdaID: 'delete-patient-instruction',
          createUpdateMedicationOrderZambdaID: 'create-update-medication-order',
          getMedicationOrdersZambdaID: 'get-medication-orders',
          aiSuggestionNotesZambdaID: 'ai-suggestion-notes',
          recommendBillingSuggestionsZambdaID: 'recommend-billing-suggestions',
          recommendBillingCodesZambdaID: 'recommend-billing-codes',
          isAppLocal: import.meta.env.VITE_APP_IS_LOCAL,
          getPatientAccountZambdaID: 'get-patient-account',
          updatePatientAccountZambdaID: 'update-patient-account',
          removePatientCoverageZambdaID: 'remove-patient-coverage',
          mergePatientsZambdaID: 'merge-patients',
          externalLabResourceSearchID: 'get-create-lab-order-resources',
          getUnsolicitedResultsResourcesID: 'get-unsolicited-results-resources',
          updateLabOrderResourcesID: 'update-lab-order-resources',
          searchPlacesID: 'search-places',
          inhouseLabResourceSearchID: 'get-create-in-house-lab-order-resources',
          makeMedicationHistoryPdfID: 'make-medication-history-pdf',
          generatePatientEducationZambdaID: 'generate-patient-education',
          savePatientEducationPdfZambdaID: 'save-patient-education-pdf',
          listApprovedPatientEducationZambdaID: 'list-approved-patient-education',
          saveApprovedPatientEducationZambdaID: 'save-approved-patient-education',
          deleteApprovedPatientEducationZambdaID: 'delete-approved-patient-education',
          updateApprovedPatientEducationCodesZambdaID: 'update-approved-patient-education-codes',
        },
        oystehrZambda
      );
    return null;
  }, [oystehrZambda]);

  return apiClient;
};
