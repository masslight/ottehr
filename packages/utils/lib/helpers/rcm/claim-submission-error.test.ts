import { Claim } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { claimSubmissionErrorNeedsClaim, describeClaimSubmissionError } from './claim-submission-error';

// Messages and paths as the Oystehr 837 builder produces them
// (zapehr project-api/src/functions/rcm/x12-fhir, validateDefined in project-api/src/lib/common.ts).
const EXT = 'https://extensions.fhir.oystehr.com';
const CODES = 'https://terminology.zapehr.com/CodeSystem';
const ID_TYPE = 'http://terminology.hl7.org/CodeSystem/v2-0203';
const undefinedAt = (path: string): string => `"${path}" is undefined`;

// A claim whose entries line up with their positions, so the table below reads naturally; the
// 'resolves entries against the claim' tests cover claims where they don't.
const CLAIM: Claim = {
  resourceType: 'Claim',
  status: 'active',
  type: {},
  use: 'claim',
  patient: {},
  created: '2026-01-01',
  provider: {},
  priority: {},
  insurance: [1, 2, 3, 4].map((sequence) => ({
    sequence,
    focal: sequence === 1,
    coverage: { reference: `Coverage/cov${sequence}` },
  })),
  item: [1, 2, 3].map((sequence) => ({ sequence, productOrService: {} })),
  diagnosis: [{ sequence: 1, diagnosisCodeableConcept: { coding: [{ code: 'J06.9' }] } }],
};
const describeWithClaim = (message: string): string => describeClaimSubmissionError(message, CLAIM);

describe('describeClaimSubmissionError', () => {
  describe('missing values ("<path>" is undefined)', () => {
    it.each([
      // Insurance
      [
        `Claim.insurance[sequence=1].coverage.extension[${EXT}/rcm-claim-insurance-type]`,
        'Primary insurance: Plan Type',
      ],
      [`Claim.insurance[0].coverage.extension[${EXT}/rcm-claim-insurance-type]`, 'Primary insurance: Plan Type'],
      ['Claim.insurance[sequence=2].coverage', 'Secondary insurance: Coverage'],
      ['Claim.insurance[sequence=3]', 'Tertiary insurance'],
      ['Claim.insurance[sequence=4].coverage', 'Insurance 4: Coverage'],
      ['Claim.insurance[sequence=1].coverage.subscriberId', 'Primary insurance: Member ID'],
      ['Claim.insurance[sequence=1].coverage.subscriber', 'Primary insurance: Subscriber'],
      ['Claim.insurance[sequence=2].coverage.class[0].value', 'Secondary insurance: Group Number'],
      ['Claim.insurance[sequence=2].coverage.class[0].name', 'Secondary insurance: Group name'],
      ['Claim.insurance[sequence=1].coverage.payor[0].reference', 'Primary insurance: Payer'],
      [
        'Claim.insurance[sequence=1].coverage.relationship.coding[http://terminology.hl7.org/CodeSystem/subscriber-relationship]',
        'Primary insurance: Relationship to insured',
      ],
      ['Claim.insurance[sequence=1].coverage.subscriber.birthDate', 'Primary insurance subscriber: Date of Birth'],
      [
        'Claim.insurance[sequence=1].coverage.subscriber.address[0].line[0]',
        'Primary insurance subscriber: Address Line 1',
      ],
      ['Claim.insurance[sequence=1].coverage.payor[0].address[0].city', 'Primary insurance payer: City'],
      ['Claim.insurance.coverage.payor', 'Insurance: Payer'],
      // Billing provider, facility, patient
      ['Claim.provider', 'Billing provider'],
      ['Claim.provider.name', 'Billing provider: Name'],
      ['Claim.provider.name[official].family', 'Billing provider: Last name'],
      ['Claim.provider.name[official].given[0]', 'Billing provider: First name'],
      [`Claim.provider.identifier[type=(${ID_TYPE},NPI)]`, 'Billing provider: NPI'],
      ['Claim.provider.telecom[system=phone]', 'Billing provider: Phone number'],
      ['Claim.provider.address[0].postalCode', 'Billing provider: ZIP'],
      ['Claim.facility.address[0].state', 'Service facility: State'],
      [
        'Claim.facility.identifier[system=http://terminology.hl7.org/NamingSystem/CLIA]',
        'Service facility: CLIA Number',
      ],
      ['Claim.patient.birthDate', 'Patient: Date of Birth'],
      ['Claim.patient.address[0].line[1]', 'Patient: Address Line 2'],
      // Care team
      [`Claim.careTeam[role=(${CODES}/rcm-claim-referring-provider-type,DN)].provider`, 'Referring provider'],
      [
        `Claim.careTeam[role=(${CODES}/rcm-claim-referring-provider-type,DQ)].provider.identifier[type=(${ID_TYPE},NPI)]`,
        'Supervising provider: NPI',
      ],
      ['Claim.careTeam[Claim.item[0].careTeamSequence[0]].provider', 'Service line 1 rendering provider'],
      [
        'Claim.careTeam[Claim.item[1].careTeamSequence[0]].provider.name[official].family',
        'Service line 2 rendering provider: Last name',
      ],
      // Service lines
      ['Claim.item[0].servicedPeriod', 'Service line 1: Date of Service'],
      ['Claim.item[2].servicedPeriod.start', 'Service line 3: Date of Service'],
      ['Claim.item[0].net.value', 'Service line 1: Charges'],
      ['Claim.item[0].quantity.value', 'Service line 1: Units'],
      ['Claim.item[1].diagnosisSequence', 'Service line 2: Diagnosis pointer'],
      [
        'Claim.item[0].productOrService[http://terminology.hl7.org/CodeSystem/HCPCS || http://www.ama-assn.org/go/cpt]',
        'Service line 1: CPT/HCPCS',
      ],
      [
        'Claim.item[0].locationCodeableConcept[https://www.cms.gov/Medicare/Coding/place-of-service-codes/Place_of_Service_Code_Set]',
        'Service line 1: Place of Service',
      ],
      [`Claim.item[0].modifier[1][${CODES}/rcm-claim-procedure-modifier]`, 'Service line 1: Modifier 2'],
      [
        `Claim.item[0].extension[${EXT}/rcm-claim-item-ordering-provider].valueReference`,
        'Service line 1: Ordering provider',
      ],
      [
        `Claim.item[0].extension[${EXT}/rcm-claim-item-ordering-provider].valueReference.identifier[type=(${ID_TYPE},NPI)]`,
        'Service line 1 ordering provider: NPI',
      ],
      // Claim level
      ['Claim.diagnosis[0]', 'Diagnosis J06.9'],
      ['Claim.otherDiagnoses[2]', 'Other diagnosis at position 3'],
      ['Claim.billablePeriod.start', 'Billing period'],
      ['Claim.total.value', 'Total charges'],
      ['Claim.id', 'Claim ID'],
      ['Claim PCN', 'Patient control number'],
      [`Claim.extension[${EXT}/rcm-claim-release-of-information-code].valueString`, 'Release of information code'],
      [`Claim.extension[${EXT}/rcm-claim-provider-signature-indicator].valueBoolean`, 'Provider signature indicator'],
      [`Claim.extension[${EXT}/rcm-claim-auto-accident-state]`, 'Accident State'],
      [`Claim.extension[${EXT}/rcm-claim-some-new-thing]`, 'Some new thing'],
      // Prior payer's response (secondary claims)
      ['ClaimResponse.addItem.category["PR"]', 'Prior payer response: Patient responsibility'],
      ['ClaimResponse.item[0].adjudication[charge]', 'Prior payer response, item at position 1: Charged amount'],
      ['ClaimResponse.item[0].adjudication[paid]', 'Prior payer response, item at position 1: Paid amount'],
    ])('%s', (path, expected) => {
      expect(describeWithClaim(undefinedAt(path))).toBe(`${expected} is missing`);
    });
  });

  it('describes an X12 element length violation', () => {
    expect(
      describeWithClaim(
        `"Claim.provider.identifier[type=(${ID_TYPE},NPI)]" length must be in [2;80] range but was "123456789012345678901234567890123456789012345678901234567890123456789012345678901"`
      )
    ).toMatch(/^Billing provider: NPI must be 2-80 characters \(got "/);
    expect(describeWithClaim('"Claim.patient.address[0].state" length must be in [2;2] range but was "Ohio"')).toBe(
      'Patient: State must be exactly 2 characters (got "Ohio")'
    );
    expect(describeWithClaim('"Claim.patient.address[0].city" length must be in [2;30] range but was ""')).toBe(
      'Patient: City is missing'
    );
  });

  it('describes an X12 element allowed-values violation', () => {
    expect(
      describeWithClaim(
        `"Claim.insurance[sequence=1].coverage.extension[${EXT}/rcm-claim-insurance-type]" value "ZZ" is not in the list of allowed values [11,12,13]`
      )
    ).toBe('Primary insurance: Plan Type "ZZ" is not a valid value');
    expect(describeWithClaim('"params.action" value "undefined" is not in the list of allowed values [1,7,8]')).toBe(
      'Submission type is missing'
    );
  });

  it('describes a missing payer ID', () => {
    const payor = 'Claim.insurance[sequence=1].coverage.payor[0]';
    expect(
      describeWithClaim(
        `${payor}.identifier[type=(${ID_TYPE},NIIP)] or ${payor}.identifier[type=(${ID_TYPE},XV)] must be present`
      )
    ).toBe('Primary insurance payer: Payer ID is missing');
    expect(
      describeWithClaim(`identifier[type=(${ID_TYPE},NIIP)] or identifier[type=(${ID_TYPE},XV)] must be present`)
    ).toBe('Payer ID is missing');
    expect(describeWithClaim(`${payor} must have an ETIN identifier or resolve to a payer with an ID`)).toBe(
      'Primary insurance: Payer has no Payer ID'
    );
  });

  it("describes a billing provider's missing tax ID", () => {
    expect(
      describeWithClaim(
        `Claim.provider.identifier[type=(${ID_TYPE},SS)] or Claim.provider.identifier[type=(${ID_TYPE},NE)] must be present`
      )
    ).toBe('Billing provider: SSN or Tax ID / EIN is missing');
  });

  it('describes reference problems', () => {
    expect(describeWithClaim('Malformed or missing reference at Claim.facility')).toBe('Service facility is missing');
    expect(
      describeWithClaim(
        'Claim.insurance[sequence=2].coverage.payor[0] could not be queried, ensure the reference is correct: Organization/abc'
      )
    ).toBe('Secondary insurance: Payer could not be found; re-select it');
    expect(describeWithClaim('Resource referenced at Claim.provider must be Organization')).toBe(
      'Billing provider must be an organization'
    );
  });

  it('describes attachment and note problems', () => {
    const pwk =
      `Claim.supportingInfo[category=(http://terminology.hl7.org/CodeSystem/claiminformationcategory,info) && ` +
      `code=(${CODES}/rcm-claim-additional-info-type,PWK)]`;
    const nte =
      `Claim.supportingInfo[category=(http://terminology.hl7.org/CodeSystem/claiminformationcategory,info) && ` +
      `code=(${CODES}/rcm-claim-additional-info-type,NTE)]`;
    expect(
      describeWithClaim(
        `"${pwk} && [code=${CODES}/rcm-claim-attachment-report-type-code]" must be defined for user-managed attachments`
      )
    ).toBe('Claim attachment: Report type is missing or invalid');
    expect(describeWithClaim(`"${pwk}.valueString" must be defined for user-managed attachments`)).toBe(
      'Claim attachment: Attachment control number is missing or invalid'
    );
    expect(describeWithClaim(`"${nte}.valueString" must be defined for user-managed attachments`)).toBe(
      'Claim note: Note text is missing or invalid'
    );
    expect(
      describeWithClaim(
        '"Claim.supportingInfo.valueReference" must be a valid `DocumentReference` reference for claim attachments'
      )
    ).toBe('Claim attachment: Document is missing or invalid');
  });

  it('describes claim-level failures', () => {
    expect(describeWithClaim('Claim has no items with service dates')).toBe('No service line has a Date of Service');
    expect(describeWithClaim('Unknown claim type "undefined"')).toBe('Claim type is missing');
    expect(describeWithClaim('Unknown claim type "oral"')).toBe(
      'Claim type "oral" is not supported; it must be professional or institutional'
    );
  });

  it('rewrites every error in a joined list and keeps the surrounding text', () => {
    expect(
      describeWithClaim(
        `${undefinedAt(
          `Claim.insurance[sequence=1].coverage.extension[${EXT}/rcm-claim-insurance-type]`
        )}, Duplicate diagnosis code`
      )
    ).toBe('Primary insurance: Plan Type is missing, Duplicate diagnosis code');
  });

  describe('resolves entries against the claim', () => {
    it('names the focal insurance primary whatever its sequence', () => {
      const claim: Claim = {
        ...CLAIM,
        insurance: [
          { sequence: 1, focal: false, coverage: { reference: 'Coverage/b' } },
          { sequence: 2, focal: true, coverage: { reference: 'Coverage/a' } },
        ],
      };
      expect(describeClaimSubmissionError(undefinedAt('Claim.insurance[sequence=2].coverage'), claim)).toBe(
        'Primary insurance: Coverage is missing'
      );
      expect(describeClaimSubmissionError(undefinedAt('Claim.insurance[0].coverage'), claim)).toBe(
        'Secondary insurance: Coverage is missing'
      );
    });

    it('ranks insurances among the entries the claim screen shows', () => {
      // The focal entry has no Coverage reference, so the screen shows sequence 2 as the primary insurance.
      const claim: Claim = {
        ...CLAIM,
        insurance: [
          { sequence: 1, focal: true, coverage: { identifier: { system: 'no-coverage' } } },
          { sequence: 2, focal: false, coverage: { reference: 'Coverage/b' } },
        ],
      };
      const plan = (selector: string): string =>
        undefinedAt(`Claim.insurance[${selector}].coverage.extension[${EXT}/rcm-claim-insurance-type]`);
      expect(describeClaimSubmissionError(plan('sequence=2'), claim)).toBe('Primary insurance: Plan Type is missing');
      // An entry the screen doesn't show keeps its raw selector.
      expect(describeClaimSubmissionError(plan('sequence=1'), claim)).toBe(
        'Insurance with sequence 1: Plan Type is missing'
      );
      expect(describeClaimSubmissionError(plan('0'), claim)).toBe('Insurance at position 1: Plan Type is missing');
    });

    it('numbers service lines by their sequence, as the claim screens do', () => {
      const claim: Claim = { ...CLAIM, item: [7, 3].map((sequence) => ({ sequence, productOrService: {} })) };
      expect(describeClaimSubmissionError(undefinedAt('Claim.item[0].net.value'), claim)).toBe(
        'Service line 7: Charges is missing'
      );
      expect(
        describeClaimSubmissionError(undefinedAt('Claim.careTeam[Claim.item[1].careTeamSequence[0]].provider'), claim)
      ).toBe('Service line 3 rendering provider is missing');
    });

    it('labels an entry the claim does not have by its raw selector', () => {
      expect(describeClaimSubmissionError(undefinedAt('Claim.insurance[sequence=5]'), CLAIM)).toBe(
        'Insurance with sequence 5 is missing'
      );
      expect(describeClaimSubmissionError(undefinedAt('Claim.item[9].net.value'), CLAIM)).toBe(
        'Service line at position 10: Charges is missing'
      );
    });
  });

  it('labels entries by raw sequence or position when the claim is unavailable', () => {
    expect(
      describeClaimSubmissionError(
        undefinedAt(`Claim.insurance[sequence=1].coverage.extension[${EXT}/rcm-claim-insurance-type]`)
      )
    ).toBe('Insurance with sequence 1: Plan Type is missing');
    expect(describeClaimSubmissionError(undefinedAt('Claim.insurance[0].coverage'))).toBe(
      'Insurance at position 1: Coverage is missing'
    );
    expect(describeClaimSubmissionError(undefinedAt('Claim.item[0].net.value'))).toBe(
      'Service line at position 1: Charges is missing'
    );
    expect(describeClaimSubmissionError(undefinedAt('Claim.item[sequence=4].net.value'))).toBe(
      'Service line 4: Charges is missing'
    );
    expect(
      describeClaimSubmissionError(undefinedAt('Claim.careTeam[Claim.item[1].careTeamSequence[0]].provider'))
    ).toBe('Service line at position 2 rendering provider is missing');
    expect(describeClaimSubmissionError(undefinedAt('Claim.diagnosis[0]'))).toBe('Diagnosis at position 1 is missing');
  });

  it('rewrites claim-level errors inside a joined list or a longer message', () => {
    expect(
      describeWithClaim('Unknown claim type "oral", Claim has no items with service dates, Duplicate diagnosis code')
    ).toBe(
      'Claim type "oral" is not supported; it must be professional or institutional, ' +
        'No service line has a Date of Service, Duplicate diagnosis code'
    );
    expect(describeWithClaim('Rule "Submit" failed: Claim has no items with service dates')).toBe(
      'Rule "Submit" failed: No service line has a Date of Service'
    );
  });

  it('leaves "<x> or <y> must be present" errors alone unless they name claim or payer-ID paths', () => {
    for (const message of [
      'username or password must be present',
      'Authorization or apiKey must be present',
      `identifier[type=(${ID_TYPE},NPI)] or identifier[type=(${ID_TYPE},XV)] must be present`,
      'identifier[type=(http://example.com/other,NIIP)] or identifier[type=(http://example.com/other,XV)] must be present',
      `Patient.identifier[type=(${ID_TYPE},NIIP)] or Patient.identifier[type=(${ID_TYPE},XV)] must be present`,
    ]) {
      expect(describeClaimSubmissionError(message, CLAIM)).toBe(message);
    }
  });

  it('returns other messages unchanged', () => {
    expect(describeWithClaim('Duplicate diagnosis code J06.9')).toBe('Duplicate diagnosis code J06.9');
    expect(describeWithClaim(undefinedAt('Patient.name'))).toBe(undefinedAt('Patient.name'));
    expect(describeWithClaim(undefinedAt('Claim.item[0'))).toBe(undefinedAt('Claim.item[0'));
    expect(
      describeWithClaim(
        'Only claims with status "draft" or "active" can be submitted. Received claim status "cancelled"'
      )
    ).toBe('Only claims with status "draft" or "active" can be submitted. Received claim status "cancelled"');
  });

  describe('claimSubmissionErrorNeedsClaim', () => {
    it.each([
      undefinedAt('Claim.insurance[sequence=1].coverage'),
      undefinedAt('Claim.item[0].net.value'),
      undefinedAt('Claim.diagnosis[sequence=1]'),
      undefinedAt('Claim.careTeam[Claim.item[1].careTeamSequence[0]].provider'),
      `Duplicate code, ${undefinedAt('Claim.insurance[0].coverage')}`,
    ])('needs the claim to describe %s', (message) => {
      expect(claimSubmissionErrorNeedsClaim(message)).toBe(true);
    });

    it.each([
      'Duplicate diagnosis code',
      'Rule "Submit" failed: payer is on hold',
      'Claim has no items with service dates',
      undefinedAt('Claim.patient.birthDate'),
      // Service lines named by sequence read the same with or without the claim.
      undefinedAt('Claim.item[sequence=2].net.value'),
    ])('does not need the claim to describe %s', (message) => {
      expect(claimSubmissionErrorNeedsClaim(message)).toBe(false);
    });
  });
});
