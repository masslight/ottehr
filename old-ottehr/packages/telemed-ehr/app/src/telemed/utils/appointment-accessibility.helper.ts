import { Appointment, Encounter, Location } from 'fhir/r4';
import { OttehrUser } from '../../hooks/useOttehrUser';
import {
  allLicensesForPractitioner,
  ApptStatus,
  checkIsEncounterForPractitioner,
  getStatusFromExtension,
  mapStatusToTelemed,
  PractitionerLicense,
  PractitionerQualificationCode,
  VisitStatus,
} from 'ehr-utils';

export type GetAppointmentAccessibilityDataProps = {
  location?: Location;
  encounter: Encounter;
  appointment?: Appointment;
  user?: OttehrUser;
  appointmentType?: string;
};

export type GetAppointmentAccessibilityDataResult = {
  allLicenses?: PractitionerLicense[];
  availableStates?: string[];
  state?: string;
  isStateAvailable: boolean;
  status?: ApptStatus | VisitStatus | undefined;
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
  appointmentType,
}: GetAppointmentAccessibilityDataProps): GetAppointmentAccessibilityDataResult => {
  const allLicenses = user?.profileResource && allLicensesForPractitioner(user.profileResource);
  const availableStates = allLicenses?.map((item) => item.state);
  const state = location?.address?.state;
  const isStateAvailable =
    !!state && !!availableStates && availableStates.includes(state as PractitionerQualificationCode);
  const status =
    appointmentType === 'telemedicine'
      ? mapStatusToTelemed(encounter.status, appointment?.status)
      : appointment
        ? getStatusFromExtension(appointment as Appointment)
        : undefined;

  const isEncounterForPractitioner =
    !!user?.profileResource && checkIsEncounterForPractitioner(encounter, user.profileResource);

  const isStatusEditable =
    (!!status &&
      appointmentType === 'telemedicine' &&
      ![ApptStatus.complete, ApptStatus.ready].includes(status as ApptStatus)) ||
    (appointmentType === 'in-person' && status !== 'cancelled' && status !== 'fulfilled');

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
