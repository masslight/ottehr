import { describe, expect, it } from 'vitest';
import { describeClaimSubmissionError } from './claim-submission-error';

// Messages and paths as the Oystehr 837 builder produces them
// (zapehr project-api/src/functions/rcm/x12-fhir, validateDefined in project-api/src/lib/common.ts).
const EXT = 'https://extensions.fhir.oystehr.com';
const CODES = 'https://terminology.zapehr.com/CodeSystem';
const ID_TYPE = 'http://terminology.hl7.org/CodeSystem/v2-0203';
const undefinedAt = (path: string): string => `"${path}" is undefined`;

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
      ['Claim.diagnosis[0]', 'Diagnosis 1'],
      ['Claim.otherDiagnoses[2]', 'Other diagnosis 3'],
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
      ['ClaimResponse.item[0].adjudication[charge]', 'Service line 1 (prior payer response): Charged amount'],
      ['ClaimResponse.item[0].adjudication[paid]', 'Service line 1 (prior payer response): Paid amount'],
    ])('%s', (path, expected) => {
      expect(describeClaimSubmissionError(undefinedAt(path))).toBe(`${expected} is missing`);
    });
  });

  it('describes an X12 element length violation', () => {
    expect(
      describeClaimSubmissionError(
        `"Claim.provider.identifier[type=(${ID_TYPE},NPI)]" length must be in [2;80] range but was "123456789012345678901234567890123456789012345678901234567890123456789012345678901"`
      )
    ).toMatch(/^Billing provider: NPI must be 2-80 characters \(got "/);
    expect(
      describeClaimSubmissionError('"Claim.patient.address[0].state" length must be in [2;2] range but was "Ohio"')
    ).toBe('Patient: State must be exactly 2 characters (got "Ohio")');
    expect(
      describeClaimSubmissionError('"Claim.patient.address[0].city" length must be in [2;30] range but was ""')
    ).toBe('Patient: City is missing');
  });

  it('describes an X12 element allowed-values violation', () => {
    expect(
      describeClaimSubmissionError(
        `"Claim.insurance[sequence=1].coverage.extension[${EXT}/rcm-claim-insurance-type]" value "ZZ" is not in the list of allowed values [11,12,13]`
      )
    ).toBe('Primary insurance: Plan Type "ZZ" is not a valid value');
    expect(
      describeClaimSubmissionError('"params.action" value "undefined" is not in the list of allowed values [1,7,8]')
    ).toBe('Submission type is missing');
  });

  it('describes a missing payer ID', () => {
    const payor = 'Claim.insurance[sequence=1].coverage.payor[0]';
    expect(
      describeClaimSubmissionError(
        `${payor}.identifier[type=(${ID_TYPE},NIIP)] or ${payor}.identifier[type=(${ID_TYPE},XV)] must be present`
      )
    ).toBe('Primary insurance payer: Payer ID is missing');
    expect(
      describeClaimSubmissionError(
        `identifier[type=(${ID_TYPE},NIIP)] or identifier[type=(${ID_TYPE},XV)] must be present`
      )
    ).toBe('Payer ID is missing');
    expect(describeClaimSubmissionError(`${payor} must have an ETIN identifier or resolve to a payer with an ID`)).toBe(
      'Primary insurance: Payer has no Payer ID'
    );
  });

  it("describes a billing provider's missing tax ID", () => {
    expect(
      describeClaimSubmissionError(
        `Claim.provider.identifier[type=(${ID_TYPE},SS)] or Claim.provider.identifier[type=(${ID_TYPE},NE)] must be present`
      )
    ).toBe('Billing provider: SSN or Tax ID / EIN is missing');
  });

  it('describes reference problems', () => {
    expect(describeClaimSubmissionError('Malformed or missing reference at Claim.facility')).toBe(
      'Service facility is missing'
    );
    expect(
      describeClaimSubmissionError(
        'Claim.insurance[sequence=2].coverage.payor[0] could not be queried, ensure the reference is correct: Organization/abc'
      )
    ).toBe('Secondary insurance: Payer could not be found; re-select it');
    expect(describeClaimSubmissionError('Resource referenced at Claim.provider must be Organization')).toBe(
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
      describeClaimSubmissionError(
        `"${pwk} && [code=${CODES}/rcm-claim-attachment-report-type-code]" must be defined for user-managed attachments`
      )
    ).toBe('Claim attachment: Report type is missing or invalid');
    expect(describeClaimSubmissionError(`"${pwk}.valueString" must be defined for user-managed attachments`)).toBe(
      'Claim attachment: Attachment control number is missing or invalid'
    );
    expect(describeClaimSubmissionError(`"${nte}.valueString" must be defined for user-managed attachments`)).toBe(
      'Claim note: Note text is missing or invalid'
    );
    expect(
      describeClaimSubmissionError(
        '"Claim.supportingInfo.valueReference" must be a valid `DocumentReference` reference for claim attachments'
      )
    ).toBe('Claim attachment: Document is missing or invalid');
  });

  it('describes claim-level failures', () => {
    expect(describeClaimSubmissionError('Claim has no items with service dates')).toBe(
      'No service line has a Date of Service'
    );
    expect(describeClaimSubmissionError('Unknown claim type "undefined"')).toBe('Claim type is missing');
    expect(describeClaimSubmissionError('Unknown claim type "oral"')).toBe(
      'Claim type "oral" is not supported; it must be professional or institutional'
    );
  });

  it('rewrites every error in a joined list and keeps the surrounding text', () => {
    expect(
      describeClaimSubmissionError(
        `${undefinedAt(
          `Claim.insurance[sequence=1].coverage.extension[${EXT}/rcm-claim-insurance-type]`
        )}, Duplicate diagnosis code`
      )
    ).toBe('Primary insurance: Plan Type is missing, Duplicate diagnosis code');
  });

  it('returns other messages unchanged', () => {
    expect(describeClaimSubmissionError('Duplicate diagnosis code J06.9')).toBe('Duplicate diagnosis code J06.9');
    expect(describeClaimSubmissionError(undefinedAt('Patient.name'))).toBe(undefinedAt('Patient.name'));
    expect(describeClaimSubmissionError(undefinedAt('Claim.item[0'))).toBe(undefinedAt('Claim.item[0'));
    expect(
      describeClaimSubmissionError(
        'Only claims with status "draft" or "active" can be submitted. Received claim status "cancelled"'
      )
    ).toBe('Only claims with status "draft" or "active" can be submitted. Received claim status "cancelled"');
  });
});
