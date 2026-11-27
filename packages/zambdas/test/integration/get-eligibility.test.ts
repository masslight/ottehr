import Oystehr from '@oystehr/sdk';
import {
  Account,
  Appointment,
  Coverage,
  CoverageEligibilityRequest,
  CoverageEligibilityResponse,
  FhirResource,
  Location,
  Patient,
  Person,
  QuestionnaireResponseItem,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType, userMe } from 'utils/lib/auth/user-me.helper';
import {
  PATIENT_BILLING_ACCOUNT_TYPE,
  PRIVATE_EXTENSION_BASE_URL,
  TIMEZONE_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { getPayerUrl } from 'utils/lib/helpers/helpers';
import { INSURANCE_COVERAGE_CODING } from 'utils/lib/telemed/constants';
import { InsuranceEligibilityCheckStatus } from 'utils/lib/types/data/paperwork/paperwork.types';
import { GetEligibilityResponse } from 'utils/lib/types/data/telemed/eligibility.types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import { index } from '../../src/patient/get-eligibility/index';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const LOCATION_TIMEZONE = 'America/New_York';
const PAYER_URL = getPayerUrl('60054');

interface InsuredVisit {
  patient: Patient;
  appointment: Appointment;
  coverage: Coverage;
}

const createInsuredVisit = async (
  oystehr: Oystehr,
  processId: string,
  { callerPhone, visitStart }: { callerPhone: string; visitStart: DateTime }
): Promise<InsuredVisit> => {
  const tag = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;
  const bundle = await oystehr.fhir.transaction<FhirResource>({
    requests: [
      {
        method: 'POST',
        url: '/Location',
        fullUrl: 'urn:uuid:location',
        resource: tag<Location>({
          resourceType: 'Location',
          status: 'active',
          name: 'Eligibility Test Clinic',
          extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: LOCATION_TIMEZONE }],
        }),
      },
      {
        method: 'POST',
        url: '/Patient',
        fullUrl: 'urn:uuid:patient',
        resource: tag<Patient>({
          resourceType: 'Patient',
          active: true,
          name: [{ given: ['Arya'], family: 'Stark' }],
          birthDate: '2010-04-04',
          gender: 'female',
        }),
      },
      {
        method: 'POST',
        url: '/Appointment',
        resource: tag<Appointment>({
          resourceType: 'Appointment',
          status: 'fulfilled',
          start: visitStart.toISO()!,
          end: visitStart.plus({ minutes: 15 }).toISO()!,
          participant: [
            { actor: { reference: 'urn:uuid:patient' }, status: 'accepted' },
            { actor: { reference: 'urn:uuid:location' }, status: 'accepted' },
          ],
        }),
      },
      {
        method: 'POST',
        url: '/Coverage',
        fullUrl: 'urn:uuid:coverage',
        resource: tag<Coverage>({
          resourceType: 'Coverage',
          status: 'active',
          type: { coding: [INSURANCE_COVERAGE_CODING] },
          subscriberId: 'W123456789',
          subscriber: { reference: 'urn:uuid:patient' },
          beneficiary: { reference: 'urn:uuid:patient' },
          relationship: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship', code: 'self' }],
          },
          payor: [{ reference: PAYER_URL }],
          order: 1,
        }),
      },
      {
        method: 'POST',
        url: '/Account',
        resource: tag<Account>({
          resourceType: 'Account',
          status: 'active',
          type: PATIENT_BILLING_ACCOUNT_TYPE,
          subject: [{ reference: 'urn:uuid:patient' }],
          coverage: [{ coverage: { reference: 'urn:uuid:coverage' }, priority: 1 }],
          guarantor: [{ party: { reference: 'urn:uuid:patient' } }],
        }),
      },
      {
        method: 'POST',
        url: '/RelatedPerson',
        fullUrl: 'urn:uuid:user-related-person',
        resource: tag<RelatedPerson>({
          resourceType: 'RelatedPerson',
          patient: { reference: 'urn:uuid:patient' },
          relationship: [
            { coding: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`, code: 'user-relatedperson' }] },
          ],
          telecom: [{ system: 'phone', value: callerPhone }],
        }),
      },
      {
        method: 'POST',
        url: '/Person',
        resource: tag<Person>({
          resourceType: 'Person',
          telecom: [{ system: 'phone', value: callerPhone }],
          link: [{ target: { reference: 'urn:uuid:user-related-person' } }],
        }),
      },
    ],
  });
  const resources = bundle.entry!.map((entry) => entry.resource!);
  return {
    patient: resources.find((r): r is Patient => r.resourceType === 'Patient')!,
    appointment: resources.find((r): r is Appointment => r.resourceType === 'Appointment')!,
    coverage: resources.find((r): r is Coverage => r.resourceType === 'Coverage')!,
  };
};

const findEligibilityRequests = async (oystehr: Oystehr, patientId: string): Promise<CoverageEligibilityRequest[]> =>
  (
    await oystehr.fhir.search<CoverageEligibilityRequest>({
      resourceType: 'CoverageEligibilityRequest',
      params: [{ name: 'patient', value: `Patient/${patientId}` }],
    })
  ).unbundle();

const activeCoverageResponse = (patientId: string, created: string): CoverageEligibilityResponse => ({
  resourceType: 'CoverageEligibilityResponse',
  status: 'active',
  purpose: ['benefits'],
  outcome: 'complete',
  created,
  patient: { reference: `Patient/${patientId}` },
  request: { reference: 'CoverageEligibilityRequest/mocked' },
  insurer: { reference: PAYER_URL },
  insurance: [
    {
      coverage: { reference: 'Coverage/mocked' },
      item: [{ category: { coding: [{ code: '30' }] }, benefit: [{ type: { text: 'Active Coverage' } }] }],
    },
  ],
});

const isEligibilityCheck = (input: Parameters<typeof fetch>[0]): boolean =>
  String(input).endsWith('/rcm/eligibility-check');

const eligibilityChecks = (fetchSpy: MockInstance<typeof fetch>): { url: string; eligibilityRequestId: string }[] =>
  fetchSpy.mock.calls
    .filter(([input]) => isEligibilityCheck(input))
    .map(([input, init]) => ({
      url: String(input),
      eligibilityRequestId: JSON.parse(init!.body as string).eligibilityRequestId,
    }));

describe('get-eligibility integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let visit: InsuredVisit;
  let fetchSpy: MockInstance<typeof fetch>;
  const secrets = loadZambdaSecrets();
  const eligibilityCheckUrl = `${secrets.PROJECT_API}/rcm/eligibility-check`;
  const checkedAt = DateTime.now().toUTC().toISO()!;
  const visitStart = DateTime.now().toUTC().minus({ days: 3 }).set({ hour: 17, minute: 0, second: 0, millisecond: 0 });

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-eligibility.test.ts', M2MClientMockType.patient);
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    const caller = await userMe(token, secrets);
    visit = await createInsuredVisit(oystehr, setup.processId, { callerPhone: caller.name, visitStart });

    const passThroughFetch = globalThis.fetch;
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) =>
        isEligibilityCheck(input)
          ? new Response(JSON.stringify(activeCoverageResponse(visit.patient.id!, checkedAt)), { status: 200 })
          : passThroughFetch(input, init)
      );
  }, 60_000);

  beforeEach(() => {
    fetchSpy.mockClear();
  });

  afterAll(async () => {
    fetchSpy?.mockRestore();
    if (visit?.patient.id) {
      const requests = await findEligibilityRequests(oystehr, visit.patient.id);
      await Promise.all(
        requests.map((request) => oystehr.fhir.delete({ resourceType: 'CoverageEligibilityRequest', id: request.id! }))
      );
    }
    await cleanup();
  });

  it("checks the patient's primary coverage for the visit's date of service and reports it eligible", async () => {
    const { statusCode, output } = await invokeZambdaHandler<GetEligibilityResponse>(
      index,
      { patientId: visit.patient.id, appointmentId: visit.appointment.id, coverageToCheck: 'primary' },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(output.primary).toMatchObject({
      status: InsuranceEligibilityCheckStatus.eligibilityConfirmed,
      dateISO: checkedAt,
    });
    expect(output.secondary).toBeUndefined();

    const checks = eligibilityChecks(fetchSpy);
    expect(checks).toEqual([{ url: eligibilityCheckUrl, eligibilityRequestId: expect.any(String) }]);
    const eligibilityRequest = await oystehr.fhir.get<CoverageEligibilityRequest>({
      resourceType: 'CoverageEligibilityRequest',
      id: checks[0].eligibilityRequestId,
    });
    expect(eligibilityRequest).toMatchObject({
      patient: { reference: `Patient/${visit.patient.id}` },
      servicedDate: visitStart.setZone(LOCATION_TIMEZONE).toISODate(),
      insurer: { reference: PAYER_URL },
      provider: { reference: secrets.DEFAULT_BILLING_RESOURCE },
      insurance: [{ coverage: { reference: `Coverage/${visit.coverage.id}` } }],
    });
  });

  it('checks the insurance the patient entered in paperwork before it is saved and reports it eligible', async () => {
    const answer = (linkId: string, valueString: string): QuestionnaireResponseItem => ({
      linkId,
      answer: [{ valueString }],
    });
    const responseItems: QuestionnaireResponseItem[] = [
      { linkId: 'insurance-carrier', answer: [{ valueReference: { reference: PAYER_URL, display: 'Aetna' } }] },
      answer('insurance-member-id', 'W987654321'),
      answer('patient-relationship-to-insured', 'Self'),
      answer('policy-holder-first-name', 'Arya'),
      answer('policy-holder-last-name', 'Stark'),
      answer('policy-holder-dob', '2010-04-04'),
      answer('policy-holder-birth-sex', 'Female'),
      answer('policy-holder-address', '1 Main St'),
      answer('policy-holder-state', 'NY'),
      answer('policy-holder-zip', '12207'),
    ];

    const { statusCode, output } = await invokeZambdaHandler<GetEligibilityResponse>(
      index,
      {
        patientId: visit.patient.id,
        appointmentId: visit.appointment.id,
        coveragePrevalidationInput: { responseItems },
      },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(output.primary).toMatchObject({
      status: InsuranceEligibilityCheckStatus.eligibilityConfirmed,
      dateISO: checkedAt,
    });
    expect(output.secondary).toBeUndefined();

    const checks = eligibilityChecks(fetchSpy);
    expect(checks).toEqual([{ url: eligibilityCheckUrl, eligibilityRequestId: expect.any(String) }]);
    const eligibilityRequest = await oystehr.fhir.get<CoverageEligibilityRequest>({
      resourceType: 'CoverageEligibilityRequest',
      id: checks[0].eligibilityRequestId,
    });
    expect(eligibilityRequest).toMatchObject({
      patient: { reference: `Patient/${visit.patient.id}` },
      insurer: { reference: PAYER_URL },
      provider: { reference: secrets.DEFAULT_BILLING_RESOURCE },
      insurance: [{ coverage: { reference: '#covPrimary' } }],
      contained: [
        {
          resourceType: 'Coverage',
          id: 'covPrimary',
          subscriberId: 'W987654321',
          subscriber: { reference: `Patient/${visit.patient.id}` },
          payor: [{ reference: PAYER_URL }],
        },
      ],
    });
  });
});
