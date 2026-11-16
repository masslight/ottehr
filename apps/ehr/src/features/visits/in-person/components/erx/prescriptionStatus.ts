import { DateTime } from 'luxon';
import { ErxEventDTO, PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { PharmacySearchResult } from 'utils/lib/types/api/erx-search.types';
import {
  COMPOUND_DOSAGE_FORMS,
  CompoundDosageForm,
  OrderPrescriptionInput,
  QuantityUnit,
} from 'utils/lib/types/api/order-prescription.types';
import { compoundOrderIngredients, isQuantityUnit } from './prescriptionLines';

export type PrescriptionChip = 'Sending' | 'Sent' | 'Error' | 'Cancel requested' | 'Cancelled' | 'Other';

const CANCEL_EVENT_CODES = ['cancelrequested', 'cancelled', 'canceldenied'];

const eventDate = (event: ErxEventDTO): string =>
  event.recorded ? ` ${DateTime.fromISO(event.recorded).toLocal().toFormat('MM/dd')}` : '';

// The pharmacy's fill and request events, in plain words
const FILL_EVENT_TEXT: Record<string, (event: ErxEventDTO) => string> = {
  dispensed: (event) => `Dispensed${eventDate(event)}`,
  partiallydispensed: (event) => `Partially dispensed${eventDate(event)}`,
  notdispensed: () => 'Not dispensed',
  transferred: () => 'Transferred',
  renewalrequested: () => 'Refill requested by the pharmacy',
  changerequested: () => 'Change requested by the pharmacy',
};

const latestEvent = (
  prescription: PrescribedMedicationDTO,
  matches: (event: ErxEventDTO) => boolean
): ErxEventDTO | undefined => prescription.events?.filter(matches).at(-1);

// The reason follows a fixed prefix in the eRx service's event text.
const textAfter = (text: string | undefined, prefix: string): string | undefined =>
  text?.startsWith(prefix) ? text.slice(prefix.length).trim() || undefined : undefined;

const CANCEL_DENIED_PREFIX = 'Cancellation denied by pharmacy:';

/** The pharmacy's cancel reply in plain words: why it refused, its note, and whether it already dispensed. */
const cancelReplyDetails = (event: ErxEventDTO): string[] => {
  const reply = event.cancelResponse;
  return [
    reply?.denialReasonCode?.display,
    reply?.denialReason ?? textAfter(event.text, CANCEL_DENIED_PREFIX),
    reply?.note && `pharmacy note: ${reply.note}`,
    reply?.priorDispensing && 'Already dispensed',
  ].filter((detail): detail is string => !!detail);
};

/** The history's words for an event, where the service's own text isn't the one shown. */
export const erxEventText = (event: ErxEventDTO): string | undefined => {
  const details = cancelReplyDetails(event);
  if (event.code === 'canceldenied' && details.length) return `Cancellation denied by pharmacy: ${details.join('; ')}`;
  if (event.code === 'cancelled') return [event.text, ...details].filter(Boolean).join(' · ');
  return event.text;
};

/** The status chip and the latest event under it; "Other" for a status the eRx service doesn't set, its FHIR code on
 * hover. */
export const prescriptionStatusView = (
  prescription: PrescribedMedicationDTO
): { chip?: PrescriptionChip; detail?: string } => {
  switch (prescription.status) {
    case 'draft':
      return { chip: 'Sending', detail: 'Waiting for Surescripts' };
    case 'stopped':
      return { chip: 'Error', detail: latestEvent(prescription, (event) => event.code.startsWith('error'))?.text };
    case 'cancelled': {
      const cancelled = latestEvent(prescription, (event) => event.code === 'cancelled');
      const details = cancelled ? cancelReplyDetails(cancelled) : [];
      return { chip: 'Cancelled', detail: ['Confirmed by the pharmacy', ...details].join(' · ') };
    }
    case 'active': {
      const cancelEvent = latestEvent(prescription, (event) => CANCEL_EVENT_CODES.includes(event.code));
      if (cancelEvent?.code === 'cancelrequested') {
        const reason = textAfter(cancelEvent.text, 'Cancellation requested with reason:');
        return {
          chip: 'Cancel requested',
          detail: [reason, 'waiting for the pharmacy'].filter(Boolean).join(' · '),
        };
      }
      if (cancelEvent?.code === 'canceldenied') {
        const details = cancelReplyDetails(cancelEvent);
        return {
          chip: 'Sent',
          detail: details.length ? `Cancel denied: ${details.join('; ')}` : 'Cancel denied',
        };
      }
      const fillEvent = latestEvent(prescription, (event) => event.code in FILL_EVENT_TEXT);
      return { chip: 'Sent', detail: fillEvent && FILL_EVENT_TEXT[fillEvent.code](fillEvent) };
    }
    default:
      return prescription.status ? { chip: 'Other', detail: `Status code: ${prescription.status}` } : {};
  }
};

/** The eRx service cancels only an active prescription, and only once: never after any earlier request. */
export const isPrescriptionCancellable = (prescription: PrescribedMedicationDTO): boolean =>
  prescription.status === 'active' && !prescription.events?.some((event) => event.code === 'cancelrequested');

/** A sent prescription whose cancellation the pharmacy refused: it stays live there, and can't be cancelled again. */
export const isPrescriptionCancelDenied = (prescription: PrescribedMedicationDTO): boolean =>
  prescription.status === 'active' &&
  latestEvent(prescription, (event) => CANCEL_EVENT_CODES.includes(event.code))?.code === 'canceldenied';

/** "<name> stays live at <pharmacy>: its cancel was denied (Already dispensed).", with the pharmacy's reason when it
 * gave one: what tells staff whether the patient needs a second copy. */
export const cancelDeniedWarning = (prescription: PrescribedMedicationDTO): string => {
  const denied = latestEvent(prescription, (event) => event.code === 'canceldenied');
  const details = denied ? cancelReplyDetails(denied) : [];
  return `${prescription.name} stays live at ${prescription.pharmacyName ?? 'its pharmacy'}: its cancel was denied${
    details.length ? ` (${details.join('; ')})` : ''
  }.`;
};

/** Sending to another pharmacy cancels a sent prescription (so only a cancellable one) and resends an errored one.
 * After a denied cancel it sends the new one with no second cancel, which the eRx service refuses; the dialog warns
 * that the first stays live at its pharmacy. */
const canSendToAnotherPharmacyByStatus = (prescription: PrescribedMedicationDTO): boolean =>
  isPrescriptionCancellable(prescription) ||
  prescription.status === 'stopped' ||
  isPrescriptionCancelDenied(prescription);

const isCompoundDosageForm = (form: string | undefined): form is CompoundDosageForm =>
  COMPOUND_DOSAGE_FORMS.includes(form as CompoundDosageForm);

/** The order fields the new prescription needs that the stored one lacks. */
const missingOrderFields = (prescription: PrescribedMedicationDTO): string[] => {
  const order = prescription.order;
  const compound = order?.compound;
  // A compound is its name, dosage form and each ingredient's name and amount, in place of a product.
  const product: [string, unknown][] = compound
    ? [
        ['compound name', compound.description],
        ['dosage form', isCompoundDosageForm(compound.dosageForm) ? compound.dosageForm : undefined],
        ...compound.ingredients.flatMap((ingredient, i): [string, unknown][] => [
          [`ingredient ${i + 1} name`, ingredient.description],
          [`ingredient ${i + 1} amount`, ingredient.amount],
        ]),
      ]
    : [
        ['product code', order?.ndc],
        ['medication description', order?.medicationDescription],
      ];
  const required: [string, unknown][] = [
    ['patient', order?.patientId],
    ['visit', prescription.encounterId],
    ...product,
    ['quantity', order?.quantityValue],
    ['unit', isQuantityUnit(order?.quantityUnit) ? order?.quantityUnit : undefined],
    ['refills', order?.numberOfRefills],
    ...(compound ? [] : [['substitution', order?.substitutionAllowed] as [string, unknown]]),
    ['patient instructions', prescription.instructions],
  ];
  return required.filter(([, value]) => value === undefined || value === '').map(([label]) => label);
};

export type PrescriptionAction = 'cancel' | 'sendToAnotherPharmacy';

export const PRESCRIPTION_ACTION_NAMES: Record<PrescriptionAction, string> = {
  // The row button's name, so its hover reads the same.
  cancel: 'Cancel prescription',
  sendToAnotherPharmacy: 'Send to another pharmacy',
};

/** Whether an action's status rule covers the prescription. */
const prescriptionActionAppliesByStatus = (
  action: PrescriptionAction,
  prescription: PrescribedMedicationDTO
): boolean =>
  action === 'cancel' ? isPrescriptionCancellable(prescription) : canSendToAnotherPharmacyByStatus(prescription);

/** Why an action can't be taken on the prescription: its status, or the order fields it lacks. */
export const prescriptionActionBlocker = (
  action: PrescriptionAction,
  prescription: PrescribedMedicationDTO
): { status: string } | { missing: string[] } | undefined => {
  if (!prescriptionActionAppliesByStatus(action, prescription)) {
    const { chip } = prescriptionStatusView(prescription);
    // A sent prescription whose cancellation was refused can't be cancelled again.
    const cancelDenied = prescription.status === 'active' && chip === 'Sent';
    return { status: cancelDenied ? 'Cancel denied' : chip ?? prescription.status ?? 'unknown' };
  }
  if (action === 'sendToAnotherPharmacy') {
    const missing = missingOrderFields(prescription);
    if (missing.length) return { missing };
  }
  return undefined;
};

export const isPrescriptionActionAvailable = (
  action: PrescriptionAction,
  prescription: PrescribedMedicationDTO
): boolean => !prescriptionActionBlocker(action, prescription);

/** Why an action can't be taken on every one of the prescriptions, naming the statuses and missing fields. `name` is
 * what the text calls the action, where a screen offers it under another name; `saidElsewhere` the missing fields
 * the screen names on its own. */
export const prescriptionActionUnavailableText = (
  action: PrescriptionAction,
  prescriptions: PrescribedMedicationDTO[],
  name = PRESCRIPTION_ACTION_NAMES[action],
  saidElsewhere: string[] = []
): string | undefined => {
  const statuses = new Set<string>();
  const missing: string[] = [];
  for (const prescription of prescriptions) {
    const blocker = prescriptionActionBlocker(action, prescription);
    if (blocker && 'status' in blocker) statuses.add(blocker.status);
    const fields =
      blocker && 'missing' in blocker ? blocker.missing.filter((field) => !saidElsewhere.includes(field)) : [];
    if (fields.length) missing.push(`${prescription.name}: missing ${fields.join(', ')}`);
  }
  const parts = [
    statuses.size > 0 && `${name} isn't available for prescriptions with status ${[...statuses].join(', ')}.`,
    missing.length > 0 && `${name} isn't available for ${missing.join('; ')}.`,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
};

/** The same prescription again, for another pharmacy, from its stored order; undefined when a field is missing. */
export const prescriptionToOrderForPharmacy = (
  prescription: PrescribedMedicationDTO,
  context: { practitionerId: string; pharmacy: PharmacySearchResult } & Pick<
    OrderPrescriptionInput,
    'vitals' | 'allergies'
  >
): OrderPrescriptionInput | undefined => {
  const order = prescription.order;
  if (!order || missingOrderFields(prescription).length) return undefined;
  const common = {
    patientId: order.patientId!,
    practitionerId: context.practitionerId,
    encounterId: prescription.encounterId!,
    quantityValue: order.quantityValue!,
    quantityUnit: order.quantityUnit as QuantityUnit,
    ...(order.daysSupply !== undefined ? { daysSupply: order.daysSupply } : {}),
    numberOfRefills: order.numberOfRefills!,
    patientInstructions: prescription.instructions!,
    ...(order.noteToPharmacy ? { noteToPharmacy: order.noteToPharmacy } : {}),
    pharmacyId: context.pharmacy.ncpdpId,
    pharmacyNpi: context.pharmacy.npi,
    pharmacyName: context.pharmacy.name.trim(),
    pharmacyPhone: context.pharmacy.phone,
    ...(order.diagnosisCode ? { diagnosisCode: order.diagnosisCode } : {}),
    ...(order.diagnosisDescription ? { diagnosisDescription: order.diagnosisDescription } : {}),
    ...(context.vitals ? { vitals: context.vitals } : {}),
    ...(context.allergies ? { allergies: context.allergies } : {}),
  };
  const { compound } = order;
  if (compound) {
    // Every stored ingredient is the amount that went in, so each goes again as is.
    const converted = compoundOrderIngredients(
      { description: compound.description!, ingredients: compound.ingredients },
      { value: common.quantityValue, unit: common.quantityUnit }
    );
    if (!isCompoundDosageForm(compound.dosageForm) || 'errors' in converted) return undefined;
    return {
      ...common,
      medicationDescription: compound.description!,
      substitutionAllowed: false,
      compound: { dosageForm: compound.dosageForm, ingredients: converted.ingredients },
    };
  }
  return {
    ...common,
    ndc: order.ndc!,
    medicationDescription: order.medicationDescription!,
    substitutionAllowed: order.substitutionAllowed!,
    // The blanks the directions were written from, so a later Reorder or refill of the new one fills them again.
    ...(order.metadata ? { metadata: order.metadata } : {}),
  };
};
