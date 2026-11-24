import { Appointment, Encounter, Location } from 'fhir/r4b';
import { EvolveUser } from 'src/hooks/useEvolveUser';
import { EncounterVisitType, getEncounterVisitType } from 'utils/lib/fhir/encounter';
import { allLicensesForPractitioner } from 'utils/lib/fhir/helpers';
import { checkEncounterHasPractitioner } from 'utils/lib/fhir/patient';
import { isVisitChartLocked } from 'utils/lib/fhir/visit-lock';
import { PractitionerLicense } from 'utils/lib/types/api/practitioner.types';
import { StateType } from 'utils/lib/types/common';

export type GetAppointmentAccessibilityDataProps = {
  locationVirtual?: Location;
  encounter: Encounter;
  appointment?: Appointment;
  user?: EvolveUser;
};

export type GetAppointmentAccessibilityDataResult = {
  allLicenses?: PractitionerLicense[];
  licensedPractitionerStates?: string[];
  state?: StateType;
  isPractitionerLicensedInState: boolean;
  isEncounterAssignedToCurrentPractitioner: boolean;
  isAppointmentReadOnly: boolean;
  visitType: EncounterVisitType;
};

export const getAppointmentAccessibilityData = ({
  locationVirtual,
  encounter,
  appointment,
  user,
}: GetAppointmentAccessibilityDataProps): GetAppointmentAccessibilityDataResult => {
  const allLicenses = user?.profileResource && allLicensesForPractitioner(user.profileResource);
  const licensedPractitionerStates = allLicenses?.map((item) => item.state);
  const state = locationVirtual?.address?.state as StateType;

  const isPractitionerLicensedInState =
    !!state && !!licensedPractitionerStates && licensedPractitionerStates.includes(state as StateType);

  const isEncounterAssignedToCurrentPractitioner =
    !!user?.profileResource && !!encounter && checkEncounterHasPractitioner(encounter, user.profileResource);

  return {
    allLicenses,
    licensedPractitionerStates,
    state,
    isPractitionerLicensedInState,
    isEncounterAssignedToCurrentPractitioner,
    isAppointmentReadOnly: isVisitChartLocked(encounter, appointment),
    visitType: getEncounterVisitType(encounter),
  };
};
