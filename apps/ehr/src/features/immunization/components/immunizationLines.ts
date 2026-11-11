import { DateTime } from 'luxon';
import { cleanupProperties } from 'src/helpers/misc.helper';
import { isPhoneNumberValid } from 'utils/lib/helpers/helpers';
import { InventoryLot } from 'utils/lib/types/api/config/in-house-medications';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import {
  CreateUpdateImmunizationOrderRequest,
  ImmunizationCptCode,
  ImmunizationEmergencyContact,
  ImmunizationOutsideSource,
  InputImmunizationOrderAdministrationDetails,
  InputImmunizationOrderDetails,
  RecordOutsideImmunizationRequest,
} from 'utils/lib/types/data/immunization/types';
import { getMvxManufacturer } from 'utils/lib/types/data/immunization/vaccine-lookup';
import { VfcEligibilityCode } from 'utils/lib/types/data/immunization/vfc';
import type { CptOrigin } from './immunizationCodes';

/** The external line's own blanks: when, where and from what source the dose was given. */
export interface OutsideDoseValues {
  dateGiven?: string;
  place?: string;
  source?: ImmunizationOutsideSource;
}

/** What the order form holds for one immunization, in the shape the create endpoint takes: the order's details and
 * the administration details that can be entered at order time. A line with `outside` records a dose administered
 * externally instead of ordering one: the vaccine, lot and manufacturer are the same blanks. */
export interface ImmunizationFormValues {
  details: Partial<InputImmunizationOrderDetails>;
  administrationDetails: InputImmunizationOrderAdministrationDetails;
  outside?: OutsideDoseValues;
  /** Where the CPT codes came from: the page only fills a line's codes while they are empty or its own. */
  cptOrigin?: CptOrigin;
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
  values: Pick<ImmunizationFormValues, 'details'> &
    Partial<Pick<ImmunizationFormValues, 'administrationDetails' | 'outside' | 'cptOrigin'>>
): ImmunizationLine => ({
  key: ++nextLineKey,
  details: { ...values.details },
  administrationDetails: { ...EMPTY_ADMINISTRATION_DETAILS, ...values.administrationDetails },
  ...(values.outside ? { outside: { ...values.outside } } : {}),
  ...(values.cptOrigin ? { cptOrigin: values.cptOrigin } : {}),
});

/** A line nothing has been written in: "+ Add an externally administered immunization" converts it. */
export const isUntouchedOrderLine = (line: ImmunizationFormValues): boolean =>
  !line.outside && !line.details.medication && !line.details.dose && !line.details.units && !line.details.route;

/** An order line becomes an external one and back: the × after "administered externally". */
export const toggleOutside = <T extends ImmunizationFormValues>(line: T): T =>
  line.outside ? { ...line, outside: undefined } : { ...line, outside: {} };

/** On an external line a quick pick names the vaccine and its codes; its stock lot and expiry are not the dose's. */
export const applyQuickPickToOutsideLine = <T extends ImmunizationFormValues>(
  line: T,
  quickPick: ImmunizationQuickPickData
): T => ({
  ...line,
  details: { ...line.details, medication: quickPick.vaccine, manufacturer: quickPick.manufacturer },
  administrationDetails: { ...line.administrationDetails, cvx: quickPick.cvx, mvx: quickPick.mvx },
});

/** The quick pick's values over the form's: the order details when `applyOrderDetails`, the CPT codes always.
 * A quick pick carries only the order part and the admin codes: the lot, NDC, manufacturer and MVX come from the
 * lot picked from stock, and the CVX from the vaccine. Older quick picks that saved those are not applied. */
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
      instructions: quickPick.instructions,
    },
  }),
  administrationDetails: {
    ...values.administrationDetails,
    cptCodes: quickPick.cptCodes ?? [],
  },
  // a quick pick without codes leaves the line to the suggested ones
  cptOrigin: quickPick.cptCodes?.length ? 'quickpick' : undefined,
});

/** A lot picked from stock fills what the box says: lot, expiry, NDC, manufacturer and MVX, the stock it came from
 * and the eligibility it was picked under. The dose comes off that lot when administered. */
export const applyLotToLine = <T extends ImmunizationFormValues>(
  line: T,
  lot: InventoryLot,
  vfcEligibility: VfcEligibilityCode | undefined,
  borrowingReason?: string
): T => ({
  ...line,
  details: { ...line.details, manufacturer: lot.manufacturer ?? getMvxManufacturer(lot.mvx)?.name },
  administrationDetails: {
    ...line.administrationDetails,
    lot: lot.lotNumber,
    expDate: lot.expirationDate,
    ndc: lot.ndc ?? '',
    mvx: lot.mvx ?? line.administrationDetails.mvx,
    fundingSource: lot.fundingSource ?? 'private',
    vfcEligibility,
    borrowingReason,
  },
});

/** The code with its count when more than one, as the CPT blank and the quick pick pages read it: "90461 ×5". */
export const formatImmunizationCptCode = (cptCode: ImmunizationCptCode): string =>
  cptCode.billableUnits != null && cptCode.billableUnits > 1
    ? `${cptCode.code} ×${cptCode.billableUnits}`
    : cptCode.code;

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

/** An external line needs only its vaccine; a date given cannot be in the future. */
export const outsideLineErrors = (line: ImmunizationFormValues): string[] => {
  const errors: string[] = [];
  if (!line.details.medication) errors.push('Pick the immunization');
  const dateGiven = line.outside?.dateGiven ? DateTime.fromISO(line.outside.dateGiven) : undefined;
  if (dateGiven && dateGiven.startOf('day') > DateTime.now().startOf('day')) {
    errors.push('The date given cannot be in the future');
  }
  return errors;
};

/** The order page's save button: the orders and the outside doses it will save, e.g. "Order Immunization · Record 2
 * Outside". */
export const orderButtonLabel = (lines: ImmunizationFormValues[]): string => {
  const outside = lines.filter((line) => line.outside).length;
  const orders = lines.length - outside;
  return [
    orders === 1 ? 'Order Immunization' : orders ? `Order ${orders} Immunizations` : '',
    outside ? `Record ${outside} Outside` : '',
  ]
    .filter(Boolean)
    .join(' · ');
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
  // The CVX is saved from the vaccine, never typed: a vaccine set up without one cannot be administered.
  if (!details.cvx?.trim()) errors.push('This vaccine has no CVX code in its setup');
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

export const outsideLineToRequest = (
  line: ImmunizationFormValues,
  encounterId: string
): RecordOutsideImmunizationRequest => ({
  encounterId,
  ...cleanupProperties({
    vaccine: line.details.medication,
    cvx: line.administrationDetails.cvx,
    mvx: line.administrationDetails.mvx,
    manufacturer: line.details.manufacturer,
    lot: line.administrationDetails.lot,
    dateGiven: line.outside?.dateGiven,
    place: line.outside?.place,
    source: line.outside?.source,
  }),
});

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
