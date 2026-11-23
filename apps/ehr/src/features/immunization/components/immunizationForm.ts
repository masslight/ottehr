import { DateTime } from 'luxon';
import type { BlankOption } from 'src/features/visits/in-person/components/procedures/narrative/InlineBlanks';
import { cleanupProperties } from 'src/helpers/misc.helper';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { MVX_MANUFACTURERS } from 'utils/lib/types/data/immunization/mvx-manufacturers.generated';
import {
  CreateUpdateImmunizationOrderRequest,
  ImmunizationOrder,
  InputImmunizationOrderAdministrationDetails,
  InputImmunizationOrderDetails,
} from 'utils/lib/types/data/immunization/types';
import { getCvxVaccine, getMvxManufacturer } from 'utils/lib/types/data/immunization/vaccine-lookup';

/** What the immunization form holds, in the shape the create endpoint takes: the order's details and the
 * administration details that can be entered at order time. */
export interface ImmunizationFormValues {
  details: Partial<InputImmunizationOrderDetails>;
  administrationDetails: InputImmunizationOrderAdministrationDetails;
}

// The administration details of a form nothing has been entered in.
export const EMPTY_ADMINISTRATION_DETAILS: InputImmunizationOrderAdministrationDetails = {
  lot: '',
  ndc: '',
  expDate: '',
  mvx: '',
  cptCodes: [],
  visGiven: false,
};

export const emptyImmunizationForm = (): ImmunizationFormValues => ({
  details: {},
  administrationDetails: { ...EMPTY_ADMINISTRATION_DETAILS },
});

/** The form's values for a saved order, without what the server works out itself: when it was ordered, who
 * administered it, the emergency contact and the CVX code. */
export const immunizationFormFromOrder = (order: ImmunizationOrder): ImmunizationFormValues => {
  const { orderedDateTime: _orderedDateTime, ...details } = order.details;
  const {
    administeredProvider: _administeredProvider,
    emergencyContact: _emergencyContact,
    cvx: _cvx,
    ...administrationDetails
  } = order.administrationDetails ?? {};
  return { details, administrationDetails: { ...EMPTY_ADMINISTRATION_DETAILS, ...administrationDetails } };
};

/**
 * The quick pick's values over the form's. On the order page it fills the order as well (`applyOrderDetails`); on an
 * order's details card only what is recorded at administration, so the order stays as it was placed.
 */
export const applyImmunizationQuickPick = (
  values: ImmunizationFormValues,
  quickPick: ImmunizationQuickPickData,
  applyOrderDetails: boolean
): ImmunizationFormValues => ({
  details: {
    ...values.details,
    ...(applyOrderDetails && {
      // A quick pick saved against a vaccine that is not in the list leaves the vaccine for the user to pick.
      medication: getCvxVaccine(quickPick.vaccine?.id) ? quickPick.vaccine : undefined,
      dose: quickPick.dose,
      units: quickPick.units,
      route: quickPick.route,
      location: quickPick.location,
      instructions: quickPick.instructions,
    }),
    manufacturer: quickPick.manufacturer,
  },
  administrationDetails: {
    ...values.administrationDetails,
    lot: quickPick.lot,
    expDate: quickPick.expDate,
    mvx: quickPick.mvx,
    cptCodes: quickPick.cptCodes ?? [],
    ndc: quickPick.ndc,
  },
});

/** The form saved as a quick pick. Its CVX code is the vaccine's, its MVX code the picked manufacturer's. */
export const immunizationQuickPickFrom = (
  { details, administrationDetails }: ImmunizationFormValues,
  name: string
): Omit<ImmunizationQuickPickData, 'id'> => ({
  name,
  vaccine: details.medication,
  dose: details.dose,
  units: details.units,
  route: details.route,
  location: details.location,
  manufacturer: details.manufacturer,
  instructions: details.instructions,
  cvx: getCvxVaccine(details.medication?.id)?.cvx,
  mvx: administrationDetails.mvx,
  cptCodes: administrationDetails.cptCodes,
  ndc: administrationDetails.ndc,
  lot: administrationDetails.lot,
  expDate: administrationDetails.expDate,
});

/** What ordering requires: the immunization, a positive dose, its units and who ordered. */
export const immunizationOrderErrors = ({ details }: ImmunizationFormValues): string[] => {
  const errors: string[] = [];
  if (!details.medication?.id) errors.push('Pick the immunization');
  if (!(parseFloat(details.dose ?? '') > 0)) errors.push(details.dose ? 'Dose must be positive' : 'Enter the dose');
  if (!details.units) errors.push('Pick the units');
  if (!details.orderedProvider?.id) errors.push('Pick the ordering provider');
  return errors;
};

/**
 * What marking the order administered or partly administered requires on top of the order: when the dose was given,
 * its lot, expiration date and NDC code, the manufacturer by MVX code, and the date the VIS was given. The dose is
 * recorded with the vaccine's CVX code, which only a vaccine ordered before the vaccine list can lack: such an order
 * needs the code it was saved with (`recordedCvx`) or a vaccine from the list.
 */
export const administrationErrors = (
  { details, administrationDetails }: ImmunizationFormValues,
  recordedCvx: string | undefined
): string[] => {
  const errors: string[] = [];
  if (details.medication?.id && !getCvxVaccine(details.medication.id) && !recordedCvx?.trim()) {
    errors.push('Pick the immunization from the list: this one has no CVX code');
  }
  if (!administrationDetails.administeredDateTime) errors.push('Enter the date and time given');
  if (!administrationDetails.lot?.trim()) errors.push('Enter the lot number');
  if (!administrationDetails.expDate) errors.push('Enter the expiration date');
  if (!administrationDetails.ndc?.trim()) errors.push('Enter the NDC code');
  if (!administrationDetails.mvx?.trim()) errors.push('Pick the manufacturer from the list');
  if (!administrationDetails.visGivenDate) errors.push('Enter the date the VIS was given');
  return errors;
};

export const immunizationOrderRequest = (
  values: ImmunizationFormValues,
  encounterId: string,
  orderId?: string
): CreateUpdateImmunizationOrderRequest => {
  const { details, administrationDetails } = cleanupProperties(values) ?? {};
  return {
    encounterId,
    orderId,
    details,
    // always sent so that clearing every field on edit clears them on the order too
    administrationDetails: administrationDetails ?? {},
  };
};

/**
 * The administered date-time after its date or its time blank changes: the two blanks share the one value, and each
 * changes only its own part. The part not entered yet is taken from now: a date picked first is at the current time,
 * a time picked first is today.
 */
export const mergeAdministeredDateTime = (
  current: string | undefined,
  next: DateTime | null,
  part: 'date' | 'time',
  now: DateTime = DateTime.now()
): string | undefined => {
  if (!next?.isValid) return undefined;
  // A year still being typed (0002, 0020, 0202) is skipped: its old local-mean-time offset has seconds, which the
  // saved ISO drops, so each keystroke would move the time back a little, past midnight into the day before.
  if (next.year < 1900) return current;
  const saved = current ? DateTime.fromISO(current) : undefined;
  const base = saved?.isValid ? saved : now.set({ second: 0, millisecond: 0 });
  const merged =
    part === 'date'
      ? base.set({ year: next.year, month: next.month, day: next.day })
      : base.set({ hour: next.hour, minute: next.minute, second: 0, millisecond: 0 });
  return merged.toISO() ?? undefined;
};

const MVX_OPTIONS: BlankOption[] = MVX_MANUFACTURERS.map((manufacturer) => ({
  value: manufacturer.mvx,
  label: manufacturer.name,
}));

/** The manufacturer blank's option for a manufacturer saved before the list: none of the MVX codes. */
export const SAVED_MANUFACTURER = 'saved';

/**
 * The manufacturer blank: one pick from the MVX list sets the manufacturer's name and its MVX code together. A name
 * typed before the list existed, or a typed MVX code the list does not have, is offered first as it was saved and
 * stays picked until a manufacturer from the list replaces it. `label` is the picked option as the blank reads.
 */
export const manufacturerBlank = ({
  details,
  administrationDetails,
}: ImmunizationFormValues): { value: string | undefined; label: string | undefined; options: BlankOption[] } => {
  const name = details.manufacturer?.trim();
  const mvx = administrationDetails.mvx?.trim();
  if (!name && !mvx) return { value: undefined, label: undefined, options: MVX_OPTIONS };
  const listed = getMvxManufacturer(mvx);
  if (listed && (!name || name === listed.name)) {
    return { value: listed.mvx, label: listed.name, options: MVX_OPTIONS };
  }
  const label = name && mvx ? `${name} (MVX ${mvx})` : name || `MVX ${mvx}`;
  return { value: SAVED_MANUFACTURER, label, options: [{ value: SAVED_MANUFACTURER, label }, ...MVX_OPTIONS] };
};

/** The manufacturer blank's pick as the form saves it: the list's name and MVX code, or neither when cleared. */
export const pickManufacturer = (values: ImmunizationFormValues, mvx: string | undefined): ImmunizationFormValues => {
  const manufacturer = getMvxManufacturer(mvx);
  // the saved manufacturer is not a new pick
  if (mvx && !manufacturer) return values;
  return {
    details: { ...values.details, manufacturer: manufacturer?.name ?? '' },
    administrationDetails: { ...values.administrationDetails, mvx: manufacturer?.mvx ?? '' },
  };
};

const formatDate = (isoDate: string): string => {
  const date = DateTime.fromISO(isoDate);
  return date.isValid ? date.toLocaleString(DateTime.DATE_MED) : isoDate;
};

/** What the Administration block already holds, in the order of its sentences: shown while it is collapsed, so
 * nothing entered is out of sight. */
export const administrationSummary = (values: ImmunizationFormValues): string[] => {
  const { administeredDateTime, lot, expDate, ndc, visGivenDate, cptCodes } = values.administrationDetails;
  const given = administeredDateTime ? DateTime.fromISO(administeredDateTime) : undefined;
  return [
    given?.isValid ? `Given ${given.toLocaleString(DateTime.DATETIME_MED)}` : '',
    lot ? `Lot ${lot}` : '',
    expDate ? `expires ${formatDate(expDate)}` : '',
    ndc ? `NDC ${ndc}` : '',
    manufacturerBlank(values).label ?? '',
    visGivenDate ? `VIS given ${formatDate(visGivenDate)}` : '',
    cptCodes?.length ? `CPT ${cptCodes.map((cptCode) => cptCode.code).join(', ')}` : '',
  ].filter(Boolean);
};
