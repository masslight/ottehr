import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  ChangeResponseInput,
  ErxPharmacyRefillRequest,
  PrescriptionOrderMetadata,
  RenewalResponseInput,
} from 'utils/lib/types/api/erx.types';
import {
  COMPOUND_DOSAGE_FORMS,
  OrderPrescriptionInput,
  PrescriptionAllergy,
  PrescriptionVitals,
} from 'utils/lib/types/api/order-prescription.types';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import {
  applyPrescriptionQuickPick,
  compoundDetailsText,
  emptyPrescriptionLine,
  hasDirectionsBlanks,
  isQuantityUnit,
  PrescriptionLine,
  prescriptionLineMetadata,
  prescriptionLineToOrder,
  quantityText,
  sentSigInWords,
  withPrescriptionMetadata,
} from './prescriptionLines';

type RequestedMedication = ErxPharmacyRefillRequest['medication'];

/** Whether the pharmacy sent our directions back: the same words in any case and spacing, "½", "1/2" and "half" as
 * one. */
const sameSig = (requested: string, sent: string | undefined): boolean => {
  const plain = (text: string): string => sentSigInWords(text).toLowerCase().replace(/\s+/g, ' ').trim();
  return sent !== undefined && plain(requested) === plain(sent);
};

/** mg in a strength unit a description writes; another unit (mEq, units) compares as written. */
const STRENGTH_MG: Record<string, number> = { mcg: 0.001, mg: 1, gm: 1000, g: 1000 };

interface Strength {
  text: string;
  /** mg per mL for a liquid (a % is g per 100 mL, so ×10 mg/mL), else per unit, a combination's amounts in order. */
  values: number[];
  unit: string;
  at: number;
}

/** A product's strength in its description ("Amoxicillin 400 mg/5ml Susp"), as the warning names it ("400 mg/5 mL")
 * and per mL to compare by, so "80 mg/mL" is the same strength. A combination's amounts go together ("400-57 mg").
 * "100,000 unit" is 100000 units. A combination written per ingredient, as RxNorm does ("875 MG / clavulanate
 * potassium 125 MG"), reads as "875-125 mg". */
const strengthOf = (description: string | undefined): Strength | undefined => {
  if (!description) return undefined;
  const match = description.match(
    /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:-\d+(?:\.\d+)?)*)\s*(mcg|mg|gm|g|meq|units?|%)(?![a-z])(\s*\/\s*(\d+(?:\.\d+)?)?\s*ml\b)?/i
  );
  if (!match) return undefined;
  const [, writtenAmounts, written, perMl, per] = match;
  let amounts = writtenAmounts.replace(/,/g, '');
  const next = /\s*\/\s*(?:[a-z][a-z -]*\s)?(\d+(?:\.\d+)?)\s*([a-z%]+)(\s*\/\s*(\d+(?:\.\d+)?)?\s*ml\b)?/iy;
  next.lastIndex = (match.index ?? 0) + match[0].length;
  for (let more = next.exec(description); more; more = next.exec(description)) {
    if (more[2].toLowerCase() !== written.toLowerCase() || !more[3] !== !perMl || more[4] !== per) break;
    amounts += `-${more[1]}`;
  }
  const lower = written.toLowerCase();
  const unit = lower === 'meq' ? 'mEq' : lower === 'unit' ? 'units' : lower;
  const factor = unit === '%' ? 10 : STRENGTH_MG[unit];
  const ml = perMl ? `/${per ? `${per} ` : ''}mL` : '';
  return {
    text: `${amounts}${unit === '%' ? '' : ' '}${unit}${ml}`,
    values: amounts.split('-').map((amount) => (Number(amount) * (factor ?? 1)) / Number(per ?? 1)),
    unit: `${factor ? 'mg' : unit}${perMl || unit === '%' ? '/mL' : ''}`,
    at: match.index ?? 0,
  };
};

/** Strengths within 2% are one: "2.5 mg/3 mL" is 0.833 mg/mL, the "0.83 mg/mL" of the same solution. A real change of
 * strength is a quarter or more (400 to 250 mg/5 mL, 1.25 to 2.5 mg/3 mL). */
const sameStrength = (a: Strength, b: Strength): boolean =>
  a.unit === b.unit &&
  a.values.length === b.values.length &&
  a.values.every((value, i) => Math.abs(value - b.values[i]) <= 0.02 * Math.max(value, b.values[i]));

/** Salt, form, release and label words two drugs' names can share: "Cetirizine HCl" and "Levocetirizine" share none,
 * nor do "Childrens Ibuprofen" and "Childrens Acetaminophen" ("Children's" reads as "children"). */
const NOT_INGREDIENT = new Set(
  'sodium potassium pot calcium magnesium hcl hydrochloride sulfate phosphate trihydrate monohydrate oral suspension susp solution soln tablet tablets tab capsule capsules cap chewable odt dr er xr hfa for children childrens infant infants junior adult'.split(
    ' '
  )
);

/** The ingredient words of a name, before its strength: "Amoxicillin-Pot Clavulanate 600-42.9 mg" → amoxicillin,
 * clavulanate. */
const ingredientWords = (name: string, strengthAt: number): string[] =>
  name
    .slice(0, strengthAt)
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length > 1 && !NOT_INGREDIENT.has(word));

const NUMBER_WORDS: Record<string, string> = { one: '1', two: '2', three: '3', four: '4' };

/** The amount a sig gives each time, in any words: "Take 5 ml …" and "TAKE 5 ML …" as "5 ml", "1/2 tablet" as
 * "half tablet", "one tablet" and "1 tab" as "1 tablet". */
const sigAmount = (sig: string | undefined): string | undefined => {
  const match =
    sig === undefined
      ? null
      : sentSigInWords(sig)
          .toLowerCase()
          .match(
            /\b(\d+(?:\.\d+)?(?: and a half)?|half|one|two|three|four)\s*(ml|tab(?:let)?|capsule|puff|drop|spray)s?\b/
          );
  return match ? `${NUMBER_WORDS[match[1]] ?? match[1]} ${match[2] === 'tab' ? 'tablet' : match[2]}` : undefined;
};

/** The warning when the pharmacy suggests another strength of the same ingredient with directions that give the same
 * amount: the same mL of another concentration is another dose. None for the same strength from another maker or
 * bottle, and none for another drug, whose mg can't be weighed against the original's (a brand name against its
 * generic reads as another drug). A warning only. */
export const strengthChangeWarning = (
  request: RequestedMedication,
  prescription: PrescribedMedicationDTO
): string | undefined => {
  const originalName = prescription.order?.medicationDescription ?? prescription.name;
  const from = strengthOf(originalName);
  const to = strengthOf(request.description);
  const amount = sigAmount(request.sig);
  if (
    !from ||
    !to ||
    sameStrength(from, to) ||
    amount === undefined ||
    amount !== sigAmount(prescription.instructions)
  ) {
    return undefined;
  }
  const ingredients = ingredientWords(originalName ?? '', from.at);
  if (!ingredientWords(request.description ?? '', to.at).some((word) => ingredients.includes(word))) return undefined;
  return `Different strength, same amount: ${from.text} → ${to.text}. Check the dose.`;
};

const allowedText = (allowed: boolean | undefined): string | undefined =>
  allowed === undefined ? undefined : allowed ? 'Allowed' : 'Not allowed';

/** A medication as the prescription history reads one: a compound with its dosage form and ingredients. */
const medicationText = (name: string | undefined, compound: RequestedMedication['compound']): string | undefined =>
  compound ? `Compound: ${name ?? compound.description ?? ''} · ${compoundDetailsText(compound)}` : name;

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
 * value and they don't read the same; the medication only when its NDC differs too (a compound by what it holds), and a
 * quantity sent with no unit by its value.
 */
export const requestRows = (request: RequestedMedication, prescription: PrescribedMedicationDTO): RequestRow[] => {
  const order = prescription.order ?? {};
  const row = (label: string, requested: string | undefined, original: string | undefined): RequestRow => ({
    label,
    request: requested,
    original,
    differs: requested !== undefined && original !== undefined && requested !== original,
  });
  const medication = row(
    'Medication',
    medicationText(request.description, request.compound),
    medicationText(prescription.name, order.compound)
  );
  const quantity = row(
    'Quantity',
    quantityText(request.quantityValue, request.quantityUnit),
    quantityText(order.quantityValue, order.quantityUnit)
  );
  return [
    {
      ...medication,
      differs:
        medication.differs &&
        (!!request.compound ||
          !!order.compound ||
          (request.ndc !== undefined && order.ndc !== undefined && request.ndc !== order.ndc)),
    },
    request.quantityUnit === undefined
      ? { ...quantity, differs: row('', request.quantityValue?.toString(), order.quantityValue?.toString()).differs }
      : quantity,
    {
      ...row('Directions', request.sig, prescription.instructions),
      differs:
        request.sig !== undefined &&
        prescription.instructions !== undefined &&
        !sameSig(request.sig, prescription.instructions),
    },
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
 * another product, never the original's directions, quantity or note to pharmacy. A compound the pharmacy sent is
 * held as the original's would be: the provider can't change its ingredients in answer to a request. The
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
  const compound = request ? request.compound : order.compound;
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

/** "Change": the renewal response approving the prescription the order form holds, with the vitals and allergies its
 * order sends.
 * Its fills are the first fill plus the refills written; the eRx service sends what differs from the request as the
 * changes, and keeps the order's blanks (`metadata`) on the new prescription as it would a new order's. */
export const renewalApproval = (
  renewalTaskId: string,
  line: PrescriptionLine,
  vitals?: PrescriptionVitals,
  allergies?: PrescriptionAllergy[]
): Extract<RenewalResponseInput, { decision: 'approve' }> => {
  const order = answerOrder(line);
  if (order.numberOfRefills > 98) throw new Error('Refills must be 98 or fewer in answer to a refill request.');
  return {
    taskId: renewalTaskId,
    decision: 'approve',
    numberOfRefills: order.numberOfRefills + 1,
    changes: orderChanges(order),
    ...(order.metadata ? { metadata: order.metadata } : {}),
    ...(vitals ? { vitals } : {}),
    ...(allergies ? { allergies } : {}),
  };
};

/** The blanks a plain approval keeps on the new prescription, as "Change" and a new order do: the
 * line's (the original's, filled again), also when its directions were typed over them; none when the blanks are
 * empty (the pharmacy's own directions), or for a compound. */
export const approvalMetadata = (line: PrescriptionLine): PrescriptionOrderMetadata | undefined =>
  line.medication && hasDirectionsBlanks(line) ? prescriptionLineMetadata(line) : undefined;

/** The prescription the order form holds, in answer to a pharmacy's request. */
const answerOrder = (line: PrescriptionLine): OrderPrescriptionInput =>
  prescriptionLineToOrder(line, {
    patientId: '',
    practitionerId: '',
    encounterId: '',
    pharmacy: { ncpdpId: '', npi: '', name: '', phone: '', address: '' },
  });

/** The whole prescription as the changes, a product's NDC or a compound: the eRx service sends only what differs from
 * what was asked. */
const orderChanges = (
  order: OrderPrescriptionInput
): NonNullable<Extract<RenewalResponseInput, { decision: 'approve' }>['changes']> => ({
  medicationDescription: order.medicationDescription,
  ...(order.compound ? { compound: order.compound } : { ndc: order.ndc }),
  quantityValue: order.quantityValue,
  quantityUnit: order.quantityUnit,
  daysSupply: order.daysSupply,
  substitutionAllowed: order.substitutionAllowed,
  patientInstructions: order.patientInstructions,
  noteToPharmacy: order.noteToPharmacy,
});

/** "Change" of a change request: the prescription the order form holds, over the selected suggestion
 * (none when the pharmacy sent none), with the vitals and allergies its order sends. The eRx service picks Approved
 * or ApprovedWithChanges. */
export const changeApproval = (
  changeTaskId: string,
  suggestion: number | undefined,
  line: PrescriptionLine,
  vitals?: PrescriptionVitals,
  allergies?: PrescriptionAllergy[]
): Extract<ChangeResponseInput, { decision: 'approve' }> => {
  const order = answerOrder(line);
  return {
    taskId: changeTaskId,
    decision: 'approve',
    requestedMedicationIndex: suggestion,
    changes: { ...orderChanges(order), numberOfRefills: order.numberOfRefills },
    ...(order.metadata ? { metadata: order.metadata } : {}),
    ...(vitals ? { vitals } : {}),
    ...(allergies ? { allergies } : {}),
  };
};

/** A change request's answer given in the dialog: the selected suggestion approved as the pharmacy sent it (none
 * for a drug-use alert approved as written), a prior authorization request approved with its number, or a denial or
 * pending answer with its reason. An approval keeps the blanks given (`approvalMetadata`) on the new prescription, and
 * sends the patient's vitals; every answer sends the patient's allergies. */
export const changeResponse = (
  changeTaskId: string,
  decision: 'approve' | 'deny' | 'pending',
  { suggestion, priorAuthorization, reason, note, metadata, vitals, allergies }: ChangeAnswerDetails
): ChangeResponseInput => {
  if (decision === 'approve') {
    return {
      taskId: changeTaskId,
      decision,
      ...(allergies ? { allergies } : {}),
      note,
      ...(priorAuthorization
        ? { priorAuthorization: { number: priorAuthorization, status: 'approved' } }
        : suggestion !== undefined
        ? { requestedMedicationIndex: suggestion }
        : {}),
      ...(metadata ? { metadata } : {}),
      ...(vitals ? { vitals } : {}),
    };
  }
  return {
    taskId: changeTaskId,
    decision,
    ...(allergies ? { allergies } : {}),
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
  vitals?: PrescriptionVitals;
  allergies?: PrescriptionAllergy[];
}

/** A suggestion's line under its name, only what the pharmacy sent: "30 capsules · Take 1 … · 30 days · 2 refills",
 * after a compound's dosage form and ingredients. */
export const suggestionText = (suggestion: RequestedMedication): string =>
  [
    suggestion.compound && compoundDetailsText(suggestion.compound),
    quantityText(suggestion.quantityValue, suggestion.quantityUnit),
    suggestion.sig,
    suggestion.daysSupply !== undefined && `${suggestion.daysSupply} days`,
    suggestion.numberOfRefills !== undefined &&
      `${suggestion.numberOfRefills} ${suggestion.numberOfRefills === 1 ? 'refill' : 'refills'}`,
  ]
    .filter(Boolean)
    .join(' · ');
