import { enqueueSnackbar } from 'notistack';
import { FC, useEffect } from 'react';
import { useGetErxConfigQuery } from 'src/features/visits/telemed/hooks/useGetErxConfig';
import { safelyCaptureException } from 'utils/lib/frontend/sentry';
import { getErxPatientSyncErrorMessage, useErxPatientVitals } from '../hooks/useErxPatientVitals';
import { useSyncERXPatient } from '../stores/appointment/appointment.queries';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { ERXStatus } from './ERX';

/**
 * Lightweight eRx readiness used ONLY to run the drug-drug / drug-allergy interaction
 * ("precheck") check for in-house medication dispensing.
 *
 * Unlike <ERX>, this does NOT enroll or connect the ordering provider as an eRx prescriber
 * and does NOT require an NPI or a complete practitioner profile. Dispensing an in-house
 * medication is not prescribing, so the provider does not need to be an eRx prescriber. The
 * interaction precheck (`oystehr.erx.checkPrecheckInteractions`) only needs the project-level
 * eRx credentials plus the patient's allergies/medications synced to the upstream eRx
 * provider — so here we only verify eRx is configured and sync the patient.
 *
 * It reports readiness through the same `ERXStatus` contract as <ERX> so the medication card
 * can gate the interaction check on `ERXStatus.READY` without any changes to its logic.
 */
export const ERXInteractionsReadiness: FC<{
  onStatusChanged: (status: ERXStatus) => void;
}> = ({ onStatusChanged }) => {
  const { patient, encounter } = useAppointmentData();
  const phoneNumber = patient?.telecom?.find((telecom) => telecom.system === 'phone')?.value;

  // Step 1: verify eRx is configured for the project — the precheck call is a no-op without it.
  const { data: erxConfig, isFetched: isErxConfigFetched } = useGetErxConfigQuery();
  const isErxConfigured = Boolean(erxConfig?.configured);

  // Step 2: patient vitals. DoseSpot patient sync requires height/weight for patients <= 18.
  const { hasVitals, isVitalsLoading, isVitalsFetched } = useErxPatientVitals();

  // Step 3: sync the patient's demographics/allergies/medications to the eRx provider so the
  // precheck has data to compare against. No practitioner enrollment/connect is involved.
  const { isFetched: isPatientSynced, isLoading: isPatientSyncing } = useSyncERXPatient({
    patient: patient!,
    encounter,
    enabled: Boolean(isErxConfigured && hasVitals && patient?.id && encounter?.id),
    onError: (error) => {
      console.log(error);
      safelyCaptureException(error);
      enqueueSnackbar(getErxPatientSyncErrorMessage(error, phoneNumber), { variant: 'error' });
      onStatusChanged(ERXStatus.ERROR);
    },
  });

  // Prompt to add missing vitals — the patient sync can't succeed for minors without them.
  useEffect(() => {
    if (isErxConfigured && isVitalsFetched && !hasVitals) {
      enqueueSnackbar(
        "Patient doesn't have height or weight vital specified. Please specify it first on the `Vitals` tab",
        { variant: 'error', preventDuplicate: true, key: 'erx-interactions-missing-vitals' }
      );
    }
  }, [isErxConfigured, isVitalsFetched, hasVitals]);

  // Report readiness through the shared ERXStatus contract.
  useEffect(() => {
    // eRx not configured for the project — the interaction check can't run. The card surfaces
    // this as "interaction check failed, please review manually".
    if (isErxConfigFetched && !isErxConfigured) {
      onStatusChanged(ERXStatus.ERROR);
      return;
    }
    // Still resolving config or vitals.
    if (!isErxConfigFetched || isVitalsLoading) {
      onStatusChanged(ERXStatus.LOADING);
      return;
    }
    // Required vitals missing — patient sync would fail, so we can't run the check.
    if (isVitalsFetched && !hasVitals) {
      onStatusChanged(ERXStatus.ERROR);
      return;
    }
    if (isPatientSyncing) {
      onStatusChanged(ERXStatus.LOADING);
      return;
    }
    if (isPatientSynced) {
      onStatusChanged(ERXStatus.READY);
    }
  }, [
    isErxConfigFetched,
    isErxConfigured,
    isVitalsLoading,
    isVitalsFetched,
    hasVitals,
    isPatientSyncing,
    isPatientSynced,
    onStatusChanged,
  ]);

  return null;
};
