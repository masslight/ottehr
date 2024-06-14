import { Appointment, Encounter, Location } from 'fhir/r4';
import { OttehrUser } from '../../hooks/useOttehrUser';
import {
  allLicensesForPractitioner,
  ApptStatus,
  checkIsEncounterForPractitioner,
  mapStatusToTelemed,
  PractitionerLicense,
  PractitionerQualificationCode,
} from 'ehr-utils';

export type GetAppointmentAccessibilityDataProps = {
  location?: Location;
  encounter: Encounter;
  appointment?: Appointment;
  user?: OttehrUser;
};

export type GetAppointmentAccessibilityDataResult = {
  allLicenses?: PractitionerLicense[];
  availableStates?: string[];
  state?: string;
  isStateAvailable: boolean;
  status?: ApptStatus;
  isEncounterForPractitioner: boolean;
  isStatusEditable: boolean;
  isAppointmentReadOnly: boolean;
  isAppointmentAvailable: boolean;
};

export const getAppointmentAccessibilityData = ({
  location,
  encounter,
  appointment,
  user,
}: GetAppointmentAccessibilityDataProps): GetAppointmentAccessibilityDataResult => {
  const allLicenses = user?.profileResource && allLicensesForPractitioner(user.profileResource);
  const availableStates = allLicenses?.map((item) => item.state);
  const state = location?.address?.state;
  const isStateAvailable =
    !!state && !!availableStates && availableStates.includes(state as PractitionerQualificationCode);
  const status = mapStatusToTelemed(encounter.status, appointment?.status);
  const isEncounterForPractitioner =
    !!user?.profileResource && checkIsEncounterForPractitioner(encounter, user.profileResource);
  const isStatusEditable = !!status && ![ApptStatus.complete, ApptStatus.ready].includes(status);

  const isAppointmentAvailable = isStateAvailable && (status === ApptStatus.ready || isEncounterForPractitioner);
  let isAppointmentReadOnly =
    !state || !isStateAvailable || !status || !isStatusEditable || !isEncounterForPractitioner;

  if (appointment?.serviceType?.some((serviceTypeTemp) => serviceTypeTemp.text === 'in-person')) {
    isAppointmentReadOnly = false;
  }

  return {
    allLicenses,
    availableStates,
    state,
    isStateAvailable,
    status,
    isEncounterForPractitioner,
    isStatusEditable,
    isAppointmentReadOnly,
    isAppointmentAvailable,
  };
};
