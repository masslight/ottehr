import Oystehr from '@oystehr/sdk';
import { Claim, Coverage, Location, Organization, Patient, Practitioner, RelatedPerson } from 'fhir/r4b';
import { getDefaultClaimSubmissionExtensions } from 'utils/lib/fhir/billing';
import {
  FHIR_IDENTIFIER_CLIA,
  FHIR_IDENTIFIER_CODE_TAX_EMPLOYER,
  FHIR_IDENTIFIER_CODE_TAXONOMY,
  FHIR_IDENTIFIER_NPI,
  FHIR_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/constants';
import {
  CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY,
  CODE_SYSTEM_CLAIM_SECONDARY_IDENTIFIER_TYPE,
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_ICD_10,
  CODE_SYSTEM_OYSTEHR_CLAIM_REFERRING_PROVIDER_TYPE,
  EXTENSION_CLAIM_INSURANCE_TYPE,
} from 'utils/lib/helpers/rcm/constants';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { AUTO_ACCIDENT_TAG_NAME } from 'utils/lib/types/data/billing/system-tags';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { performEffect } from '../../../src/billing/get-billing-claim-cms1500';
import { buildCms1500FormData, Cms1500Resources } from '../../../src/billing/get-billing-claim-cms1500/helpers';
import {
  CLAIM_PCN_IDENTIFIER_SYSTEM,
  ClaimGraph,
  fetchClaimGraph,
  resolvePayersByRef,
} from '../../../src/billing/shared';

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchClaimGraph: vi.fn(),
  resolvePayersByRef: vi.fn(),
}));

const PRIMARY_PAYER = 'https://payers.oystehr.com/payer/primary';
const SECONDARY_PAYER = 'https://payers.oystehr.com/payer/secondary';

const taxonomy = (code: string): NonNullable<Practitioner['identifier']>[number] => ({
  type: { coding: [{ system: CODE_SYSTEM_CLAIM_SECONDARY_IDENTIFIER_TYPE, code: FHIR_IDENTIFIER_CODE_TAXONOMY }] },
  value: code,
});

const claim: Claim = {
  resourceType: 'Claim',
  id: 'claim-1',
  status: 'draft',
  use: 'claim',
  created: '2026-09-02',
  type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: 'professional' }] },
  priority: { coding: [{ code: 'normal' }] },
  meta: { tag: [{ system: CLAIM_TAG_SYSTEM, code: AUTO_ACCIDENT_TAG_NAME }] },
  identifier: [{ system: CLAIM_PCN_IDENTIFIER_SYSTEM, value: 'PCN12345' }],
  extension: getDefaultClaimSubmissionExtensions(),
  patient: { reference: 'Patient/patient-1' },
  provider: { reference: 'Organization/billing-1' },
  facility: { reference: 'Location/facility-1' },
  insurer: { reference: PRIMARY_PAYER },
  insurance: [
    { sequence: 1, focal: true, coverage: { reference: 'Coverage/primary' }, preAuthRef: ['PA-42'] },
    { sequence: 2, focal: false, coverage: { reference: 'Coverage/secondary' } },
  ],
  careTeam: [
    {
      sequence: 1,
      provider: { reference: 'Practitioner/rendering-1' },
      role: { coding: [{ system: CODE_SYSTEM_OYSTEHR_CLAIM_REFERRING_PROVIDER_TYPE, code: '82' }] },
    },
  ],
  diagnosis: [
    { sequence: 2, diagnosisCodeableConcept: { coding: [{ system: CODE_SYSTEM_ICD_10, code: 'R05.9' }] } },
    { sequence: 1, diagnosisCodeableConcept: { coding: [{ system: CODE_SYSTEM_ICD_10, code: 'J06.9' }] } },
  ],
  supportingInfo: [
    {
      sequence: 1,
      category: { coding: [{ system: CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY, code: 'onset' }] },
      code: { coding: [{ code: '431' }] },
      timingDate: '2026-08-30',
    },
  ],
  item: [
    {
      sequence: 2,
      productOrService: { coding: [{ code: '87880' }] },
      servicedPeriod: { start: '2026-09-01' },
      locationCodeableConcept: { coding: [{ code: '20' }] },
      diagnosisSequence: [1],
      careTeamSequence: [1],
      net: { value: 35, currency: 'USD' },
      quantity: { value: 1 },
    },
    {
      sequence: 1,
      productOrService: { coding: [{ code: '99214' }] },
      modifier: [{ coding: [{ code: '25' }] }],
      servicedPeriod: { start: '2026-09-01', end: '2026-09-01' },
      locationCodeableConcept: { coding: [{ code: '20' }] },
      diagnosisSequence: [1, 2],
      careTeamSequence: [1],
      net: { value: 210, currency: 'USD' },
      quantity: { value: 1 },
    },
  ],
  total: { value: 245, currency: 'USD' },
};

const patient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  name: [{ family: 'Doe', given: ['Jane', 'Alice'] }],
  birthDate: '1990-04-02',
  gender: 'female',
  telecom: [{ system: 'phone', value: '(617) 555-1234' }],
  address: [{ line: ['12 Elm St'], city: 'Boston', state: 'MA', postalCode: '02110' }],
};

const primary: Coverage = {
  resourceType: 'Coverage',
  id: 'primary',
  status: 'active',
  beneficiary: { reference: 'Patient/patient-1' },
  subscriber: { reference: 'Patient/patient-1' },
  subscriberId: 'W123456789',
  relationship: { coding: [{ code: 'self' }] },
  payor: [{ reference: PRIMARY_PAYER }],
  class: [
    { type: { coding: [{ code: 'plan' }] }, value: '60054', name: 'Aetna' },
    { type: { coding: [{ code: 'group' }] }, value: 'GRP-100' },
  ],
  extension: [{ url: EXTENSION_CLAIM_INSURANCE_TYPE, valueString: '12' }],
};

const secondary: Coverage = {
  resourceType: 'Coverage',
  id: 'secondary',
  status: 'active',
  beneficiary: { reference: 'Patient/patient-1' },
  subscriber: { reference: 'RelatedPerson/spouse-1' },
  subscriberId: 'XYZ987',
  relationship: { coding: [{ code: 'spouse' }] },
  payor: [{ reference: SECONDARY_PAYER }],
};

const spouse: RelatedPerson = {
  resourceType: 'RelatedPerson',
  id: 'spouse-1',
  patient: { reference: 'Patient/patient-1' },
  name: [{ family: 'Doe', given: ['John'] }],
};

const billingProvider: Organization = {
  resourceType: 'Organization',
  id: 'billing-1',
  name: 'Ottehr Medical Group, P.C.',
  identifier: [
    { system: FHIR_IDENTIFIER_NPI, value: '1098765432' },
    {
      type: { coding: [{ system: FHIR_IDENTIFIER_SYSTEM, code: FHIR_IDENTIFIER_CODE_TAX_EMPLOYER }] },
      value: '12-3456789',
    },
    taxonomy('261QU0200X'),
  ],
  telecom: [{ system: 'phone', value: '617-555-0000' }],
  address: [{ line: ['1 Billing Way'], city: 'Boston', state: 'MA', postalCode: '02110' }],
};

const renderingProvider: Practitioner = {
  resourceType: 'Practitioner',
  id: 'rendering-1',
  name: [{ family: 'House', given: ['Gregory'] }],
  identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1987654329' }, taxonomy('207Q00000X')],
};

const facility: Location = {
  resourceType: 'Location',
  id: 'facility-1',
  name: 'Ottehr Urgent Care',
  identifier: [
    { system: FHIR_IDENTIFIER_NPI, value: '1122334455' },
    { system: FHIR_IDENTIFIER_CLIA, value: '12D3456789' },
  ],
  address: { line: ['500 Boylston St'], city: 'Boston', state: 'MA', postalCode: '02116' },
};

const graph: ClaimGraph = {
  claim,
  patient,
  billingProvider,
  serviceFacility: facility,
  coverages: [primary, secondary],
  renderingProvider,
  subscribers: [spouse],
  documentReferences: [],
};

const payers = new Map<string, Organization>([
  [
    PRIMARY_PAYER,
    {
      resourceType: 'Organization',
      name: 'Aetna',
      address: [{ line: ['PO Box 981106'], city: 'El Paso', state: 'TX', postalCode: '79998' }],
    },
  ],
  [SECONDARY_PAYER, { resourceType: 'Organization', name: 'Blue Cross Blue Shield' }],
]);

const resources = (overrides: Partial<Cms1500Resources> = {}): Cms1500Resources => ({ ...graph, payers, ...overrides });

describe('buildCms1500FormData', () => {
  it('maps the claim, patient, coverages and providers onto the form', () => {
    const form = buildCms1500FormData(resources());
    expect(form).toMatchObject({
      payer: { name: 'Aetna', address: { line1: 'PO Box 981106', city: 'El Paso', state: 'TX' } },
      insuranceType: 'group',
      insuredId: 'W123456789',
      patientName: { last: 'Doe', first: 'Jane', middle: 'Alice' },
      patientBirthDate: '1990-04-02',
      patientSex: 'F',
      patientPhone: '(617) 555-1234',
      patientRelationshipToInsured: 'self',
      // the patient is the insured on a "self" coverage
      insuredName: { last: 'Doe', first: 'Jane' },
      insuredAddress: { line1: '12 Elm St', city: 'Boston' },
      insuredPolicyGroupNumber: 'GRP-100',
      insuredPlanName: 'Aetna',
      anotherHealthBenefitPlan: true,
      otherInsuredName: { last: 'Doe', first: 'John' },
      otherInsuredPolicyOrGroupNumber: 'XYZ987',
      otherInsuredPlanName: 'Blue Cross Blue Shield',
      conditionRelatedTo: { employment: false, autoAccident: true, otherAccident: false },
      patientSignatureOnFile: true,
      insuredSignatureOnFile: true,
      currentIllnessDate: { date: '2026-08-30', qualifier: '431' },
      icdIndicator: '0',
      diagnosisCodes: ['J06.9', 'R05.9'],
      priorAuthorizationNumber: 'PA-42',
      federalTaxId: { value: '12-3456789', type: 'EIN' },
      patientAccountNumber: 'PCN12345',
      acceptAssignment: true,
      physicianSignature: 'SIGNATURE ON FILE',
      serviceFacility: { name: 'Ottehr Urgent Care', npi: '1122334455' },
      billingProvider: {
        name: 'Ottehr Medical Group, P.C.',
        phone: '617-555-0000',
        npi: '1098765432',
        otherId: 'ZZ261QU0200X',
      },
    });
  });

  it("takes the payer from the primary coverage when the claim's insurer did not resolve", () => {
    const unresolvedInsurer: Claim = { ...claim, insurer: { reference: 'https://payers.oystehr.com/payer/unknown' } };
    expect(buildCms1500FormData(resources({ claim: unresolvedInsurer })).payer?.name).toBe('Aetna');
  });

  it('orders service lines and resolves diagnosis pointers to diagnosis positions', () => {
    const [first, second] = buildCms1500FormData(resources()).serviceLines;
    expect(first).toMatchObject({
      procedureCode: '99214',
      modifiers: ['25'],
      diagnosisPointers: [1, 2],
      charges: 210,
      units: 1,
      placeOfService: '20',
      dateFrom: '2026-09-01',
      renderingProviderNpi: '1987654329',
      renderingProviderOtherIdQualifier: 'ZZ',
      renderingProviderOtherId: '207Q00000X',
    });
    expect(second).toMatchObject({ procedureCode: '87880', charges: 35 });
  });

  it('reports the rendering provider in 24J only when it differs from the billing provider', () => {
    const form = buildCms1500FormData(
      resources({ renderingProvider: { ...renderingProvider, identifier: billingProvider.identifier } })
    );
    expect(form.serviceLines[0].renderingProviderNpi).toBeUndefined();
    expect(form.serviceLines[0].renderingProviderOtherId).toBeUndefined();
  });

  it('falls back to the facility CLIA number in item 23 for lab claims without a prior authorization', () => {
    const withoutAuth: Claim = {
      ...claim,
      insurance: claim.insurance.map((entry) => ({ ...entry, preAuthRef: undefined })),
    };
    expect(buildCms1500FormData(resources({ claim: withoutAuth })).priorAuthorizationNumber).toBe('12D3456789');
    const noLab: Claim = { ...withoutAuth, item: claim.item?.filter((item) => item.sequence === 1) };
    expect(buildCms1500FormData(resources({ claim: noLab })).priorAuthorizationNumber).toBeUndefined();
  });

  it('treats only CPT 80047-89398 as lab procedures', () => {
    const cliaFor = (code: string): string | undefined =>
      buildCms1500FormData(
        resources({
          claim: {
            ...claim,
            insurance: claim.insurance.map((entry) => ({ ...entry, preAuthRef: undefined })),
            item: [{ sequence: 1, productOrService: { coding: [{ code }] } }],
          },
        })
      ).priorAuthorizationNumber;
    expect(['80047', '87880', '89398'].map(cliaFor)).toEqual(['12D3456789', '12D3456789', '12D3456789']);
    expect(['80046', '89399', '89999'].map(cliaFor)).toEqual([undefined, undefined, undefined]);
  });

  it('marks Medicare claims without a group number NONE in item 11', () => {
    const medicare: Coverage = {
      ...primary,
      class: [],
      extension: [{ url: EXTENSION_CLAIM_INSURANCE_TYPE, valueString: 'MB' }],
    };
    const form = buildCms1500FormData(resources({ coverages: [medicare] }));
    expect(form.insuranceType).toBe('medicare');
    expect(form.insuredPolicyGroupNumber).toBe('NONE');
    expect(form.anotherHealthBenefitPlan).toBe(false);
    expect(form.otherInsuredName).toBeUndefined();
  });

  it('reports an accident date in item 15 and workers comp coverage as employment related', () => {
    const accident: Claim = {
      ...claim,
      meta: {},
      accident: { date: '2026-08-29', type: { coding: [{ code: 'WPA' }] } },
    };
    const workersComp: Coverage = {
      ...primary,
      extension: [{ url: EXTENSION_CLAIM_INSURANCE_TYPE, valueString: 'WC' }],
    };
    const form = buildCms1500FormData(resources({ claim: accident, coverages: [workersComp] }));
    expect(form.insuranceType).toBe('other');
    expect(form.otherDate).toEqual({ date: '2026-08-29', qualifier: '439' });
    expect(form.conditionRelatedTo).toMatchObject({ employment: true, autoAccident: false, otherAccident: false });
  });
});

describe('get-billing-claim-cms1500 performEffect', () => {
  const oystehr = { fhir: { get: vi.fn() } } as unknown as Oystehr;

  beforeEach(() => {
    vi.clearAllMocks();
    (fetchClaimGraph as Mock<typeof fetchClaimGraph>).mockResolvedValue(graph);
    (resolvePayersByRef as Mock<typeof resolvePayersByRef>).mockResolvedValue(payers);
  });

  it('resolves the payers of every coverage', async () => {
    const form = await performEffect(oystehr, { claimId: 'claim-1', secrets: null });
    expect(resolvePayersByRef).toHaveBeenCalledWith(oystehr, [PRIMARY_PAYER, PRIMARY_PAYER, SECONDARY_PAYER]);
    expect(form.payer?.name).toBe('Aetna');
    expect(oystehr.fhir.get).not.toHaveBeenCalled();
  });

  it('fetches the referring provider named on the care team', async () => {
    const referred: Claim = {
      ...claim,
      careTeam: [
        ...(claim.careTeam ?? []),
        {
          sequence: 2,
          provider: { reference: 'Practitioner/referring-1' },
          role: { coding: [{ system: CODE_SYSTEM_OYSTEHR_CLAIM_REFERRING_PROVIDER_TYPE, code: 'DN' }] },
        },
      ],
    };
    (fetchClaimGraph as Mock<typeof fetchClaimGraph>).mockResolvedValue({ ...graph, claim: referred });
    (oystehr.fhir.get as Mock).mockResolvedValue({
      resourceType: 'Practitioner',
      id: 'referring-1',
      name: [{ family: 'Wilson', given: ['James'], suffix: ['MD'] }],
      identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1234567893' }],
    });
    const form = await performEffect(oystehr, { claimId: 'claim-1', secrets: null });
    expect(oystehr.fhir.get).toHaveBeenCalledWith({ resourceType: 'Practitioner', id: 'referring-1' });
    expect(form.referringProvider).toEqual({
      qualifier: 'DN',
      name: { last: 'Wilson', first: 'James', middle: undefined, suffix: 'MD' },
      credentials: 'MD',
      npi: '1234567893',
    });
  });

  it('refuses institutional claims', async () => {
    const institutional: Claim = {
      ...claim,
      type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: 'institutional' }] },
    };
    (fetchClaimGraph as Mock<typeof fetchClaimGraph>).mockResolvedValue({ ...graph, claim: institutional });
    await expect(performEffect(oystehr, { claimId: 'claim-1', secrets: null })).rejects.toMatchObject({
      message: expect.stringContaining('UB-04'),
    });
  });
});
