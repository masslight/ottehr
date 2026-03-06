import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Account, Appointment, Encounter, FhirResource, Patient, QuestionnaireResponse, RelatedPerson } from 'fhir/r4b';
import * as fs from 'fs';
import { OTTEHR_MODULE, PATIENT_BILLING_ACCOUNT_TYPE, unbundleBatchPostOutput } from 'utils';
import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest';
import { createOystehrClient, getAuth0Token } from '../../src/shared';
import { executePageHarvest, HarvestContext } from '../../src/subscriptions/task/sub-harvest-paperwork/page-handlers';
import questionnaireResponse from '../data/base-qr.json';

const DEFAULT_TIMEOUT = 40000;

describe('sub-harvest-paperwork-page integration', () => {
  const envConfig = JSON.parse(fs.readFileSync('.env/local.json', 'utf8'));
  let oystehr: Oystehr;
  let token: string;
  let BASE_QR: QuestionnaireResponse;

  // Track created resource IDs for cleanup
  const createdResourceIds: { resourceType: FhirResource['resourceType']; id: string }[] = [];

  beforeAll(async () => {
    token = await getAuth0Token(envConfig);
    oystehr = createOystehrClient(token, envConfig);

    BASE_QR = {
      ...questionnaireResponse,
      status: 'completed',
    } as QuestionnaireResponse;
  });

  afterAll(async () => {
    // Clean up all created resources in reverse order
    for (const { resourceType, id } of [...createdResourceIds].reverse()) {
      try {
        await oystehr.fhir.delete({ resourceType, id });
      } catch {
        // Resource may already be deleted or not exist
      }
    }
  }, DEFAULT_TIMEOUT);

  const createBaseResources = async (): Promise<{
    patient: Patient;
    appointment: Appointment;
    encounter: Encounter;
    relatedPerson: RelatedPerson;
  }> => {
    const patientFullUrl = `urn:uuid:${randomUUID()}`;
    const appointmentFullUrl = `urn:uuid:${randomUUID()}`;

    const postRequests: BatchInputPostRequest<Patient | Appointment | Encounter | RelatedPerson>[] = [
      {
        resource: {
          resourceType: 'Patient',
          active: true,
          gender: 'male',
          birthDate: '2020-08-06',
          name: [{ given: ['TestHarvest'], family: 'PageIntegration' }],
        },
        method: 'POST',
        url: 'Patient',
        fullUrl: patientFullUrl,
      },
      {
        method: 'POST',
        url: 'Appointment',
        fullUrl: appointmentFullUrl,
        resource: {
          resourceType: 'Appointment',
          meta: { tag: [{ code: OTTEHR_MODULE.IP }] },
          status: 'proposed',
          participant: [{ actor: { reference: patientFullUrl }, status: 'accepted' }],
        },
      },
      {
        method: 'POST',
        url: 'Encounter',
        resource: {
          resourceType: 'Encounter',
          status: 'finished',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'ACUTE' },
          appointment: [{ reference: appointmentFullUrl }],
          subject: { reference: patientFullUrl },
        },
      },
      {
        method: 'POST',
        url: 'RelatedPerson',
        resource: {
          resourceType: 'RelatedPerson',
          patient: { reference: patientFullUrl },
          telecom: [
            { value: '+15555555555', system: 'phone' },
            { value: '+15555555555', system: 'sms' },
          ],
          relationship: [
            {
              coding: [
                { code: 'user-relatedperson', system: 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship' },
              ],
            },
          ],
        },
      },
    ];

    const createdBundle = await oystehr.fhir.transaction<Patient | Appointment | Encounter | RelatedPerson>({
      requests: postRequests,
    });
    const resources = unbundleBatchPostOutput<Patient | Appointment | Encounter | RelatedPerson>(createdBundle);

    const patient = resources.find((r) => r.resourceType === 'Patient') as Patient;
    const appointment = resources.find((r) => r.resourceType === 'Appointment') as Appointment;
    const encounter = resources.find((r) => r.resourceType === 'Encounter') as Encounter;
    const relatedPerson = resources.find((r) => r.resourceType === 'RelatedPerson') as RelatedPerson;

    assert(patient?.id);
    assert(appointment?.id);
    assert(encounter?.id);
    assert(relatedPerson?.id);

    createdResourceIds.push(
      { resourceType: 'RelatedPerson', id: relatedPerson.id },
      { resourceType: 'Encounter', id: encounter.id },
      { resourceType: 'Appointment', id: appointment.id },
      { resourceType: 'Patient', id: patient.id }
    );

    return { patient, appointment, encounter, relatedPerson };
  };

  const buildContext = (
    qr: QuestionnaireResponse,
    pageLinkId: string,
    patient: Patient,
    encounter: Encounter,
    appointment: Appointment
  ): HarvestContext => ({
    qr,
    pageLinkId,
    patient,
    encounter,
    appointment,
    location: undefined,
    questionnaire: undefined,
    oystehr,
    secrets: envConfig,
  });

  // ── master-record strategy ──────────────────────────────────────────────

  it(
    'master-record strategy patches patient from contact-information-page',
    async () => {
      const { patient, encounter, appointment } = await createBaseResources();

      // contact-information-page is at index 0 in the base QR
      const qr: QuestionnaireResponse = {
        ...BASE_QR,
        encounter: { reference: `Encounter/${encounter.id}` },
        subject: { reference: `Patient/${patient.id}` },
      };

      const ctx = buildContext(qr, 'contact-information-page', patient, encounter, appointment);
      const result = await executePageHarvest(ctx);

      expect(result).toContain('master record updated');
      expect(result).toContain('contact-information-page');

      // Verify the patient was actually updated
      const updatedPatient = await oystehr.fhir.get<Patient>({
        resourceType: 'Patient',
        id: patient.id!,
      });

      // The base QR contact-information-page has email and phone values
      // so the patient should now have telecom entries
      expect(updatedPatient.telecom).toBeDefined();
      expect(updatedPatient.telecom!.length).toBeGreaterThan(0);
    },
    DEFAULT_TIMEOUT
  );

  // ── no-op for unmapped pages ────────────────────────────────────────────

  it(
    'returns skip message for unmapped page linkId',
    async () => {
      const { patient, encounter, appointment } = await createBaseResources();

      const qr: QuestionnaireResponse = {
        ...BASE_QR,
        encounter: { reference: `Encounter/${encounter.id}` },
        subject: { reference: `Patient/${patient.id}` },
      };

      const ctx = buildContext(qr, 'medical-history-page', patient, encounter, appointment);
      const result = await executePageHarvest(ctx);

      expect(result).toContain('no harvest strategy registered');
    },
    DEFAULT_TIMEOUT
  );

  // ── account-coverage strategy ───────────────────────────────────────────

  it(
    'account-coverage strategy creates account and coverage resources',
    async () => {
      const { patient, encounter, appointment } = await createBaseResources();

      const qr: QuestionnaireResponse = {
        ...BASE_QR,
        encounter: { reference: `Encounter/${encounter.id}` },
        subject: { reference: `Patient/${patient.id}` },
      };

      const ctx = buildContext(qr, 'payment-option-page', patient, encounter, appointment);
      const result = await executePageHarvest(ctx);

      expect(result).toBe('account / coverage updated');

      // Verify that account resources were created for the patient
      const accounts = (
        await oystehr.fhir.search<Account>({
          resourceType: 'Account',
          params: [
            { name: 'patient', value: `Patient/${patient.id}` },
            { name: 'status', value: 'active' },
          ],
        })
      ).unbundle() as Account[];

      // Track created accounts for cleanup
      for (const account of accounts) {
        if (account.id) {
          createdResourceIds.push({ resourceType: 'Account', id: account.id });
          // Also clean up any coverages referenced by the account
          for (const cov of account.coverage ?? []) {
            const covRef = cov.coverage?.reference;
            if (covRef) {
              const covId = covRef.replace('Coverage/', '');
              createdResourceIds.push({ resourceType: 'Coverage', id: covId });
            }
          }
        }
      }

      // The base QR has insurance data, so we expect an account to exist
      expect(accounts.length).toBeGreaterThanOrEqual(1);
      const billingAccount = accounts.find(
        (a) => a.type?.coding?.some((c) => c.code === PATIENT_BILLING_ACCOUNT_TYPE?.coding?.[0]?.code)
      );
      expect(billingAccount).toBeDefined();
    },
    DEFAULT_TIMEOUT
  );
});
