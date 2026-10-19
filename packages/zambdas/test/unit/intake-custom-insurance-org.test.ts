import { Organization, Patient, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { COVERAGE_MEMBER_IDENTIFIER_BASE } from 'utils/lib/fhir/constants';
import { getCustomInsuranceOrgReferenceUrl } from 'utils/lib/helpers/helpers';
import {
  makePrepopulatedItemsFromPatientRecord,
  PrePopulationFromPatientRecordInput,
} from 'utils/lib/helpers/paperwork/prePopulation';
import { flattenItems } from 'utils/lib/helpers/paperwork/validation';
import { IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE } from 'utils/lib/ottehr-config/intake-paperwork';
import { INSURANCE_PAY_OPTION } from 'utils/lib/ottehr-config/value-sets';
import { CUSTOM_INSURANCE_ORG_ID_SYSTEM } from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { describe, expect, it } from 'vitest';
import { getCoverageResources } from '../../src/ehr/shared/harvest';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = getCustomInsuranceOrgReferenceUrl(ORG_ID);
const MEMBER_ID = 'MEMBER-42';

// What searchInsuranceInformation resolves the token into (see harvest-custom-insurance-org.test.ts).
const customOrg: Organization = {
  resourceType: 'Organization',
  id: ORG_ID,
  name: 'Acme Insurance',
  active: true,
  identifier: [{ system: CUSTOM_INSURANCE_ORG_ID_SYSTEM, value: 'OTR-ACME' }],
  type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/organization-type', code: 'pay' }] }],
};

const patient: Patient = {
  resourceType: 'Patient',
  id: '36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
  name: [{ given: ['Jane'], family: 'Doe' }],
  birthDate: '1990-01-01',
  gender: 'female',
  address: [{ line: ['1 Main St'], city: 'Springfield', state: 'IL', postalCode: '62701' }],
};

const answer = (linkId: string, value: QuestionnaireResponseItem['answer']): QuestionnaireResponseItem => ({
  linkId,
  answer: value,
});
const str = (linkId: string, valueString: string): QuestionnaireResponseItem => answer(linkId, [{ valueString }]);

// Paperwork as intake submits it after the patient picks the custom org option that
// get-all-insurance-payers offers (valueReference = the token).
const questionnaireResponse: QuestionnaireResponse = {
  resourceType: 'QuestionnaireResponse',
  status: 'completed',
  item: [
    {
      linkId: 'payment-option-page',
      item: [
        str('payment-option', INSURANCE_PAY_OPTION),
        answer('insurance-carrier', [{ valueReference: { reference: TOKEN, display: 'Acme Insurance' } }]),
        str('insurance-member-id', MEMBER_ID),
        str('policy-holder-first-name', 'Jane'),
        str('policy-holder-last-name', 'Doe'),
        str('policy-holder-date-of-birth', '1990-01-01'),
        str('policy-holder-birth-sex', 'Female'),
        answer('policy-holder-address-as-patient', [{ valueBoolean: true }]),
        str('patient-relationship-to-insured', 'Self'),
      ],
    },
  ],
};

describe('intake — custom insurance organization coverage round trip', () => {
  const { orderedCoverages } = getCoverageResources({
    questionnaireResponse,
    patient,
    organizationResources: [customOrg],
  });
  const coverage = orderedCoverages.primary!;

  it('harvests the selected custom org into a Coverage that references it by token', () => {
    expect(coverage).toBeDefined();
    expect(coverage.payor).toEqual([{ reference: TOKEN }]);
    // The "OTR-" business id stands in for the RCM payer id, as billing's own Coverage builder does.
    expect(coverage.class?.[0]).toMatchObject({ value: 'OTR-ACME', name: 'Acme Insurance' });
    expect(coverage.subscriberId).toBe(MEMBER_ID);
  });

  it('assigns the member id to the same token as the payor, never a direct Organization reference', () => {
    expect(coverage.identifier).toEqual([
      {
        ...COVERAGE_MEMBER_IDENTIFIER_BASE,
        value: MEMBER_ID,
        assigner: { reference: TOKEN, display: 'Acme Insurance' },
      },
    ]);
    expect(JSON.stringify(coverage)).not.toContain(`Organization/${ORG_ID}`);
  });

  it('prefills the next paperwork with the token and member id from the stored Coverage', () => {
    const items = makePrepopulatedItemsFromPatientRecord({
      patient,
      questionnaire: IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE(),
      coverages: { primary: { ...coverage, id: 'coverage-1' } },
      insuranceOrgs: [customOrg],
    } as unknown as PrePopulationFromPatientRecordInput);
    const flat = flattenItems(items) as QuestionnaireResponseItem[];
    const find = (linkId: string): QuestionnaireResponseItem | undefined => flat.find((i) => i.linkId === linkId);

    expect(find('insurance-carrier')?.answer?.[0]?.valueReference).toEqual({
      reference: TOKEN,
      display: 'Acme Insurance',
    });
    expect(find('insurance-member-id')?.answer?.[0]?.valueString).toBe(MEMBER_ID);
  });
});
