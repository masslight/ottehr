import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  ChangeResponseInput,
  ErxPharmacyRefillRequest,
  PrescriptionOrderMetadata,
  RenewalResponseInput,
} from 'utils/lib/types/api/erx.types';
import { COMPOUND_DOSAGE_FORMS, OrderPrescriptionInput } from 'utils/lib/types/api/order-prescription.types';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import {
  applyPrescriptionQuickPick,
  asciiFractions,
  emptyPrescriptionLine,
  hasDirectionsBlanks,
  isQuantityUnit,
  PrescriptionLine,
  prescriptionLineMetadata,
  prescriptionLineToOrder,
  quantityText,
  withPrescriptionMetadata,
} from './prescriptionLines';

type RequestedMedication = ErxPharmacyRefillRequest['medication'];

/** Whether the pharmacy sent our directions back: the same words in any case and spacing, "½" as "1/2". */
const sameSig = (requested: string, sent: string | undefined): boolean => {
  const plain = (text: string): string => asciiFractions(text).toLowerCase().replace(/\s+/g, ' ').trim();
  return sent !== undefined && plain(requested) === plain(sent);
};

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
 * value and they don't read the same; the medication only when its NDC differs too, and a quantity sent with no unit by
 * its value.
 */
export const requestRows = (request: RequestedMedication, prescription: PrescribedMedicationDTO): RequestRow[] => {
  const order = prescription.order ?? {};
  const row = (label: string, requested: string | undefined, original: string | undefined): RequestRow => ({
    label,
    request: requested,
    original,
    differs: requested !== undefined && original !== undefined && requested !== original,
  });
  const medication = row('Medication', request.description, prescription.name);
  const quantity = row(
    'Quantity',
    quantityText(request.quantityValue, request.quantityUnit),
    quantityText(order.quantityValue, order.quantityUnit)
  );
  return [
    {
      ...medication,
      differs: medication.differs && request.ndc !== undefined && order.ndc !== undefined && request.ndc !== order.ndc,
    },
    request.quantityUnit === undefined
      ? { ...quantity, differs: row('', request.quantityValue?.toString(), order.quantityValue?.toString()).differs }
      : quantity,
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
 * where it sent it, else the original prescription's, since the provider writes the whole prescription again; for
 * another product, never the original's directions, quantity or note to pharmacy. The
 * diagnosis is always the original's (a request has none). A renewal's fills are the first fill plus its refills.
 * The original's directions blanks (`metadata`) fill the form again when the medication is still its product and the
 * pharmacy sent our directions back (or none); its stored details go with them, so the sentence reads as it did.
 * Directions of the pharmacy's own stay as its text, with the blanks empty.
 */
export const refillLine = (
  prescription: PrescribedMedicationDTO,
  request?: RequestedMedication,
  metadata?: PrescriptionOrderMetadata
): PrescriptionLine => {
  const order = prescription.order ?? {};
  // The unit goes with the quantity it came with: a request's own, else empty for the provider, never the original's.
  const unit = request ? request.quantityUnit : order.quantityUnit;
  const compound = request ? undefined : order.compound;
  // The original's directions, quantity and note were written for its product, never for another one: by NDC, else
  // by name.
  const sameProduct =
    !request ||
    (request.ndc !== undefined && order.ndc !== undefined
      ? request.ndc === order.ndc
      : request.description === undefined ||
        request.description.trim().toLowerCase() ===
          (order.medicationDescription ?? prescription.name ?? '').trim().toLowerCase());
  // The blanks were written for the original's product and directions: another product (or none named), or a sig of
  // the pharmacy's own, starts from the sig alone. A compound's directions are typed, with no blanks.
  const blanks =
    metadata &&
    !compound &&
    (!request ||
      (request.ndc !== undefined &&
        request.ndc === order.ndc &&
        (request.sig === undefined || sameSig(request.sig, prescription.instructions))))
      ? metadata
      : undefined;
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
          ...blanks?.product,
        }),
    quantityValue: request?.quantityValue ?? (sameProduct ? order.quantityValue : undefined),
    quantityUnit: isQuantityUnit(unit) ? unit : undefined,
    daysSupply: request?.daysSupply ?? order.daysSupply,
    numberOfRefills:
      request?.numberOfRefills ??
      (request?.requestedRefills !== undefined ? Math.max(request.requestedRefills - 1, 0) : order.numberOfRefills),
    patientInstructions: request?.sig ?? (sameProduct ? prescription.instructions : undefined),
    noteToPharmacy: request?.noteToPharmacy ?? (sameProduct ? order.noteToPharmacy : undefined),
    diagnosis: order.diagnosisCode
      ? { code: order.diagnosisCode, display: order.diagnosisDescription ?? order.diagnosisCode }
      : undefined,
  });
  const started = { ...line, quickPicked: null };
  // With the blanks, the directions are ours as sent (the pharmacy's matched them).
  return blanks
    ? withPrescriptionMetadata({ ...started, patientInstructions: prescription.instructions ?? '' }, blanks)
    : started;
};

/** "Change": the renewal response approving the prescription the order form holds. Its fills are the
 * first fill plus the refills written; the eRx service sends what differs from the request as the changes, and keeps
 * the order's blanks (`metadata`) on the new prescription as it would a new order's. */
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
    ...(order.metadata ? { metadata: order.metadata } : {}),
  };
};

/** The blanks a plain approval keeps on the new prescription, as "Change" and a new order do: the
 * line's (the original's, filled again), also when its directions were typed over them; none when the blanks are
 * empty (the pharmacy's own directions), or for a compound. */
export const approvalMetadata = (line: PrescriptionLine): PrescriptionOrderMetadata | undefined =>
  line.medication && hasDirectionsBlanks(line) ? prescriptionLineMetadata(line) : undefined;

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

/** "Change" of a change request: the prescription the order form holds, over the selected suggestion
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
    ...(order.metadata ? { metadata: order.metadata } : {}),
  };
};

/** A change request's answer given in the dialog: the selected suggestion approved as the pharmacy sent it (none
 * for a drug-use alert approved as written), a prior authorization request approved with its number, or a denial or
 * pending answer with its reason. An approval keeps the blanks given (`approvalMetadata`) on the new prescription. */
export const changeResponse = (
  changeTaskId: string,
  decision: 'approve' | 'deny' | 'pending',
  { suggestion, priorAuthorization, reason, note, metadata }: ChangeAnswerDetails
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
      ...(metadata ? { metadata } : {}),
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
  /** The blanks the new prescription keeps, for an approval */
  metadata?: PrescriptionOrderMetadata;
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
