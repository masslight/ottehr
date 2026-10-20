// The boxes of the CMS-1500 (02/12) and where their data prints on the pre-printed red form. The form is
// laid out for Pica type: 10 characters per inch and 6 lines per inch, so every value sits on a
// character cell of a 85 x 66 grid. `line` is the 1-based print line from the top of the page (line n
// covers (n - 1)/6" to n/6") and `col` the 1-based character column from the left edge (column c covers
// (c - 1)/10" to c/10"). `width` is how many characters fit before the next rule; longer values are cut
// off. Each box is known by its path in CMS1500_LAYOUT, e.g. "patientBirthDate.mm" (see CMS1500_BOXES).

export const CMS1500_PAGE = {
  width: 612,
  height: 792,
  // 10 CPI and 6 LPI in points
  columnWidth: 7.2,
  lineHeight: 12,
} as const;

export interface Cms1500Field {
  line: number;
  col: number;
  width: number;
  // right-aligned values end at col + width - 1
  align?: 'left' | 'right';
}

// Check boxes on one print line, of which the one for the claim's value gets an "X".
export interface Cms1500Choice<T extends string = string> {
  line: number;
  cols: Readonly<Record<T, number>>;
}

export type Cms1500Box = Cms1500Field | Cms1500Choice;

const field = (line: number, col: number, width: number, align?: 'right'): Cms1500Field => ({
  line,
  col,
  width,
  ...(align ? { align } : {}),
});

const choice = <T extends string>(line: number, cols: Record<T, number>): Cms1500Choice<T> => ({ line, cols });

export interface Cms1500DateField {
  mm: Cms1500Field;
  dd: Cms1500Field;
  year: Cms1500Field;
}

const date = (line: number, mm: number, dd: number, year: number, yearWidth = 4): Cms1500DateField => ({
  mm: field(line, mm, 2),
  dd: field(line, dd, 2),
  year: field(line, year, yearWidth),
});

const yesNo = (line: number, yes: number, no: number): Cms1500Choice<'yes' | 'no'> => choice(line, { yes, no });

export const CMS1500_LAYOUT = {
  carrier: [field(3, 46, 36), field(4, 46, 36), field(5, 46, 36), field(6, 46, 36)],
  // 1, 1a
  insuranceType: choice(10, { medicare: 4, medicaid: 11, tricare: 18, champva: 27, group: 34, feca: 42, other: 48 }),
  insuredId: field(10, 53, 29),
  // 2, 3, 4
  patientName: field(12, 4, 28),
  patientBirthDate: date(12, 34, 37, 40),
  patientSex: choice(12, { M: 45, F: 50 }),
  insuredName: field(12, 53, 29),
  // 5, 6, 7
  patientStreet: field(14, 4, 28),
  patientCity: field(16, 4, 24),
  patientState: field(16, 29, 3),
  patientZip: field(18, 4, 12),
  patientPhone: { areaCode: field(18, 18, 3), number: field(18, 22, 10) },
  relationship: choice(14, { self: 36, spouse: 41, child: 45, other: 50 }),
  insuredStreet: field(14, 53, 29),
  insuredCity: field(16, 53, 23),
  insuredState: field(16, 77, 4),
  insuredZip: field(18, 53, 12),
  insuredPhone: { areaCode: field(18, 68, 3), number: field(18, 72, 10) },
  // 9, 9a, 9d
  otherInsuredName: field(20, 4, 28),
  otherInsuredPolicyOrGroupNumber: field(22, 4, 28),
  otherInsuredPlanName: field(28, 4, 28),
  // 10a-10d
  employment: yesNo(22, 38, 44),
  autoAccident: yesNo(24, 38, 44),
  autoAccidentState: field(24, 48, 2),
  otherAccident: yesNo(26, 38, 44),
  claimCodes: field(28, 33, 19),
  // 11, 11a-11d
  insuredPolicyGroupNumber: field(20, 53, 29),
  insuredBirthDate: date(22, 56, 59, 62),
  insuredSex: choice(22, { M: 71, F: 78 }),
  otherClaimId: { qualifier: field(24, 53, 2), value: field(24, 56, 26) },
  insuredPlanName: field(26, 53, 29),
  anotherHealthBenefitPlan: yesNo(28, 55, 60),
  // 12, 13
  patientSignature: field(32, 10, 24),
  patientSignatureDate: field(32, 40, 12),
  insuredSignature: field(32, 60, 22),
  // 14, 15, 16
  currentIllnessDate: { ...date(34, 5, 8, 11), qualifier: field(34, 19, 3) },
  otherDate: { qualifier: field(34, 34, 3), ...date(34, 40, 43, 46) },
  unableToWorkFrom: date(34, 57, 60, 63),
  unableToWorkTo: date(34, 71, 74, 77),
  // 17, 17a, 17b, 18
  referringProviderQualifier: field(36, 4, 2),
  referringProviderName: field(36, 7, 23),
  referringProviderOtherId: { qualifier: field(35, 33, 2), value: field(35, 35, 17) },
  referringProviderNpi: field(36, 35, 17),
  hospitalizationFrom: date(36, 57, 60, 63),
  hospitalizationTo: date(36, 71, 74, 77),
  // 19, 20
  additionalClaimInformation: field(38, 4, 48),
  outsideLab: yesNo(38, 55, 60),
  outsideLabCharges: { dollars: field(38, 65, 8, 'right'), cents: field(38, 74, 2) },
  // 21: A-D, E-H and I-L on consecutive lines
  icdIndicator: field(39, 45, 1),
  diagnosisCodes: [40, 41, 42].flatMap((line) => [6, 19, 32, 45].map((col) => field(line, col, 7))),
  // 22, 23
  resubmissionCode: field(40, 53, 11),
  originalReferenceNumber: field(40, 65, 17),
  priorAuthorizationNumber: field(42, 53, 29),
  // 24: each service line is a shaded supplemental row with the main row below it. Lines are relative to
  // the main row of the first service line; service line i (0-based) is printed 2 * i lines further down.
  serviceLines: {
    count: 6,
    firstLine: 46,
    lineStep: 2,
    dateFrom: date(0, 4, 7, 10, 2),
    dateTo: date(0, 13, 16, 19, 2),
    placeOfService: field(0, 22, 2),
    emergency: field(0, 25, 2),
    procedureCode: field(0, 28, 6),
    modifiers: [field(0, 35, 2), field(0, 39, 2), field(0, 42, 2), field(0, 45, 2)],
    diagnosisPointer: field(0, 48, 4),
    charges: { dollars: field(0, 53, 5, 'right'), cents: field(0, 59, 2) },
    units: field(0, 62, 3),
    familyPlan: field(0, 66, 1),
    renderingProviderNpi: field(0, 71, 11),
    // shaded row
    supplementalInformation: field(-1, 4, 61),
    epsdt: field(-1, 65, 2),
    renderingProviderOtherIdQualifier: field(-1, 68, 2),
    renderingProviderOtherId: field(-1, 71, 11),
  },
  // 25-30
  federalTaxId: field(58, 4, 15),
  federalTaxIdType: choice(58, { SSN: 20, EIN: 22 }),
  patientAccountNumber: field(58, 26, 14),
  acceptAssignment: yesNo(58, 41, 46),
  totalCharge: { dollars: field(58, 55, 6, 'right'), cents: field(58, 61, 2) },
  amountPaid: { dollars: field(58, 67, 4, 'right'), cents: field(58, 71, 2) },
  // 31: line 62 is the only free line in the box, so the date goes between the SIGNED and DATE captions
  physicianSignature: field(62, 4, 21),
  physicianSignatureDate: field(63, 10, 8),
  // 32, 32a, 32b
  serviceFacility: [field(60, 26, 26), field(61, 26, 26), field(62, 26, 26)],
  serviceFacilityNpi: field(63, 27, 10),
  serviceFacilityOtherId: field(63, 39, 13),
  // 33, 33a, 33b; the phone number goes to the right of the caption
  billingProviderPhone: { areaCode: field(59, 69, 3), number: field(59, 73, 9) },
  billingProvider: [field(60, 53, 29), field(61, 53, 29), field(62, 53, 29)],
  billingProviderNpi: field(63, 54, 10),
  billingProviderOtherId: field(63, 66, 16),
} as const;

export interface Cms1500NamedBox {
  // Path in CMS1500_LAYOUT with list items numbered from 1, e.g. "carrier.1" or
  // "serviceLines.2.charges.dollars"
  name: string;
  box: Cms1500Box;
}

const isBox = (value: object): value is Cms1500Box => 'col' in value || 'cols' in value;

function namedBoxes(value: unknown, path: string[] = []): { path: string[]; box: Cms1500Box }[] {
  if (!value || typeof value !== 'object') return [];
  if (isBox(value)) return [{ path, box: value }];
  const children = Array.isArray(value)
    ? value.map((child, i): [string, unknown] => [String(i + 1), child])
    : Object.entries(value);
  return children.flatMap(([key, child]) => namedBoxes(child, [...path, key]));
}

const { serviceLines: SERVICE_LINES, ...CLAIM_ITEMS } = CMS1500_LAYOUT;
const claimBoxes = namedBoxes(CLAIM_ITEMS);
const serviceLineBoxes = namedBoxes(SERVICE_LINES);

// Every box on one form, with each service line's boxes moved to its print lines.
export const CMS1500_BOXES: readonly Cms1500NamedBox[] = [
  ...claimBoxes.map(({ path, box }) => ({ name: path.join('.'), box })),
  ...Array.from({ length: SERVICE_LINES.count }, (_, i) =>
    serviceLineBoxes.map(({ path, box }) => ({
      name: ['serviceLines', String(i + 1), ...path].join('.'),
      box: { ...box, line: box.line + SERVICE_LINES.firstLine + i * SERVICE_LINES.lineStep },
    }))
  ).flat(),
];

const BOX_NAMES = new Map<Cms1500Box, string>(
  [...claimBoxes, ...serviceLineBoxes].map(({ path, box }) => [box, path.join('.')])
);

// The name of a box of CMS1500_LAYOUT; for the boxes of CMS1500_LAYOUT.serviceLines, relative to its
// service line, e.g. "charges.dollars".
export function cms1500BoxName(box: Cms1500Box): string {
  const name = BOX_NAMES.get(box);
  if (!name) throw new Error('Not a box of CMS1500_LAYOUT');
  return name;
}
