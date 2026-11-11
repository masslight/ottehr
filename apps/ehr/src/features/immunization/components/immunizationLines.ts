import { cleanupProperties } from 'src/helpers/misc.helper';
import { isPhoneNumberValid } from 'utils/lib/helpers/helpers';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import {
  CreateUpdateImmunizationOrderRequest,
  ImmunizationEmergencyContact,
  InputImmunizationOrderAdministrationDetails,
  InputImmunizationOrderDetails,
} from 'utils/lib/types/data/immunization/types';

/** What the order form holds for one immunization, in the shape the create endpoint takes: the order's details and
 * the administration details that can be entered at order time. */
export interface ImmunizationFormValues {
  details: Partial<InputImmunizationOrderDetails>;
  administrationDetails: InputImmunizationOrderAdministrationDetails;
}

/** One immunization on the order page. */
export interface ImmunizationLine extends ImmunizationFormValues {
  key: number;
}

// explicit empty values, so a cleared line and a quick pick without them read as empty blanks
export const EMPTY_ADMINISTRATION_DETAILS: InputImmunizationOrderAdministrationDetails = {
  lot: '',
  ndc: '',
  expDate: '',
  mvx: '',
  cvx: '',
  cptCodes: [],
  visGiven: false,
};

let nextLineKey = 0;

export const emptyImmunizationLine = (
  orderedProvider?: InputImmunizationOrderDetails['orderedProvider']
): ImmunizationLine => ({
  key: ++nextLineKey,
  details: { orderedProvider },
  administrationDetails: { ...EMPTY_ADMINISTRATION_DETAILS },
});

/** A line from saved values: a draft's, or the order being edited. */
export const immunizationLineFrom = (
  values: Pick<ImmunizationFormValues, 'details'> & Partial<Pick<ImmunizationFormValues, 'administrationDetails'>>
): ImmunizationLine => ({
  key: ++nextLineKey,
  details: { ...values.details },
  administrationDetails: { ...EMPTY_ADMINISTRATION_DETAILS, ...values.administrationDetails },
});

/** The quick pick's values over the form's: the order details when `applyOrderDetails`, the administration
 * details always. */
export const applyImmunizationQuickPick = <T extends ImmunizationFormValues>(
  values: T,
  quickPick: ImmunizationQuickPickData,
  applyOrderDetails: boolean
): T => ({
  ...values,
  ...(applyOrderDetails && {
    details: {
      ...values.details,
      medication: quickPick.vaccine,
      dose: quickPick.dose,
      units: quickPick.units,
      route: quickPick.route,
      location: quickPick.location,
      manufacturer: quickPick.manufacturer,
      instructions: quickPick.instructions,
    },
  }),
  administrationDetails: {
    ...values.administrationDetails,
    lot: quickPick.lot,
    expDate: quickPick.expDate,
    mvx: quickPick.mvx,
    cvx: quickPick.cvx,
    cptCodes: quickPick.cptCodes ?? [],
    ndc: quickPick.ndc,
  },
});

/** What the order form requires, as its fields did: the immunization, a positive dose, its units and who ordered. */
export const immunizationLineErrors = (line: ImmunizationFormValues): string[] => {
  const { details } = line;
  const errors: string[] = [];
  if (!details.medication) errors.push('Pick the immunization');
  if (!(parseFloat(details.dose ?? '') > 0)) errors.push(details.dose ? 'Dose must be positive' : 'Enter the dose');
  if (!details.units) errors.push('Pick the units');
  if (!details.orderedProvider) errors.push('Pick the ordering provider');
  return errors;
};

/** What administering requires, as the details card's fields did: every administration detail, unless the order is
 * being marked not administered. */
export const administrationErrors = (line: ImmunizationFormValues, administering: boolean): string[] => {
  if (!administering) return [];
  const { administrationDetails: details } = line;
  const errors: string[] = [];
  if (!details.administeredDateTime) errors.push('Enter the date and time given');
  if (!details.lot?.trim()) errors.push('Enter the lot number');
  if (!details.expDate) errors.push('Enter the expiration date');
  if (!details.ndc?.trim()) errors.push('Enter the NDC code');
  if (!details.cvx?.trim()) errors.push('Enter the CVX code');
  if (!details.mvx?.trim()) errors.push('Enter the MVX code');
  if (!details.visGiven) errors.push('Confirm the VIS was given to the patient');
  if (!details.visGivenDate) errors.push('Enter the VIS date');
  return errors;
};

/** The emergency contact is all or nothing, and its mobile a valid phone number. */
export const emergencyContactErrors = (contact: Partial<ImmunizationEmergencyContact>): string[] => {
  const filled = (value: string | undefined): boolean => !!value?.trim();
  const values = [contact.relationship, contact.fullName, contact.mobile];
  const errors: string[] = [];
  if (values.some(filled) && !values.every(filled)) {
    errors.push('Complete all emergency contact fields or leave them all empty');
  }
  if (filled(contact.mobile) && !isPhoneNumberValid(contact.mobile)) {
    errors.push('Phone number must be 10 digits in the format (xxx) xxx-xxxx and a valid number');
  }
  return errors;
};

export const immunizationLineToRequest = (
  line: ImmunizationFormValues,
  encounterId: string,
  orderId?: string
): CreateUpdateImmunizationOrderRequest => {
  const { details, administrationDetails } =
    cleanupProperties({ details: line.details, administrationDetails: line.administrationDetails }) ?? {};
  return {
    encounterId,
    orderId,
    details,
    // always sent so that clearing every field on edit clears them on the order too
    administrationDetails: administrationDetails ?? {},
  };
};
