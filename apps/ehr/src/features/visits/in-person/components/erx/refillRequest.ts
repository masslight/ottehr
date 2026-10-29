import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ChangeResponseInput, ErxPharmacyRefillRequest, RenewalResponseInput } from 'utils/lib/types/api/erx.types';
import { COMPOUND_DOSAGE_FORMS, OrderPrescriptionInput } from 'utils/lib/types/api/order-prescription.types';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import {
  applyPrescriptionQuickPick,
  emptyPrescriptionLine,
  isQuantityUnit,
  PrescriptionLine,
  prescriptionLineToOrder,
  quantityText,
} from './prescriptionLines';

type RequestedMedication = ErxPharmacyRefillRequest['medication'];

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
    row('Days supply', request.daysSupply?.toString(), order.daysSupply?.toString()),
    row('Substitution', allowedText(request.substitutionAllowed), allowedText(order.substitutionAllowed)),
    // Fills asked for and refills written count differently, so a refill request's aren't compared; a change
    // suggestion's refills are.
    request.numberOfRefills !== undefined
      ? row('Refills', request.numberOfRefills.toString(), order.numberOfRefills?.toString())
      : {
          label: 'Refills',
          request: request.requestedRefills?.toString(),
          original: order.numberOfRefills?.toString(),
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
  // The unit goes with the quantity it came with: a request's own, else empty for the provider, never the original's.
  const unit = request ? request.quantityUnit : order.quantityUnit;
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
          // A suggested medication is never the original's product.
          ndc: request ? request.ndc : order.ndc,
          medicationDescription: request?.description ?? order.medicationDescription ?? prescription.name,
          substitutionAllowed: request?.substitutionAllowed ?? order.substitutionAllowed,
        }),
    quantityValue: request?.quantityValue ?? order.quantityValue,
    quantityUnit: isQuantityUnit(unit) ? unit : undefined,
    daysSupply: request?.daysSupply ?? order.daysSupply,
    numberOfRefills:
      request?.numberOfRefills ??
      (request?.requestedRefills !== undefined ? Math.max(request.requestedRefills - 1, 0) : order.numberOfRefills),
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
  const order = answerOrder(line);
  if (order.numberOfRefills > 98) throw new Error('Refills must be 98 or fewer in answer to a refill request.');
  return {
    taskId: renewalTaskId,
    decision: 'approve',
    numberOfRefills: order.numberOfRefills + 1,
    changes: orderChanges(order),
  };
};

/** The prescription the order form holds, in answer to a pharmacy's request, which can't be a compound. */
const answerOrder = (line: PrescriptionLine): OrderPrescriptionInput => {
  if (line.compound) throw new Error('A compound can’t be sent in answer to a pharmacy’s request.');
  return prescriptionLineToOrder(line, {
    patientId: '',
    practitionerId: '',
    encounterId: '',
    pharmacy: { ncpdpId: '', npi: '', name: '', phone: '', address: '' },
    writtenDate: '',
  });
};

/** The whole prescription as the changes: the eRx service sends only what differs from what was asked. */
const orderChanges = (
  order: OrderPrescriptionInput
): NonNullable<Extract<RenewalResponseInput, { decision: 'approve' }>['changes']> => ({
  medicationDescription: order.medicationDescription,
  ndc: order.ndc,
  quantityValue: order.quantityValue,
  quantityUnit: order.quantityUnit,
  daysSupply: order.daysSupply,
  substitutionAllowed: order.substitutionAllowed,
  patientInstructions: order.patientInstructions,
  noteToPharmacy: order.noteToPharmacy,
});

/** "Change and approve" of a change request: the prescription the order form holds, over the selected suggestion
 * (none when the pharmacy sent none). The eRx service picks Approved or ApprovedWithChanges. */
export const changeApproval = (
  changeTaskId: string,
  suggestion: number | undefined,
  line: PrescriptionLine
): Extract<ChangeResponseInput, { decision: 'approve' }> => {
  const order = answerOrder(line);
  return {
    taskId: changeTaskId,
    decision: 'approve',
    requestedMedicationIndex: suggestion,
    changes: { ...orderChanges(order), numberOfRefills: order.numberOfRefills },
  };
};

/** A change request's answer given in the dialog: the selected suggestion approved as the pharmacy sent it (none
 * for a drug-use alert approved as written), a prior authorization request approved with its number, or a denial or
 * pending answer with its reason. */
export const changeResponse = (
  changeTaskId: string,
  decision: 'approve' | 'deny' | 'pending',
  { suggestion, priorAuthorization, reason, note }: ChangeAnswerDetails
): ChangeResponseInput => {
  if (decision === 'approve') {
    return {
      taskId: changeTaskId,
      decision,
      note,
      ...(priorAuthorization
        ? { priorAuthorization: { number: priorAuthorization, status: 'approved' } }
        : suggestion !== undefined
        ? { requestedMedicationIndex: suggestion }
        : {}),
    };
  }
  return {
    taskId: changeTaskId,
    decision,
    reason,
    [decision === 'deny' ? 'denialReason' : 'note']: note,
  } as ChangeResponseInput;
};

interface ChangeAnswerDetails {
  suggestion?: number;
  /** A prior authorization request's number */
  priorAuthorization?: string;
  reason?: string;
  note?: string;
}

/** A suggestion's line under its name, only what the pharmacy sent: "30 capsules · Take 1 … · 30 days · 2 refills". */
export const suggestionText = (suggestion: RequestedMedication): string =>
  [
    quantityText(suggestion.quantityValue, suggestion.quantityUnit),
    suggestion.sig,
    suggestion.daysSupply !== undefined && `${suggestion.daysSupply} days`,
    suggestion.numberOfRefills !== undefined &&
      `${suggestion.numberOfRefills} ${suggestion.numberOfRefills === 1 ? 'refill' : 'refills'}`,
  ]
    .filter(Boolean)
    .join(' · ');
