import { ErrorDialogConfig, UnexpectedErrorDescription } from '../components/ErrorDialog';

export const getParentAndPatientOption = (t: (key: string) => string): { value: string; label: string }[] => {
  return [
    {
      label: t('constants.parentGuardian'),
      value: 'Parent/Guardian',
    },
    {
      label: t('constants.patient'),
      value: 'Patient (Self)',
    },
  ];
};

export const getParentOption = (t: (key: string) => string): { value: string; label: string }[] => {
  return [
    {
      label: t('constants.parentGuardian'),
      value: 'Parent/Guardian',
    },
  ];
};

export enum FillingOutAsValue {
  ParentGuardian = 'Parent/Guardian',
  Patient = 'Patient (Self)',
  Other = 'Other',
}

export const NOT_PATIENT_OR_GUARDIAN_ERROR = (t: (key: string) => string): ErrorDialogConfig => ({
  title: '',
  description: t('welcome.proceedToDesk'),
  closeButtonText: t('constants.errors.noLocation.button'),
});

export const NO_LOCATION_ERROR = (t: (key: string) => string): ErrorDialogConfig => ({
  title: t('constants.errors.noLocation.title'),
  description: t('constants.errors.noLocation.description'),
  closeButtonText: t('constants.errors.noLocation.button'),
});

export const NO_PATIENT_ERROR_ID = 'no-patient';
export const NO_PATIENT_ERROR = (t: (key: string) => string): ErrorDialogConfig => ({
  title: t('constants.errors.noPatient.title'),
  description: t('constants.errors.noPatient.description'),
  closeButtonText: t('constants.errors.noPatient.button'),
  id: NO_PATIENT_ERROR_ID,
});

export const NO_SLOT_ERROR_ID = 'no-slot';
export const NO_SLOT_ERROR = (t: (key: string) => string): ErrorDialogConfig => ({
  title: t('constants.errors.noSlot.title'),
  description: t('constants.errors.noSlot.description'),
  closeButtonText: t('constants.errors.noSlot.button'),
  id: NO_SLOT_ERROR_ID,
});

export const PAST_APPT_ERROR_ID = 'past-appt-date-time';
export const PAST_APPT_ERROR = (t: (key: string) => string): ErrorDialogConfig => ({
  title: t('constants.errors.pastAppt.title'),
  description: t('constants.errors.pastAppt.description'),
  closeButtonText: t('constants.errors.pastAppt.button'),
  id: PAST_APPT_ERROR_ID,
});

export const UNEXPECTED_ERROR_CONFIG = (t: (key: string) => string): ErrorDialogConfig => ({
  title: t('general.errors.unexpected.title'),
  description: UnexpectedErrorDescription,
  closeButtonText: t('general.button.close'),
});
