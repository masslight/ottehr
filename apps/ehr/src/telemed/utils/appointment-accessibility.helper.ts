import { Appointment, Encounter, Location } from 'fhir/r4b';
import {
  allLicensesForPractitioner,
  checkEncounterHasPractitioner,
  mapStatusToTelemed,
  PractitionerLicense,
  StateType,
  TelemedAppointmentStatusEnum,
} from 'utils';
import { FeatureFlags } from '../../features/css-module/context/featureFlags';
import { EvolveUser } from '../../hooks/useEvolveUser';

export type GetAppointmentAccessibilityDataProps = {
  locationVirtual?: Location;
  encounter: Encounter;
  appointment?: Appointment;
  user?: EvolveUser;
  featureFlags: Partial<FeatureFlags>;
};

export type GetAppointmentAccessibilityDataResult = {
  allLicenses?: PractitionerLicense[];
  licensedPractitionerStates?: string[];
  state?: StateType;
  isPractitionerLicensedInState: boolean;
  status?: TelemedAppointmentStatusEnum;
  isEncounterAssignedToCurrentPractitioner: boolean;
  isStatusEditable: boolean;
  isAppointmentReadOnly: boolean;
  isCurrentUserHasAccessToAppointment: boolean;
};

export const getAppointmentAccessibilityData = ({
  locationVirtual,
  encounter,
  appointment,
  user,
  featureFlags = {},
}: GetAppointmentAccessibilityDataProps): GetAppointmentAccessibilityDataResult => {
  const allLicenses = user?.profileResource && allLicensesForPractitioner(user.profileResource);
  const licensedPractitionerStates = allLicenses?.map((item) => item.state);
  const state = locationVirtual?.address?.state as StateType;
  const isPractitionerLicensedInState =
    !!state && !!licensedPractitionerStates && licensedPractitionerStates.includes(state as StateType);

  const status = mapStatusToTelemed(encounter.status, appointment?.status);
  const isEncounterAssignedToCurrentPractitioner =
    !!user?.profileResource && checkEncounterHasPractitioner(encounter, user.profileResource);
  const isStatusEditable =
    !!status && ![TelemedAppointmentStatusEnum.complete, TelemedAppointmentStatusEnum.ready].includes(status);

  const isCurrentUserHasAccessToAppointment =
    isPractitionerLicensedInState &&
    (status === TelemedAppointmentStatusEnum.ready || isEncounterAssignedToCurrentPractitioner);

  const isAppointmentReadOnly = (() => {
    if (featureFlags.css) {
      // TODO actualize this logic
      return false;
    }

    return (
      !state ||
      !isPractitionerLicensedInState ||
      !status ||
      !isStatusEditable ||
      !isEncounterAssignedToCurrentPractitioner
    );
  })();

  return {
    allLicenses,
    licensedPractitionerStates,
    state,
    isPractitionerLicensedInState,
    status,
    isEncounterAssignedToCurrentPractitioner,
    isStatusEditable,
    isAppointmentReadOnly,
    isCurrentUserHasAccessToAppointment,
  };
};
