import { ZambdaClient } from '@zapehr/sdk';
import { Dispatch } from 'react';
import zapehrApi from '../api/zapehrApi';
import { updateAppointmentID, updatePatient } from '../store/IntakeActions';
import { IntakeAction, IntakeState, PatientInfo, VisitType } from '../store/types';

export async function createAppointmentAndUpdateState(
  zambdaClient: ZambdaClient,
  patientInfo: PatientInfo | undefined,
  state: IntakeState,
  stateDispatchFn: Dispatch<IntakeAction>,
): Promise<string> {
  const res = await zapehrApi.createAppointment(
    zambdaClient,
    {
      slot: state.visitType === VisitType.WalkIn ? undefined : state.appointmentSlot,
      patient: patientInfo,
      location: state?.selectedLocation?.id,
      visitType: state.visitType,
      unconfirmedDateOfBirth: state.unconfirmedDateOfBirth ?? undefined,
    },
    stateDispatchFn,
  );

  updateAppointmentID(res.appointment, stateDispatchFn);

  // Update the patient id for newly created patients
  const fhirPatient = res?.patient;
  if (state.patientInfo && fhirPatient?.id) {
    updatePatient({ ...state.patientInfo, id: fhirPatient?.id }, stateDispatchFn);
  }

  return res.appointment;
}
