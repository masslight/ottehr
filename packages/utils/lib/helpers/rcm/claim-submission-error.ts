// The Oystehr claim service (submit-claim, claim-to-x12) validates a claim while building its 837
// (zapehr: project-api/src/functions/rcm/x12-fhir/fhirClaimToEdi837.ts) and rejects an incomplete one
// with messages that name the offending value by its FHIR path, e.g.
//   "Claim.insurance[sequence=1].coverage.extension[https://extensions.fhir.oystehr.com/rcm-claim-insurance-type]" is undefined
// Billers can't act on that. describeClaimSubmissionError rewrites each such message into the terms the
// billing app uses ("Primary insurance: Plan Type is missing") and leaves any other text untouched, so
// an unrecognized message still reaches the user verbatim.

// ---------------------------------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------------------------------

// Values billers set on the billing-app screens, keyed by FHIR element name. Anything else is derived
// from the element name.
const FIELD_LABELS: Record<string, string> = {
  id: 'Claim ID',
  provider: 'Billing provider',
  facility: 'Service facility',
  patient: 'Patient',
  coverage: 'Coverage',
  subscriber: 'Subscriber',
  subscriberId: 'Member ID',
  payor: 'Payer',
  relationship: 'Relationship to insured',
  birthDate: 'Date of Birth',
  name: 'Name',
  address: 'Address',
  city: 'City',
  state: 'State',
  postalCode: 'ZIP',
  billablePeriod: 'Billing period',
  total: 'Total charges',
  diagnosisSequence: 'Diagnosis pointer',
  productOrService: 'CPT/HCPCS',
  locationCodeableConcept: 'Place of Service',
  servicedPeriod: 'Date of Service',
  servicedDate: 'Date of Service',
  net: 'Charges',
  unitPrice: 'Charges',
  quantity: 'Units',
  revenue: 'Revenue code',
  procedureCodeableConcept: 'Procedure code',
  adjudication: 'Adjudication',
};

// Labels that depend on the parent element ("class[0].value" is the group number).
const NESTED_FIELD_LABELS: Record<string, string> = {
  'class.name': 'Group name',
  'class.value': 'Group Number',
  'name.given': 'First name',
  'name.family': 'Last name',
  'line.0': 'Address Line 1',
  'line.1': 'Address Line 2',
};

// Oystehr claim extensions, keyed by the last segment of their URL.
const EXTENSION_LABELS: Record<string, string> = {
  'rcm-claim-insurance-type': 'Plan Type',
  'rcm-claim-release-of-information-code': 'Release of information code',
  'rcm-claim-provider-signature-indicator': 'Provider signature indicator',
  'rcm-claim-benefits-assignment-certification-indicator': 'Benefits assignment certification',
  'rcm-claim-assignment-or-plan-participation-code': 'Assignment / plan participation code',
  'rcm-claim-facility-type-code': 'Facility type code',
  'rcm-claim-auto-accident-state': 'Accident State',
  'rcm-claim-condition-code': 'Condition',
  'rcm-claim-patient-paid': 'Patient paid amount',
  'rcm-claim-property-and-casualty-number': 'Property & casualty claim number',
  'rcm-claim-item-ordering-provider': 'Ordering provider',
  'rcm-claim-medicare-secondary-code': 'Medicare secondary reason',
  'rcm-claim-patient-discharge-status': 'Patient Discharge Status Code',
  'rcm-claim-admission-type-code': 'Admission type code',
  'rcm-claim-point-of-origin-code': 'Point of origin code',
};

// v2-0203 identifier types the 837 builder requires.
const IDENTIFIER_TYPE_LABELS: Record<string, string> = {
  NPI: 'NPI',
  NIIP: 'Payer ID',
  XV: 'Payer ID',
  SS: 'SSN',
  NE: 'Tax ID / EIN',
};

// Claim.careTeam roles (Oystehr rcm-claim-referring-provider-type codes).
const CARE_TEAM_ROLE_LABELS: Record<string, string> = {
  '82': 'Rendering provider',
  '85': 'Billing provider',
  DN: 'Referring provider',
  DK: 'Ordering provider',
  DQ: 'Supervising provider',
  '71': 'Attending provider',
  '72': 'Operating provider',
};

// Labels the 837 builder passes that are not FHIR paths.
const LITERAL_LABELS: Record<string, string> = {
  'Claim PCN': 'Patient control number',
  'params.action': 'Submission type',
  'params.payerClaimControlNumber': 'Payer Claim Control Number',
};

const INSURANCE_ORDINALS = ['Primary', 'Secondary', 'Tertiary'];

// Trailing elements that only say how the value is stored; the element before them names it.
const VALUE_ELEMENTS = new Set([
  'value',
  'valueString',
  'valueBoolean',
  'valueMoney',
  'valueReference',
  'reference',
  'coding',
  'start',
  'amount',
]);

// ---------------------------------------------------------------------------------------------------
// Path parsing
// ---------------------------------------------------------------------------------------------------

interface PathSegment {
  name: string;
  selectors: string[];
}

// Split "Claim.careTeam[Claim.item[0].careTeamSequence[0]].provider" into segments, keeping dots and
// brackets nested inside a selector (extension URLs, sub-paths) intact.
function parsePath(path: string): PathSegment[] | undefined {
  const rawSegments: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of path) {
    if (char === '[') depth++;
    if (char === ']') depth--;
    if (depth < 0) return undefined;
    if (char === '.' && depth === 0) {
      rawSegments.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (depth !== 0) return undefined;
  rawSegments.push(current);

  const segments: PathSegment[] = [];
  for (const raw of rawSegments) {
    const name = /^[A-Za-z]\w*/.exec(raw)?.[0];
    if (!name) return undefined;
    const selectors: string[] = [];
    let rest = raw.slice(name.length);
    while (rest.length > 0) {
      if (rest[0] !== '[') return undefined;
      let level = 0;
      let end = 0;
      for (; end < rest.length; end++) {
        if (rest[end] === '[') level++;
        if (rest[end] === ']') level--;
        if (level === 0) break;
      }
      selectors.push(rest.slice(1, end));
      rest = rest.slice(end + 1);
    }
    segments.push({ name, selectors });
  }
  return segments;
}

// 1-based position from "[sequence=N]" (already 1-based) or a "[N]" array index.
function position(segment: PathSegment): number | undefined {
  const selector = segment.selectors[0];
  if (selector === undefined) return undefined;
  const sequence = /^sequence=(\d+)$/.exec(selector);
  if (sequence) return Number(sequence[1]);
  if (/^\d+$/.test(selector)) return Number(selector) + 1;
  return undefined;
}

// "subscriberId" / "rcm-claim-some-thing" -> "Subscriber id" / "Some thing".
function humanize(name: string): string {
  const words = name
    .replace(/^rcm-(claim-(item-)?)?/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function extensionLabel(segment: PathSegment): string {
  const slug = segment.selectors[0]?.split('/').pop() ?? '';
  return EXTENSION_LABELS[slug] ?? humanize(slug || segment.name);
}

function identifierLabel(segment: PathSegment): string {
  const selector = segment.selectors[0] ?? '';
  const type = /,(\w+)\)$/.exec(selector)?.[1];
  if (type && IDENTIFIER_TYPE_LABELS[type]) return IDENTIFIER_TYPE_LABELS[type];
  if (/CLIA/i.test(selector)) return 'CLIA Number';
  return 'Identifier';
}

function careTeamLabel(segment: PathSegment): string {
  const selector = segment.selectors[0] ?? '';
  const role = /role=\([^,]*,(\w+)\)/.exec(selector)?.[1];
  if (role) return CARE_TEAM_ROLE_LABELS[role] ?? 'Care team provider';
  const item = /item\[(\d+)\]/.exec(selector)?.[1];
  if (item !== undefined) return `Service line ${Number(item) + 1} rendering provider`;
  return 'Care team provider';
}

// The label of a repeating element that identifies which entry of the claim is meant, if it is one.
function collectionLabel(segment: PathSegment): string | undefined {
  const index = position(segment);
  switch (segment.name) {
    case 'insurance':
      if (index === undefined) return 'Insurance';
      return index <= INSURANCE_ORDINALS.length ? `${INSURANCE_ORDINALS[index - 1]} insurance` : `Insurance ${index}`;
    case 'item':
      return index === undefined ? 'Service line' : `Service line ${index}`;
    case 'diagnosis':
      return index === undefined ? 'Diagnosis' : `Diagnosis ${index}`;
    case 'otherDiagnoses':
      return index === undefined ? 'Other diagnosis' : `Other diagnosis ${index}`;
    case 'procedure':
      return index === undefined ? 'Procedure' : `Procedure ${index}`;
    case 'modifier':
      return index === undefined ? 'Modifier' : `Modifier ${index}`;
    case 'careTeam':
      return careTeamLabel(segment);
    default:
      return undefined;
  }
}

function fieldLabel(segment: PathSegment, parent: PathSegment | undefined): string {
  if (segment.name === 'extension') return extensionLabel(segment);
  if (segment.name === 'identifier') return identifierLabel(segment);
  if (segment.name === 'telecom') return 'Phone number';
  if (segment.name === 'adjudication' && segment.selectors[0]) {
    return segment.selectors[0] === 'charge' ? 'Charged amount' : `${humanize(segment.selectors[0])} amount`;
  }
  if (segment.name === 'category' && segment.selectors[0]?.includes('PR')) return 'Patient responsibility';
  const nestedKey =
    segment.name === 'line' ? `line.${segment.selectors[0] ?? 0}` : parent ? `${parent.name}.${segment.name}` : '';
  return (
    NESTED_FIELD_LABELS[nestedKey] ?? collectionLabel(segment) ?? FIELD_LABELS[segment.name] ?? humanize(segment.name)
  );
}

// Claim.supportingInfo paths carry long category/code selectors (and an "&& [code=...]" suffix);
// describe them by what they are for.
function describeSupportingInfo(path: string): string {
  const isNote = /,NTE\)/.test(path);
  const context = isNote ? 'Claim note' : 'Claim attachment';
  const codeSuffixAt = path.lastIndexOf('&& [code=');
  let field: string;
  if (codeSuffixAt >= 0) {
    const codeSystem = path.slice(codeSuffixAt);
    if (codeSystem.includes('report-type')) field = 'Report type';
    else if (codeSystem.includes('transmission')) field = 'Transmission method';
    else field = 'Note type';
  } else if (path.endsWith('.valueString')) {
    field = isNote ? 'Note text' : 'Attachment control number';
  } else {
    field = 'Document';
  }
  return `${context}: ${field}`;
}

/**
 * The billing-app description of the value at a claim-service validation path, e.g.
 * "Claim.insurance[sequence=1].coverage.subscriberId" -> "Primary insurance: Member ID".
 * `allowRootless` accepts a path that starts below the Claim (the 837 builder reports some payer
 * identifiers that way).
 */
function describePath(path: string, allowRootless = false): string | undefined {
  if (LITERAL_LABELS[path]) return LITERAL_LABELS[path];
  if (path.startsWith('Claim.supportingInfo')) return describeSupportingInfo(path);

  const parsed = parsePath(path);
  if (!parsed || parsed.length === 0) return undefined;
  let segments: PathSegment[];
  let context: string | undefined;
  if (parsed[0].name === 'Claim' && parsed[0].selectors.length === 0) {
    segments = parsed.slice(1);
  } else if (parsed[0].name === 'ClaimResponse') {
    segments = parsed.slice(1);
    context = 'Prior payer response';
  } else if (allowRootless) {
    segments = parsed;
  } else {
    return undefined;
  }
  if (segments.length === 0) return context ?? 'Claim';

  // Drop storage-detail elements off the end ("...extension[x].valueString" is the extension), unless
  // the pair names the value itself ("class[0].value" is the group number).
  const isNamedPair = (list: PathSegment[]): boolean =>
    list.length > 1 && `${list[list.length - 2].name}.${list[list.length - 1].name}` in NESTED_FIELD_LABELS;
  while (segments.length > 1 && VALUE_ELEMENTS.has(segments[segments.length - 1].name) && !isNamedPair(segments)) {
    segments = segments.slice(0, -1);
  }

  // Walk down to the parent of the last element, narrowing the context at each claim entry or
  // referenced resource on the way.
  const last = segments[segments.length - 1];
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const next = segments[i + 1];
    const collection = collectionLabel(segment);
    if (collection) {
      context = context && segment.name === 'item' ? `${collection} (${context.toLowerCase()})` : collection;
      // "careTeam[...].provider" as the last element is the care-team member itself.
      if (segment.name === 'careTeam' && next === last && last.name === 'provider') return context;
      continue;
    }
    if (VALUE_ELEMENTS.has(segment.name)) continue;
    switch (segment.name) {
      case 'provider':
        context = context ? context : 'Billing provider';
        break;
      case 'facility':
        context = 'Service facility';
        break;
      case 'patient':
        context = 'Patient';
        break;
      case 'subscriber':
        context = context ? `${context} subscriber` : 'Subscriber';
        break;
      case 'payor':
        context = context ? `${context} payer` : 'Payer';
        break;
      case 'extension':
        context = context ? `${context} ${extensionLabel(segment).toLowerCase()}` : extensionLabel(segment);
        break;
      default:
        // coverage, name, address, class, ...: the next element says what is missing.
        break;
    }
  }

  const field = fieldLabel(last, segments[segments.length - 2]);
  return context ? `${context}: ${field}` : field;
}

// ---------------------------------------------------------------------------------------------------
// Message rules
// ---------------------------------------------------------------------------------------------------

type Rule = [pattern: RegExp, describe: (...groups: string[]) => string | undefined];

const withDescription =
  (format: (description: string, ...rest: string[]) => string) =>
  (path: string, ...rest: string[]): string | undefined => {
    const description = describePath(path);
    return description ? format(description, ...rest) : undefined;
  };

// A quoted validation path. Paths can contain quotes ('ClaimResponse.addItem.category["PR"]') and spaces
// ('productOrService[<HCPCS> || <CPT>]'), but never a quote followed by a space, which is where the
// quoted path ends.
const QUOTED_PATH = String.raw`"(Claim PCN|(?:Claim|params)(?:(?!" ).)*?)"`;

const RULES: Rule[] = [
  // validateDefined
  [new RegExp(`${QUOTED_PATH} is undefined`, 'g'), withDescription((d) => `${d} is missing`)],
  // X12 element length check
  [
    new RegExp(String.raw`${QUOTED_PATH} length must be in \[(\d+);(\d+)\] range but was "([^"]*)"`, 'g'),
    withDescription((d, min, max, value) =>
      value === ''
        ? `${d} is missing`
        : min === max
        ? `${d} must be exactly ${min} characters (got "${value}")`
        : `${d} must be ${min}-${max} characters (got "${value}")`
    ),
  ],
  // X12 element allowed-values check
  [
    new RegExp(String.raw`${QUOTED_PATH} value "([^"]*)" is not in the list of allowed values \[[^\]]*\]`, 'g'),
    withDescription((d, value) =>
      value === '' || value === 'undefined' ? `${d} is missing` : `${d} "${value}" is not a valid value`
    ),
  ],
  // Attachments and notes
  [
    /"([^"]+)" must be (?:defined|a valid `DocumentReference` reference) for (?:claim|user-managed) attachments/g,
    withDescription((d) => `${d} is missing or invalid`),
  ],
  // Payer / billing-provider identifiers: "<path> or <path> must be present"
  [
    /(\S+) or (\S+) must be present/g,
    (first: string, second: string) => {
      const a = describePath(first, true);
      const b = describePath(second, true);
      if (!a || !b) return undefined;
      if (a === b) return `${a} is missing`;
      const [context, fieldA] = a.includes(': ') ? a.split(': ') : ['', a];
      const fieldB = b.includes(': ') ? b.split(': ')[1] : b;
      return context ? `${context}: ${fieldA} or ${fieldB} is missing` : `${fieldA} or ${fieldB} is missing`;
    },
  ],
  [
    /(\S+) must have an ETIN identifier or resolve to a payer with an ID/g,
    withDescription((d) => `${d} has no Payer ID`),
  ],
  [/Malformed or missing reference at (\S+)/g, withDescription((d) => `${d} is missing`)],
  [
    /Resource referenced at (\S+) must be (\w+)/g,
    withDescription((d, type) => {
      const noun = humanize(type).toLowerCase();
      return `${d} must be ${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`;
    }),
  ],
  [
    /(\S+) could not be queried, ensure the reference is correct: (\S+)/g,
    withDescription((d) => `${d} could not be found; re-select it`),
  ],
  [/Contained resource \S+ referenced at (\S+) not found/g, withDescription((d) => `${d} could not be found`)],
  [/^Claim has no items with service dates$/g, () => 'No service line has a Date of Service'],
  [
    /^Unknown claim type "([^"]*)"$/g,
    (type: string) =>
      type === '' || type === 'undefined'
        ? 'Claim type is missing'
        : `Claim type "${type}" is not supported; it must be professional or institutional`,
  ],
];

/**
 * Rewrite the validation errors the Oystehr claim service returns while building an 837 into
 * biller-facing text. Text that isn't one of those errors is returned unchanged; when several errors
 * are joined into one message, each is rewritten in place.
 */
export function describeClaimSubmissionError(message: string): string {
  return RULES.reduce(
    (text, [pattern, describe]) =>
      // replace() passes (match, ...captures, offset, input); none of the rules has named groups.
      text.replace(pattern, (original: string, ...groups: unknown[]) => {
        const captures = groups.slice(0, -2) as string[];
        return describe(...captures) ?? original;
      }),
    message
  );
}
