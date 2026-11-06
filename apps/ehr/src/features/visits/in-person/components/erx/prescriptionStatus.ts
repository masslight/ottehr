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

export type PrescriptionChip = 'Sending' | 'Sent' | 'Sent by fax' | 'Error' | 'Cancel requested' | 'Cancelled';

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

// Surescripts couldn't deliver it electronically and faxed it instead.
const sentChip = (prescription: PrescribedMedicationDTO): PrescriptionChip =>
  prescription.events?.some((event) => event.code === 'faxed') ? 'Sent by fax' : 'Sent';

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
  if (event.code === 'faxed') return 'Sent by fax after an electronic failure';
  const details = cancelReplyDetails(event);
  if (event.code === 'canceldenied' && details.length) return `Cancellation denied by pharmacy: ${details.join('; ')}`;
  if (event.code === 'cancelled') return [event.text, ...details].filter(Boolean).join(' · ');
  return event.text;
};

/** The status chip and the latest event under it; no chip for a status the eRx service doesn't set. */
export const prescriptionStatusView = (
  prescription: PrescribedMedicationDTO
): { chip?: PrescriptionChip; detail?: string } => {
  switch (prescription.status) {
    case 'draft':
      return sentChip(prescription) === 'Sent by fax'
        ? { chip: 'Sent by fax' }
        : { chip: 'Sending', detail: 'Waiting for Surescripts' };
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
          chip: sentChip(prescription),
          detail: details.length ? `Cancel denied: ${details.join('; ')}` : 'Cancel denied',
        };
      }
      const fillEvent = latestEvent(prescription, (event) => event.code in FILL_EVENT_TEXT);
      return { chip: sentChip(prescription), detail: fillEvent && FILL_EVENT_TEXT[fillEvent.code](fillEvent) };
    }
    default:
      return {};
  }
};

/** The eRx service cancels only an active prescription, and only once: never after any earlier request. */
export const isPrescriptionCancellable = (prescription: PrescribedMedicationDTO): boolean =>
  prescription.status === 'active' && !prescription.events?.some((event) => event.code === 'cancelrequested');

/** Sending to another pharmacy cancels a sent prescription (so only a cancellable one) and resends an errored one. */
const canSendToAnotherPharmacyByStatus = (prescription: PrescribedMedicationDTO): boolean =>
  isPrescriptionCancellable(prescription) || prescription.status === 'stopped';

const isCompoundDosageForm = (form: string | undefined): form is CompoundDosageForm =>
  COMPOUND_DOSAGE_FORMS.includes(form as CompoundDosageForm);

/** The eRx service can't cancel a compound yet: Cancel, Send to another pharmacy and a patient's change request. */
export const COMPOUND_CANCEL_UNSUPPORTED = "Canceling compounds isn't supported yet";

/** Whether the action would cancel a compound: Cancel, or sending a sent one to another pharmacy (which cancels it
 * first); an errored one is only sent again. */
const cancelsCompound = (action: PrescriptionAction, prescription: PrescribedMedicationDTO): boolean =>
  !!prescription.order?.compound && (action === 'cancel' || isPrescriptionCancellable(prescription));

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
        ['NDC', order?.ndc],
        ['medication description', order?.medicationDescription],
      ];
  const required: [string, unknown][] = [
    ['patient', order?.patientId],
    ['encounter', prescription.encounterId],
    ...product,
    ['quantity', order?.quantityValue],
    ['quantity unit', isQuantityUnit(order?.quantityUnit) ? order?.quantityUnit : undefined],
    ['refills', order?.numberOfRefills],
    ...(compound ? [] : [['substitution', order?.substitutionAllowed] as [string, unknown]]),
    ['patient instructions', prescription.instructions],
  ];
  return required.filter(([, value]) => value === undefined || value === '').map(([label]) => label);
};

export type PrescriptionAction = 'cancel' | 'sendToAnotherPharmacy';

export const PRESCRIPTION_ACTION_NAMES: Record<PrescriptionAction, string> = {
  cancel: 'Cancel',
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
): { status: string } | { missing: string[] } | { unsupported: string } | undefined => {
  if (!prescriptionActionAppliesByStatus(action, prescription)) {
    const { chip } = prescriptionStatusView(prescription);
    // A sent prescription whose cancellation was refused can't be cancelled again.
    const cancelDenied = prescription.status === 'active' && (chip === 'Sent' || chip === 'Sent by fax');
    return { status: cancelDenied ? 'Cancel denied' : chip ?? prescription.status ?? 'unknown' };
  }
  if (cancelsCompound(action, prescription)) return { unsupported: COMPOUND_CANCEL_UNSUPPORTED };
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

/** Why an action can't be taken on every one of the prescriptions, naming the statuses and missing fields. */
export const prescriptionActionUnavailableText = (
  action: PrescriptionAction,
  prescriptions: PrescribedMedicationDTO[]
): string | undefined => {
  const name = PRESCRIPTION_ACTION_NAMES[action];
  const statuses = new Set<string>();
  const missing: string[] = [];
  const unsupported = new Set<string>();
  for (const prescription of prescriptions) {
    const blocker = prescriptionActionBlocker(action, prescription);
    if (blocker && 'status' in blocker) statuses.add(blocker.status);
    if (blocker && 'missing' in blocker) missing.push(`${prescription.name}: missing ${blocker.missing.join(', ')}`);
    if (blocker && 'unsupported' in blocker) unsupported.add(blocker.unsupported);
  }
  const parts = [
    statuses.size > 0 && `${name} isn't available for prescriptions with status ${[...statuses].join(', ')}.`,
    missing.length > 0 && `${name} isn't available for ${missing.join('; ')}.`,
    ...unsupported,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
};

/** The same prescription again, for another pharmacy, from its stored order; undefined when a field is missing. */
export const prescriptionToOrderForPharmacy = (
  prescription: PrescribedMedicationDTO,
  context: { practitionerId: string; writtenDate: string; pharmacy: PharmacySearchResult } & Pick<
    OrderPrescriptionInput,
    'patientHeight' | 'patientWeight'
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
    writtenDate: context.writtenDate,
    numberOfRefills: order.numberOfRefills!,
    patientInstructions: prescription.instructions!,
    ...(order.noteToPharmacy ? { noteToPharmacy: order.noteToPharmacy } : {}),
    pharmacyId: context.pharmacy.ncpdpId,
    pharmacyNpi: context.pharmacy.npi,
    pharmacyName: context.pharmacy.name.trim(),
    pharmacyPhone: context.pharmacy.phone,
    ...(order.diagnosisCode ? { diagnosisCode: order.diagnosisCode } : {}),
    ...(order.diagnosisDescription ? { diagnosisDescription: order.diagnosisDescription } : {}),
    ...(context.patientHeight ? { patientHeight: context.patientHeight } : {}),
    ...(context.patientWeight ? { patientWeight: context.patientWeight } : {}),
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
  };
};
