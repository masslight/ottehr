import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ErxPharmacyRefillRequest, RenewalResponseInput } from 'utils/lib/types/api/erx.types';
import { COMPOUND_DOSAGE_FORMS, QUANTITY_UNITS, QuantityUnit } from 'utils/lib/types/api/order-prescription.types';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import {
  applyPrescriptionQuickPick,
  emptyPrescriptionLine,
  PrescriptionLine,
  prescriptionLineToOrder,
  unitLabel,
} from './prescriptionLines';

type RequestedMedication = ErxPharmacyRefillRequest['medication'];

const isQuantityUnit = (unit: string | undefined): unit is QuantityUnit =>
  (QUANTITY_UNITS as readonly string[]).includes(unit ?? '');

/** A number as the pharmacy sent it, in plain form: "0.27" (never ".27"), "3" (never "3.00"). */
export const plainNumber = (value: number | undefined): string | undefined =>
  value === undefined ? undefined : String(value);

const quantityText = (value: number | undefined, unit: string | undefined): string | undefined =>
  value === undefined
    ? undefined
    : `${plainNumber(value)} ${
        isQuantityUnit(unit) ? unitLabel(unit, String(value)).toLowerCase() : unit ?? ''
      }`.trim();

const allowedText = (allowed: boolean | undefined): string | undefined =>
  allowed === undefined ? undefined : allowed ? 'Allowed' : 'Not allowed';

/** One line of the request beside the original prescription. Either side is undefined when it has nothing there. */
export interface RequestRow {
  label: string;
  request?: string;
  original?: string;
  differs: boolean;
}

/**
 * The pharmacy's request beside the original prescription. The request side holds only what the pharmacy sent: a
 * field it left out is undefined, never 0 and never the original's (S.207). A row differs when both sides have a
 * value and they aren't the same; the medication by its NDC.
 */
export const requestRows = (request: RequestedMedication, prescription: PrescribedMedicationDTO): RequestRow[] => {
  const order = prescription.order ?? {};
  const row = (label: string, requested: string | undefined, original: string | undefined): RequestRow => ({
    label,
    request: requested,
    original,
    differs: requested !== undefined && original !== undefined && requested !== original,
  });
  return [
    {
      ...row('Medication', request.description, prescription.name),
      differs: request.ndc !== undefined && order.ndc !== undefined && request.ndc !== order.ndc,
    },
    row(
      'Quantity',
      quantityText(request.quantityValue, request.quantityUnit),
      quantityText(order.quantityValue, order.quantityUnit)
    ),
    row('Directions', request.sig, prescription.instructions),
    row('Days supply', plainNumber(request.daysSupply), plainNumber(order.daysSupply)),
    row('Substitution', allowedText(request.substitutionAllowed), allowedText(order.substitutionAllowed)),
    // Fills asked for and refills written count differently, so they aren't compared.
    {
      label: 'Refills',
      request: plainNumber(request.requestedRefills),
      original: plainNumber(order.numberOfRefills),
      differs: false,
    },
    row('Last filled', request.lastFillDate && formatDateForDisplay(request.lastFillDate), undefined),
    row('Pharmacy note', request.noteToPharmacy, order.noteToPharmacy),
  ];
};

/**
 * The prescription the order form starts with when the provider answers with a new one: what the pharmacy sent
 * where it sent it, else the original prescription's, since the provider writes the whole prescription again. The
 * diagnosis is always the original's (a request has none). A renewal's fills are the first fill plus its refills.
 */
export const refillLine = (prescription: PrescribedMedicationDTO, request?: RequestedMedication): PrescriptionLine => {
  const order = prescription.order ?? {};
  const unit = request?.quantityUnit ?? order.quantityUnit;
  const compound = request ? undefined : order.compound;
  const line = applyPrescriptionQuickPick(emptyPrescriptionLine(), {
    name: '',
    ...(compound
      ? {
          compound: {
            description: compound.description ?? prescription.name ?? '',
            dosageForm: COMPOUND_DOSAGE_FORMS.find((form) => form === compound.dosageForm),
            ingredients: compound.ingredients,
          },
        }
      : {
          ndc: request?.ndc ?? order.ndc,
          medicationDescription: request?.description ?? order.medicationDescription ?? prescription.name,
          substitutionAllowed: request?.substitutionAllowed ?? order.substitutionAllowed,
        }),
    quantityValue: request?.quantityValue ?? order.quantityValue,
    quantityUnit: isQuantityUnit(unit) ? unit : undefined,
    daysSupply: request?.daysSupply ?? order.daysSupply,
    numberOfRefills:
      request?.requestedRefills !== undefined ? Math.max(request.requestedRefills - 1, 0) : order.numberOfRefills,
    patientInstructions: request?.sig ?? prescription.instructions,
    noteToPharmacy: request?.noteToPharmacy ?? order.noteToPharmacy,
    diagnosis: order.diagnosisCode
      ? { code: order.diagnosisCode, display: order.diagnosisDescription ?? order.diagnosisCode }
      : undefined,
  });
  return { ...line, quickPicked: null };
};

/** "Change and approve": the renewal response approving the prescription the order form holds. Its fills are the
 * first fill plus the refills written; the eRx service sends what differs from the request as the changes. */
export const renewalApproval = (
  renewalTaskId: string,
  line: PrescriptionLine
): Extract<RenewalResponseInput, { decision: 'approve' }> => {
  if (line.compound) throw new Error('A compound can’t be sent in answer to a refill request.');
  const order = prescriptionLineToOrder(line, {
    patientId: '',
    practitionerId: '',
    encounterId: '',
    pharmacy: { ncpdpId: '', npi: '', name: '', phone: '', address: '' },
    writtenDate: '',
  });
  if (order.numberOfRefills > 98) throw new Error('Refills must be 98 or fewer in answer to a refill request.');
  return {
    taskId: renewalTaskId,
    decision: 'approve',
    numberOfRefills: order.numberOfRefills + 1,
    changes: {
      medicationDescription: order.medicationDescription,
      ndc: order.ndc,
      quantityValue: order.quantityValue,
      quantityUnit: order.quantityUnit,
      daysSupply: order.daysSupply,
      substitutionAllowed: order.substitutionAllowed,
      patientInstructions: order.patientInstructions,
      noteToPharmacy: order.noteToPharmacy,
    },
  };
};
