import { Appointment, Encounter, Location } from 'fhir/r4b';
import { EvolveUser } from 'src/hooks/useEvolveUser';
import {
  allLicensesForPractitioner,
  checkEncounterHasPractitioner,
  EncounterVisitType,
  getEncounterVisitType,
  isAppointmentLocked,
  PractitionerLicense,
  StateType,
} from 'utils';

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
  isAppointmentLocked: boolean;
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

  // Check if appointment is locked via meta tag
  const isAppointmentLockedByMetaTag = appointment ? isAppointmentLocked(appointment) : false;
  const visitType = getEncounterVisitType(encounter);
  const isFollowup = visitType === 'follow-up';

  const isAppointmentReadOnly = (() => {
    return isAppointmentLockedByMetaTag && !isFollowup;
  })();

  return {
    allLicenses,
    licensedPractitionerStates,
    state,
    isPractitionerLicensedInState,
    isEncounterAssignedToCurrentPractitioner,
    isAppointmentReadOnly,
    isAppointmentLocked: isAppointmentLockedByMetaTag,
    visitType,
  };
};
