import Oystehr, { BatchInputDeleteRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import {
  Account,
  Appointment,
  Coverage,
  Encounter,
  Organization,
  Patient,
  QuestionnaireResponse,
  RelatedPerson,
  Resource,
} from 'fhir/r4b';
import * as fs from 'fs';
import { uuid } from 'short-uuid';
import {
  COVERAGE_MEMBER_IDENTIFIER_BASE,
  isValidUUID,
  OTTEHR_MODULE,
  PATIENT_BILLING_ACCOUNT_TYPE,
  unbundleBatchPostOutput,
} from 'utils';
import { assert, describe, expect, it } from 'vitest';
import { relatedPersonsAreSame } from '../../src/ehr/shared/harvest';
import { createOystehrClient, getAuth0Token } from '../../src/shared';
import { performEffect } from '../../src/subscriptions/questionnaire-response/sub-intake-harvest';
import questionnaireResponse from '../data/base-qr.json';
import {
  expectedAccountGuarantorFromQR1,
  expectedCoverageResources as qr1ExpectedCoverageResources,
  expectedPrimaryPolicyHolderFromQR1,
  expectedSecondaryPolicyHolderFromQR1,
} from '../data/expected-coverage-resources-qr1';
import {
  batchTestInsuranceWrites,
  fillReferences,
  replaceGuarantorWithAlternate,
  replaceGuarantorWithPatient,
  replaceSubscriberWithPatient,
} from '../helpers/harvest-test-helpers';

const DEFAULT_TIMEOUT = 20000;

const stubAccount: Account = {
  resourceType: 'Account',
  type: { ...PATIENT_BILLING_ACCOUNT_TYPE },
  status: 'active',
  subject: [{ reference: `{{PATIENT_REF}}` }],
  description: 'Patient account',
};

describe('Harvest Module Integration Tests', () => {
  const envConfig = JSON.parse(fs.readFileSync('.env/local.json', 'utf8'));
  const INSURANCE_PLAN_ORGS_IDS: string[] = [];
  let token: string | undefined;
  let oystehrClient: Oystehr;
  let BASE_QR: QuestionnaireResponse;
  const patientIdsForCleanup: Record<string, string[]> = {};
  const patientsUsed: Set<string> = new Set();

  const stripIdAndMeta = <T extends Resource>(resource: T): T => {
    return {
      ...resource,
      id: undefined,
      meta: undefined,
    };
  };

  const QR_WITH_PATIENT_GUARANTOR = (): QuestionnaireResponse => ({
    ...BASE_QR,
    item: replaceGuarantorWithPatient(BASE_QR.item ?? []),
  });
  const QR_WITH_PATIENT_PRIMARY_SUBSCRIBER = (): QuestionnaireResponse => ({
    ...BASE_QR,
    item: replaceSubscriberWithPatient(BASE_QR.item ?? [], {
      primary: true,
      secondary: false,
    }),
  });
  const QR_WITH_PATIENT_SECONDARY_SUBSCRIBER = (): QuestionnaireResponse => ({
    ...BASE_QR,
    item: replaceSubscriberWithPatient(BASE_QR.item ?? [], {
      primary: false,
      secondary: true,
    }),
  });

  const QR_WITH_PATIENT_FOR_ALL_SUBSCRIBERS_AND_GUARANTOR = (): QuestionnaireResponse => ({
    ...BASE_QR,
    item: replaceGuarantorWithPatient(
      replaceSubscriberWithPatient(BASE_QR.item ?? [], {
        primary: true,
        secondary: true,
      })
    ),
  });

  const QR_WITH_ALT_GUARANTOR = (param?: any): QuestionnaireResponse => ({
    ...BASE_QR,
    item: replaceGuarantorWithAlternate(BASE_QR.item ?? [], param),
  });

  const getQR1Refs = (
    pId: string,
    dummyResourceRefs?: {
      appointment: string;
      encounter: string;
    }
  ): string[] => {
    const [orgId] = INSURANCE_PLAN_ORGS_IDS;
    const persistedIds = patientIdsForCleanup[pId];
    if (persistedIds === undefined && dummyResourceRefs) {
      const { appointment, encounter } = dummyResourceRefs;
      return [`Organization/${orgId}`, `Patient/${pId}`, encounter, appointment];
    }
    const [patientId, encounterId, appointmentId] = patientIdsForCleanup[pId];
    const refs = [
      `Organization/${orgId}`,
      `Patient/${patientId}`,
      `Encounter/${encounterId}`,
      `Appointment/${appointmentId}`,
    ];
    return refs;
  };

  const fillWithQR1Refs = (
    template: any,
    patientId: string,
    dummyResourceRefs?: {
      appointment: string;
      encounter: string;
    }
  ): any => {
    const refs = getQR1Refs(patientId, dummyResourceRefs);
    return fillReferences(template, refs);
  };

  const normalizedCompare = (rawTemplate: any, rawExpectation: any, patientId: string): any => {
    const template = fillWithQR1Refs(rawTemplate, patientId);
    expect(template).toEqual(stripIdAndMeta(rawExpectation));
  };

  const changeCoverageMemberId = (coverage: Coverage, patientId: string): Coverage => {
    const newId = uuid();
    return fillWithQR1Refs(
      {
        ...coverage,
        identifier: [
          {
            ...COVERAGE_MEMBER_IDENTIFIER_BASE, // this holds the 'type'
            value: newId,
            assigner: {
              reference: '{{ORGANIZATION_REF}}',
              display: 'Aetna',
            },
          },
        ],
        subscriberId: newId,
      },
      patientId
    );
  };

  const cleanup = async (): Promise<{ error: Error | undefined }> => {
    const errors: string[] = [];
    try {
      const cleanupOutcomes = await Promise.allSettled(
        (Object.values(patientIdsForCleanup) ?? []).map((resources) => cleanupPatientResources(resources))
      );
      cleanupOutcomes.forEach((outcome, idx) => {
        if (outcome.status === 'rejected') {
          errors.push(`${Object.keys(patientIdsForCleanup)[idx]}`);
        }
      });
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
    if (errors.length > 0) {
      return { error: new Error(`Failed to clean up resources for patients: ${errors.join(', ')}`) };
    }
    return { error: undefined };
  };

  const cleanupPatientResources = async (ids: string[]): Promise<void> => {
    const [patientId, encounterId, appointmentId, relatedPersonId] = ids;
    if (!token) {
      throw new Error('Failed to fetch auth token.');
    }
    const oystehrClient = createOystehrClient(token, envConfig);
    const createdResources = (
      await oystehrClient.fhir.search<Account | Coverage | RelatedPerson | Patient>({
        resourceType: 'Patient',
        params: [
          {
            name: '_id',
            value: patientId,
          },
          {
            name: '_revinclude',
            value: 'Appointment:patient',
          },
          {
            name: '_revinclude',
            value: 'Encounter:patient',
          },
          {
            name: '_revinclude',
            value: 'RelatedPerson:patient',
          },
          {
            name: '_revinclude',
            value: `Account:patient`,
          },
          {
            name: '_revinclude',
            value: 'Coverage:patient',
          },
          {
            name: '_include:iterate',
            value: 'Coverage:subscriber:RelatedPerson',
          },
        ],
      })
    ).unbundle();

    const uniques = new Set<string>();
    const deletes: BatchInputDeleteRequest[] = createdResources
      .map((res) => {
        return {
          method: 'DELETE',
          url: `${res.resourceType}/${res.id}`,
        } as BatchInputDeleteRequest;
      })
      .filter((request) => {
        if (uniques.has(request.url)) {
          return false;
        }
        uniques.add(request.url);
        return true;
      });

    await oystehrClient.fhir.transaction({ requests: deletes });

    try {
      await oystehrClient.fhir.get({ resourceType: 'Patient', id: patientId });
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error?.code).toBe(410);
    }
    try {
      await oystehrClient.fhir.get({ resourceType: 'Appointment', id: appointmentId });
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error?.code).toBe(410);
    }
    try {
      await oystehrClient.fhir.get({ resourceType: 'Encounter', id: encounterId });
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error?.code).toBe(410);
    }
    try {
      await oystehrClient.fhir.get({ resourceType: 'RelatedPerson', id: relatedPersonId });
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error?.code).toBe(410);
    }
  };

  interface ValidateAccountInput {
    patientId: string;
    qr?: QuestionnaireResponse;
    idToCheck?: string;
    guarantorRef?: string;
    dummyResourceRefs?: {
      appointment: string;
      encounter: string;
    };
  }
  interface ValidatedAccountData {
    account: Account;
    primaryCoverageRef: string;
    secondaryCoverageRef: string;
    persistedGuarantor?: RelatedPerson | Patient;
  }
  const applyEffectAndValidateResults = async (input: ValidateAccountInput): Promise<ValidatedAccountData> => {
    const { qr, idToCheck, guarantorRef, patientId, dummyResourceRefs } = input;
    const qrWithPatient = fillWithQR1Refs(qr ?? BASE_QR, patientId, dummyResourceRefs);
    console.log('QR with patient:', JSON.stringify(qrWithPatient, null, 2));
    const effect = await performEffect({ qr: qrWithPatient, secrets: envConfig }, oystehrClient);
    // todo: deeper integration test is needed here
    expect(['1 failed: update stripe customer', 'all tasks executed successfully']).toContain(effect);
    const foundAccounts = (
      await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient',
            value: `Patient/${patientId}`,
          },
          {
            name: 'status',
            value: 'active',
          },
        ],
      })
    ).unbundle();
    expect(foundAccounts).toBeDefined();
    let foundGuarantor: RelatedPerson | Patient | undefined;
    if (guarantorRef && !guarantorRef.startsWith('#')) {
      const [resourceType, resourceId] = guarantorRef.split('/');
      foundGuarantor = await oystehrClient.fhir.get<RelatedPerson | Patient>({
        resourceType: resourceType as 'RelatedPerson' | 'Patient',
        id: resourceId,
      });
    }
    const foundAccountResources = foundAccounts.filter((res) => res.resourceType === 'Account') as Account[];
    expect(foundAccountResources.length).toBe(1);
    const foundAccount = foundAccountResources[0];
    expect(foundAccount).toBeDefined();
    assert(foundAccount.id);
    if (idToCheck) {
      expect(foundAccount.id).toBe(idToCheck);
    }
    expect(foundAccount.coverage).toBeDefined();
    expect(foundAccount.coverage?.length).toBe(2);
    const primaryCoverageRef = foundAccount.coverage?.find((cov) => cov.priority === 1)?.coverage?.reference;
    const secondaryCoverageRef = foundAccount.coverage?.find((cov) => cov.priority === 2)?.coverage?.reference;
    expect(primaryCoverageRef).toBeDefined();
    expect(secondaryCoverageRef).toBeDefined();
    assert(primaryCoverageRef);
    assert(secondaryCoverageRef);

    if (guarantorRef && guarantorRef.startsWith('#')) {
      const contained = foundAccount.contained ?? [];
      const guarantor = contained.find((res) => `#${res.id}` === guarantorRef);
      expect(guarantor).toBeDefined();
    }

    return {
      account: foundAccount,
      primaryCoverageRef,
      secondaryCoverageRef,
      persistedGuarantor: foundGuarantor,
    };
  };

  beforeAll(async () => {
    // Set up environment
    // Add your setup code here
    expect(process.env).toBeDefined();
    expect(envConfig).toBeDefined();

    if (!token) {
      token = await getAuth0Token(envConfig);
    }

    oystehrClient = createOystehrClient(token, envConfig);
    expect(oystehrClient).toBeDefined();

    const org1 = (
      await oystehrClient.fhir.search<Organization>({
        resourceType: 'Organization',
        params: [
          {
            name: 'name:exact',
            value: 'Aetna',
          },
          {
            name: 'active',
            value: 'true',
          },
        ],
      })
    ).unbundle();

    const orgs = org1.filter((org) => org.resourceType === 'Organization') as Organization[];
    expect(orgs.length).toBeGreaterThan(0);
    INSURANCE_PLAN_ORGS_IDS.push(...orgs.map((o) => o.id!));
    expect(INSURANCE_PLAN_ORGS_IDS.length).toBeGreaterThan(0);

    const refs = [`Organization/${INSURANCE_PLAN_ORGS_IDS[0]}`];

    const replacedItem = fillReferences(questionnaireResponse.item, refs);

    questionnaireResponse.item = replacedItem;
    questionnaireResponse.status = 'completed';

    BASE_QR = questionnaireResponse as QuestionnaireResponse;
    expect(BASE_QR).toBeDefined();
  });

  beforeEach(async () => {
    const patient: Patient = {
      resourceType: 'Patient',
      active: true,
      gender: 'male',
      birthDate: '2020-08-06',
    };
    const patientFullUrl = `urn:uuid:${randomUUID()}`;
    const appointmentFullUrl = `urn:uuid:${randomUUID()}`;
    const postRequests: BatchInputPostRequest<Patient | Appointment | Encounter | RelatedPerson>[] = [
      {
        resource: patient,
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
          meta: {
            tag: [
              {
                code: OTTEHR_MODULE.IP,
              },
            ],
          },
          status: 'proposed',
          participant: [
            {
              actor: {
                reference: patientFullUrl,
              },
              status: 'accepted',
            },
            {
              actor: {
                reference: 'HealthcareService/3ad8f817-d3a4-4879-aac7-8a0b9461738b',
              },
              status: 'accepted',
            },
          ],
        },
      },
      {
        method: 'POST',
        url: 'Encounter',
        resource: {
          resourceType: 'Encounter',
          status: 'finished',
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'ACUTE',
          },
          appointment: [
            {
              reference: appointmentFullUrl,
            },
          ],
          subject: {
            reference: patientFullUrl,
          },
        },
      },
      {
        method: 'POST',
        url: 'RelatedPerson',
        resource: {
          resourceType: 'RelatedPerson',
          patient: {
            reference: patientFullUrl,
          },
          telecom: [
            {
              value: '+15555555555',
              system: 'phone',
            },
            {
              value: '+15555555555',
              system: 'sms',
            },
          ],
          relationship: [
            {
              coding: [
                {
                  code: 'user-relatedperson',
                  system: 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship',
                },
              ],
            },
          ],
        },
      },
    ];
    const createdBundle = await oystehrClient.fhir.transaction<Patient | Appointment | Encounter | RelatedPerson>({
      requests: postRequests,
    });
    expect(createdBundle).toBeDefined();
    const resources = unbundleBatchPostOutput<Patient | Appointment | Encounter | RelatedPerson>(createdBundle);
    expect(resources.length).toBe(4);
    const createdPatient = resources.find((res) => res.resourceType === 'Patient') as Patient;
    const createdAppointment = resources.find((res) => res.resourceType === 'Appointment') as Appointment;
    const createdEncounter = resources.find((res) => res.resourceType === 'Encounter') as Encounter;
    const createdRelatedPerson = resources.find((res) => res.resourceType === 'RelatedPerson') as RelatedPerson;
    expect(createdPatient).toBeDefined();
    expect(createdPatient.id).toBeDefined();
    assert(createdPatient.id);
    expect(createdAppointment).toBeDefined();
    expect(createdAppointment.id).toBeDefined();
    assert(createdAppointment.id);
    expect(createdEncounter).toBeDefined();
    expect(createdEncounter.id).toBeDefined();
    assert(createdEncounter.id);
    expect(createdRelatedPerson).toBeDefined();
    expect(createdRelatedPerson.id).toBeDefined();
    assert(createdRelatedPerson.id);
    patientIdsForCleanup[createdPatient.id] = [
      createdPatient.id,
      createdEncounter.id,
      createdAppointment.id,
      createdRelatedPerson.id,
    ];
  });
  afterAll(async () => {
    const { error } = await cleanup();
    expect(error).toBeUndefined();
  }, DEFAULT_TIMEOUT + 10000);

  const getPatientId = (): string => {
    const allEntries = Array.from(Object.entries(patientIdsForCleanup));
    const [pId] = allEntries[allEntries.length - 1];
    expect(isValidUUID(pId)).toBe(true);
    expect(patientsUsed.has(pId)).toBe(false);
    patientsUsed.add(pId);
    return pId;
  };

  it('should perform a sample test', async () => {
    // Add your test code here
    const patientId = getPatientId();
    expect(true).toBe(true);
    const createdAccount = (
      await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient._id',
            value: `${patientId}`,
          },
          {
            name: 'status',
            value: 'active',
          },
        ],
      })
    ).unbundle();
    expect(createdAccount.length).toBe(0);
  });
  it(
    'should create an account with two associated coverages from the base sample QR',
    async () => {
      const patientId = getPatientId();
      expect(patientId).toBeDefined();
      expect(isValidUUID(patientId)).toBe(true);
      const [_, encounterId] = patientIdsForCleanup[patientId];
      expect(encounterId).toBeDefined();
      const qr = fillWithQR1Refs(BASE_QR, patientId);
      const encounterRef = qr.encounter?.reference;
      expect(encounterRef).toBeDefined();
      const encounterIdFromQr = encounterRef?.replace('Encounter/', '');
      assert(encounterRef);
      expect(encounterIdFromQr).toBeDefined();
      expect(isValidUUID(encounterIdFromQr)).toBe(true);
      expect(encounterId).toBe(encounterIdFromQr);

      const effect = await performEffect({ qr, secrets: envConfig }, oystehrClient);
      expect(effect).toBe('all tasks executed successfully');

      const createdAccountBundle = await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient._id',
            value: `${patientId}`,
          },
          {
            name: 'status',
            value: 'active',
          },
        ],
      });
      const createdAccount = createdAccountBundle.unbundle()[0];
      expect(createdAccount).toBeDefined();
      assert(createdAccount.id);
      expect(createdAccount.coverage).toBeDefined();
      const primaryCoverageRef = createdAccount.coverage?.find((cov) => cov.priority === 1)?.coverage?.reference;
      const secondaryCoverageRef = createdAccount.coverage?.find((cov) => cov.priority === 2)?.coverage?.reference;
      expect(primaryCoverageRef).toBeDefined();
      expect(secondaryCoverageRef).toBeDefined();
      assert(primaryCoverageRef);
      assert(secondaryCoverageRef);

      const createdCoverages = (
        await oystehrClient.fhir.search<Coverage>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
          ],
        })
      ).unbundle();
      expect(createdCoverages).toBeDefined();
      expect(createdCoverages.length).toBeGreaterThanOrEqual(2);
      const primaryCoverage = createdCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === primaryCoverageRef;
      });
      const secondaryCoverage = createdCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === secondaryCoverageRef;
      });
      expect(primaryCoverage).toBeDefined();
      expect(secondaryCoverage).toBeDefined();
      expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);

      // both coverages should have contained RP as the subscriber
      expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
      expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

      const { primary, secondary } = qr1ExpectedCoverageResources;
      normalizedCompare(primary, primaryCoverage, patientId);
      normalizedCompare(secondary, secondaryCoverage, patientId);
    },
    DEFAULT_TIMEOUT
  );

  it(
    'should update existing coverages to live on the new Account when the inputs match',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs(patientId));
      const persistedRP2 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs(patientId));
      const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs(patientId));
      const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs(patientId));

      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(4);

      const writtenPrimaryCoverage = writtenResources.find(
        (res) => res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage1.subscriberId
      ) as Coverage;
      const writtenSecondaryCoverage = writtenResources.find(
        (res) => res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage2.subscriberId
      ) as Coverage;
      const writtenPrimarySubscriber = writtenResources.find(
        (res) => `RelatedPerson/${res.id}` === writtenPrimaryCoverage?.subscriber?.reference
      ) as RelatedPerson;
      const writtenSecondarySubscriber = writtenResources.find(
        (res) => `RelatedPerson/${res.id}` === writtenSecondaryCoverage?.subscriber?.reference
      ) as RelatedPerson;

      const qr = fillWithQR1Refs(BASE_QR, patientId);
      const effect = await performEffect({ qr, secrets: envConfig }, oystehrClient);
      expect(effect).toBe('all tasks executed successfully');

      const createdAccount = (
        await oystehrClient.fhir.search<Account>({
          resourceType: 'Account',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
          ],
        })
      ).unbundle()[0];
      expect(createdAccount).toBeDefined();
      assert(createdAccount.id);
      const primaryCoverageRef = createdAccount.coverage?.find((cov) => cov.priority === 1)?.coverage?.reference;
      const secondaryCoverageRef = createdAccount.coverage?.find((cov) => cov.priority === 2)?.coverage?.reference;
      expect(primaryCoverageRef).toBeDefined();
      expect(secondaryCoverageRef).toBeDefined();
      assert(primaryCoverageRef);
      assert(secondaryCoverageRef);

      const createdCoverages = (
        await oystehrClient.fhir.search<Coverage>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
          ],
        })
      ).unbundle();
      expect(createdCoverages).toBeDefined();
      expect(createdCoverages.length).toBe(2);
      const primaryCoverage = createdCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === primaryCoverageRef;
      });
      const secondaryCoverage = createdCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === secondaryCoverageRef;
      });
      expect(primaryCoverage).toBeDefined();
      expect(secondaryCoverage).toBeDefined();
      expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);

      // both coverages should have the existing persisted RP as the subscriber
      expect(primaryCoverage?.subscriber?.reference).toEqual(`RelatedPerson/${writtenPrimarySubscriber.id}`);
      expect(secondaryCoverage?.subscriber?.reference).toEqual(`RelatedPerson/${writtenSecondarySubscriber.id}`);

      expect(writtenPrimaryCoverage).toEqual(primaryCoverage);
      expect(writtenSecondaryCoverage).toEqual(secondaryCoverage);
    },
    DEFAULT_TIMEOUT
  );

  it(
    'should update existing primary coverage to live on the new Account when the inputs match, but should create a new one for secondary if no match found',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs(patientId));
      const persistedRP2 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs(patientId));
      const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs(patientId));
      const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs(patientId));

      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: false },
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(4);

      const writtenPrimaryCoverage = writtenResources.find(
        (res) => res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage1.subscriberId
      ) as Coverage;
      const writtenSecondaryCoverage = writtenResources.find(
        (res) => res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage2.subscriberId
      ) as Coverage;
      const writtenPrimarySubscriber = writtenResources.find(
        (res) => `RelatedPerson/${res.id}` === writtenPrimaryCoverage?.subscriber?.reference
      ) as RelatedPerson;
      const writtenSecondarySubscriber = writtenResources.find(
        (res) => `RelatedPerson/${res.id}` === writtenSecondaryCoverage?.subscriber?.reference
      ) as RelatedPerson;

      const qr = fillWithQR1Refs(BASE_QR, patientId);
      const effect = await performEffect({ qr, secrets: envConfig }, oystehrClient);
      expect(effect).toBe('all tasks executed successfully');

      const createdAccount = (
        await oystehrClient.fhir.search<Account>({
          resourceType: 'Account',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
          ],
        })
      ).unbundle()[0];
      expect(createdAccount).toBeDefined();
      assert(createdAccount.id);
      const primaryCoverageRef = createdAccount.coverage?.find((cov) => cov.priority === 1)?.coverage?.reference;
      const secondaryCoverageRef = createdAccount.coverage?.find((cov) => cov.priority === 2)?.coverage?.reference;
      expect(primaryCoverageRef).toBeDefined();
      expect(secondaryCoverageRef).toBeDefined();
      assert(primaryCoverageRef);
      assert(secondaryCoverageRef);

      const allCoverages = (
        await oystehrClient.fhir.search<Coverage>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
          ],
        })
      ).unbundle();
      expect(allCoverages).toBeDefined();
      expect(allCoverages.length).toBe(3);
      const primaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === primaryCoverageRef;
      });
      const secondaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === secondaryCoverageRef;
      });
      const extraCoverageJustHangingOutInFhir = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef !== secondaryCoverageRef && coverageRef !== primaryCoverageRef;
      });
      expect(primaryCoverage).toBeDefined();
      expect(secondaryCoverage).toBeDefined();
      expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(extraCoverageJustHangingOutInFhir).toBeDefined();
      expect(extraCoverageJustHangingOutInFhir?.status).toBe('active');
      expect(extraCoverageJustHangingOutInFhir?.subscriber?.reference).toEqual(
        `RelatedPerson/${writtenSecondarySubscriber.id}`
      );

      expect(primaryCoverage?.subscriber?.reference).toEqual(`RelatedPerson/${writtenPrimarySubscriber.id}`);
      expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

      expect(writtenPrimaryCoverage).toEqual(primaryCoverage);
      const { secondary } = qr1ExpectedCoverageResources;
      normalizedCompare(secondary, secondaryCoverage, patientId);

      expect(
        relatedPersonsAreSame(writtenSecondarySubscriber, secondaryCoverage?.contained?.[0] as RelatedPerson)
      ).toBe(true);
    },
    DEFAULT_TIMEOUT
  );

  it(
    'should update existing secondary coverage to live on the new Account when the inputs match, but should create a new one for primary is no match found',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs(patientId));
      const persistedRP2 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs(patientId));
      const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs(patientId));
      const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs(patientId));

      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: false },
        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(4);

      const writtenPrimaryCoverage = writtenResources.find(
        (res) => res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage1.subscriberId
      ) as Coverage;
      const writtenSecondaryCoverage = writtenResources.find(
        (res) => res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage2.subscriberId
      ) as Coverage;
      const writtenPrimarySubscriber = writtenResources.find(
        (res) => `RelatedPerson/${res.id}` === writtenPrimaryCoverage?.subscriber?.reference
      ) as RelatedPerson;
      const writtenSecondarySubscriber = writtenResources.find(
        (res) => `RelatedPerson/${res.id}` === writtenSecondaryCoverage?.subscriber?.reference
      ) as RelatedPerson;

      const qr = fillWithQR1Refs(BASE_QR, patientId);
      const effect = await performEffect({ qr, secrets: envConfig }, oystehrClient);
      expect(effect).toBe('all tasks executed successfully');

      const createdAccount = (
        await oystehrClient.fhir.search<Account>({
          resourceType: 'Account',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
          ],
        })
      ).unbundle()[0];
      expect(createdAccount).toBeDefined();
      assert(createdAccount.id);
      const primaryCoverageRef = createdAccount.coverage?.find((cov) => cov.priority === 1)?.coverage?.reference;
      const secondaryCoverageRef = createdAccount.coverage?.find((cov) => cov.priority === 2)?.coverage?.reference;
      expect(primaryCoverageRef).toBeDefined();
      expect(secondaryCoverageRef).toBeDefined();
      assert(primaryCoverageRef);
      assert(secondaryCoverageRef);

      const allCoverages = (
        await oystehrClient.fhir.search<Coverage>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
          ],
        })
      ).unbundle();
      expect(allCoverages).toBeDefined();
      expect(allCoverages.length).toBe(3);
      const primaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === primaryCoverageRef;
      });
      const secondaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === secondaryCoverageRef;
      });

      const extraCoverageJustHangingOutInFhir = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef !== secondaryCoverageRef && coverageRef !== primaryCoverageRef;
      });
      expect(primaryCoverage).toBeDefined();
      expect(secondaryCoverage).toBeDefined();
      expect(extraCoverageJustHangingOutInFhir).toBeDefined();
      expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(extraCoverageJustHangingOutInFhir?.status).toBe('active');
      expect(extraCoverageJustHangingOutInFhir?.subscriber?.reference).toEqual(
        `RelatedPerson/${writtenPrimarySubscriber.id}`
      );

      expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
      expect(secondaryCoverage?.subscriber?.reference).toEqual(`RelatedPerson/${writtenSecondarySubscriber.id}`);

      expect(writtenSecondaryCoverage).toEqual(secondaryCoverage);
      const { primary } = qr1ExpectedCoverageResources;
      normalizedCompare(primary, primaryCoverage, patientId);

      expect(relatedPersonsAreSame(writtenPrimarySubscriber, primaryCoverage?.contained?.[0] as RelatedPerson)).toBe(
        true
      );
    },
    DEFAULT_TIMEOUT
  );

  it(
    'should create two new coverages when neither matches existing coverages',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs(patientId));
      const persistedRP2 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs(patientId));
      const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs(patientId));
      const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs(patientId));

      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: false },
        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: false },
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(4);

      const qr = fillWithQR1Refs(BASE_QR, patientId);
      const effect = await performEffect({ qr, secrets: envConfig }, oystehrClient);
      expect(effect).toBe('all tasks executed successfully');

      const createdAccount = (
        await oystehrClient.fhir.search<Account>({
          resourceType: 'Account',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
          ],
        })
      ).unbundle()[0];
      expect(createdAccount).toBeDefined();
      assert(createdAccount.id);
      const primaryCoverageRef = createdAccount.coverage?.find((cov) => cov.priority === 1)?.coverage?.reference;
      const secondaryCoverageRef = createdAccount.coverage?.find((cov) => cov.priority === 2)?.coverage?.reference;
      expect(primaryCoverageRef).toBeDefined();
      expect(secondaryCoverageRef).toBeDefined();
      assert(primaryCoverageRef);
      assert(secondaryCoverageRef);

      const allCoverages = (
        await oystehrClient.fhir.search<Coverage>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
          ],
        })
      ).unbundle();
      expect(allCoverages).toBeDefined();
      expect(allCoverages.length).toBe(4);
      const primaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === primaryCoverageRef;
      });
      const secondaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === secondaryCoverageRef;
      });

      expect(primaryCoverage).toBeDefined();
      expect(secondaryCoverage).toBeDefined();
      expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);

      expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
      expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

      const { primary, secondary } = qr1ExpectedCoverageResources;
      normalizedCompare(primary, primaryCoverage, patientId);
      normalizedCompare(secondary, secondaryCoverage, patientId);
    },
    DEFAULT_TIMEOUT
  );

  it(
    'existing Account with no coverages should be updated with newly written coverages',
    async () => {
      const patientId = getPatientId();
      const batchRequests = batchTestInsuranceWrites({ account: fillWithQR1Refs(stubAccount, patientId) });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(1);
      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

      const qr = fillWithQR1Refs(BASE_QR, patientId);
      const effect = await performEffect({ qr, secrets: envConfig }, oystehrClient);
      expect(effect).toBe('all tasks executed successfully');
      const foundAccounts = (
        await oystehrClient.fhir.search<Account>({
          resourceType: 'Account',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
          ],
        })
      ).unbundle();
      expect(foundAccounts).toBeDefined();
      expect(foundAccounts.length).toBe(1);
      const foundAccount = foundAccounts[0];
      expect(foundAccount).toBeDefined();
      assert(foundAccount.id);
      expect(foundAccount.id).toEqual(writtenAccount.id);
      expect(foundAccount.coverage).toBeDefined();
      expect(foundAccount.coverage?.length).toBe(2);
      const primaryCoverageRef = foundAccount.coverage?.find((cov) => cov.priority === 1)?.coverage?.reference;
      const secondaryCoverageRef = foundAccount.coverage?.find((cov) => cov.priority === 2)?.coverage?.reference;
      expect(primaryCoverageRef).toBeDefined();
      expect(secondaryCoverageRef).toBeDefined();
      assert(primaryCoverageRef);
      assert(secondaryCoverageRef);

      const allCoverages = (
        await oystehrClient.fhir.search<Coverage>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
          ],
        })
      ).unbundle();
      expect(allCoverages).toBeDefined();
      expect(allCoverages.length).toBe(2);
      const primaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === primaryCoverageRef;
      });
      const secondaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === secondaryCoverageRef;
      });

      expect(primaryCoverage).toBeDefined();
      expect(secondaryCoverage).toBeDefined();
      expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);

      expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
      expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

      const { primary, secondary } = qr1ExpectedCoverageResources;
      normalizedCompare(primary, primaryCoverage, patientId);
      normalizedCompare(secondary, secondaryCoverage, patientId);
    },
    DEFAULT_TIMEOUT
  );

  it(
    'should update an existing Account to replace old coverage with unmatched member number, which should be updated to "cancelled',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillWithQR1Refs(expectedPrimaryPolicyHolderFromQR1, patientId);
      const persistedCoverage1 = changeCoverageMemberId(qr1ExpectedCoverageResources.primary, patientId);

      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        account: fillWithQR1Refs(stubAccount, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(3);
      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

      const { primaryCoverageRef, secondaryCoverageRef } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        patientId,
      });
      const allCoverages = (
        await oystehrClient.fhir.search<Coverage>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
          ],
        })
      ).unbundle();
      expect(allCoverages).toBeDefined();
      expect(allCoverages.length).toBe(2);
      const primaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === primaryCoverageRef;
      });
      const secondaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === secondaryCoverageRef;
      });

      expect(primaryCoverage).toBeDefined();
      expect(secondaryCoverage).toBeDefined();
      expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);

      expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
      expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

      const { primary, secondary } = qr1ExpectedCoverageResources;
      normalizedCompare(primary, primaryCoverage, patientId);
      normalizedCompare(secondary, secondaryCoverage, patientId);

      const canceledCoverages = (
        await oystehrClient.fhir.search<Coverage>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'cancelled',
            },
          ],
        })
      ).unbundle();
      expect(canceledCoverages.length).toBe(1);
      const canceledCoverage = canceledCoverages[0];
      assert(canceledCoverage);
      const shouldHaveBeenCanceled = writtenResources.find((res) => res.resourceType === 'Coverage') as Coverage;
      expect(canceledCoverage.id).toEqual(shouldHaveBeenCanceled.id);
      expect({ ...shouldHaveBeenCanceled, status: 'cancelled', meta: undefined }).toEqual({
        ...canceledCoverage,
        meta: undefined,
      });
    },
    DEFAULT_TIMEOUT
  );
  it(
    'should update an existing Account to update secondary Coverage with unmatched contained subscriber',
    async () => {
      const patientId = getPatientId();
      const persistedRP2 = fillWithQR1Refs(
        { ...expectedSecondaryPolicyHolderFromQR1, birthDate: '1990-01-01' },
        patientId
      );
      const persistedCoverage2 = fillWithQR1Refs(
        {
          ...qr1ExpectedCoverageResources.secondary,
        },
        patientId
      );

      const batchRequests = batchTestInsuranceWrites({
        secondary: {
          subscriber: persistedRP2,
          coverage: persistedCoverage2,
          ensureOrder: true,
          containedSubscriber: true,
        },
        account: fillWithQR1Refs(stubAccount, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(2);
      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

      const { primaryCoverageRef, secondaryCoverageRef } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        patientId,
      });
      const allCoverages = (
        await oystehrClient.fhir.search<Coverage | RelatedPerson>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
            {
              name: '_include',
              value: 'Coverage:subscriber',
            },
          ],
        })
      ).unbundle();
      expect(allCoverages).toBeDefined();
      expect(allCoverages.length).toBe(2);
      const primaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === primaryCoverageRef;
      }) as Coverage;
      const secondaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === secondaryCoverageRef;
      }) as Coverage;

      expect(primaryCoverage).toBeDefined();
      expect(secondaryCoverage).toBeDefined();
      expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);

      expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
      expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

      const { primary } = qr1ExpectedCoverageResources;
      normalizedCompare(primary, primaryCoverage, patientId);

      const shouldHaveNewSubscriber = writtenResources.find((res) => res.resourceType === 'Coverage') as Coverage;
      const oldContained = shouldHaveNewSubscriber.contained?.[0] as RelatedPerson;
      const newContained = secondaryCoverage.contained?.[0] as RelatedPerson;
      expect(shouldHaveNewSubscriber.id).toEqual(secondaryCoverage.id);
      expect(newContained).toBeDefined();
      expect(oldContained).toBeDefined();
      expect(oldContained.birthDate).toEqual('1990-01-01');
      expect(oldContained.name).toEqual(newContained.name);
      expect(oldContained.patient).toEqual(newContained.patient);
      expect(oldContained).not.toEqual(newContained);

      const canceledCoverages = (
        await oystehrClient.fhir.search<Coverage>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'cancelled',
            },
          ],
        })
      ).unbundle();
      expect(canceledCoverages.length).toBe(0);
    },
    DEFAULT_TIMEOUT
  );
  it(
    'should update an existing Account to update secondary Coverage with unmatched persisted subscriber, old subscriber should be unchanged',
    async () => {
      const patientId = getPatientId();
      const persistedRP2 = fillWithQR1Refs(
        { ...expectedSecondaryPolicyHolderFromQR1, birthDate: '1990-01-01' },
        patientId
      );
      const persistedCoverage2 = fillWithQR1Refs(
        {
          ...qr1ExpectedCoverageResources.secondary,
        },
        patientId
      );

      const batchRequests = batchTestInsuranceWrites({
        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
        account: fillWithQR1Refs(stubAccount, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(3);
      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

      const { primaryCoverageRef, secondaryCoverageRef } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        patientId,
      });
      const allCoverages = (
        await oystehrClient.fhir.search<Coverage | RelatedPerson>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
            {
              name: '_include',
              value: 'Coverage:subscriber',
            },
          ],
        })
      ).unbundle();
      expect(allCoverages).toBeDefined();
      expect(allCoverages.length).toBe(2);
      const primaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === primaryCoverageRef;
      }) as Coverage;
      const secondaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === secondaryCoverageRef;
      }) as Coverage;

      expect(primaryCoverage).toBeDefined();
      expect(secondaryCoverage).toBeDefined();
      expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);

      expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
      expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

      const { primary } = qr1ExpectedCoverageResources;
      normalizedCompare(primary, primaryCoverage, patientId);

      const shouldHaveNewSubscriber = writtenResources.find((res) => res.resourceType === 'Coverage') as Coverage;
      const newContained = secondaryCoverage.contained?.[0] as RelatedPerson;
      expect(shouldHaveNewSubscriber.id).toEqual(secondaryCoverage.id);
      expect(shouldHaveNewSubscriber.subscriber).not.toEqual(secondaryCoverage.subscriber);

      expect(newContained).toBeDefined();

      const oldSubscriber = await oystehrClient.fhir.get<RelatedPerson>({
        id: shouldHaveNewSubscriber.subscriber?.reference!.split('/')[1] ?? '',
        resourceType: 'RelatedPerson',
      });
      expect(oldSubscriber).toBeDefined();
      expect(oldSubscriber.birthDate).toEqual('1990-01-01');
      expect(oldSubscriber.name).toEqual(newContained.name);
      expect(oldSubscriber.patient).toEqual(newContained.patient);

      const canceledCoverages = (
        await oystehrClient.fhir.search<Coverage>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'cancelled',
            },
          ],
        })
      ).unbundle();
      expect(canceledCoverages.length).toBe(0);
    },
    DEFAULT_TIMEOUT
  );
  it(
    'should update an existing Account to update Coverage with unmatched persisted subscriber, old subscriber should be unchanged',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillWithQR1Refs(
        { ...expectedPrimaryPolicyHolderFromQR1, birthDate: '1990-01-01' },
        patientId
      );
      const persistedCoverage1 = fillWithQR1Refs(
        {
          ...qr1ExpectedCoverageResources.primary,
        },
        patientId
      );

      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        account: fillWithQR1Refs(stubAccount, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(3);
      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

      const { primaryCoverageRef, secondaryCoverageRef } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        patientId,
      });
      const allCoverages = (
        await oystehrClient.fhir.search<Coverage | RelatedPerson>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
            {
              name: '_include',
              value: 'Coverage:subscriber',
            },
          ],
        })
      ).unbundle();
      expect(allCoverages).toBeDefined();
      expect(allCoverages.length).toBe(2);
      const primaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === primaryCoverageRef;
      }) as Coverage;
      const secondaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === secondaryCoverageRef;
      }) as Coverage;

      expect(primaryCoverage).toBeDefined();
      expect(secondaryCoverage).toBeDefined();
      expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);

      expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
      expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

      const { secondary } = qr1ExpectedCoverageResources;
      normalizedCompare(secondary, secondaryCoverage, patientId);

      const shouldHaveNewSubscriber = writtenResources.find((res) => res.resourceType === 'Coverage') as Coverage;
      const newContained = primaryCoverage.contained?.[0] as RelatedPerson;
      expect(shouldHaveNewSubscriber.id).toEqual(primaryCoverage.id);
      expect(shouldHaveNewSubscriber.subscriber).not.toEqual(primaryCoverage.subscriber);

      expect(newContained).toBeDefined();

      const oldSubscriber = await oystehrClient.fhir.get<RelatedPerson>({
        id: shouldHaveNewSubscriber.subscriber?.reference!.split('/')[1] ?? '',
        resourceType: 'RelatedPerson',
      });
      expect(oldSubscriber).toBeDefined();
      expect(oldSubscriber.birthDate).toEqual('1990-01-01');
      expect(oldSubscriber.name).toEqual(newContained.name);
      expect(oldSubscriber.patient).toEqual(newContained.patient);

      const canceledCoverages = (
        await oystehrClient.fhir.search<Coverage>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'cancelled',
            },
          ],
        })
      ).unbundle();
      expect(canceledCoverages.length).toBe(0);
    },
    DEFAULT_TIMEOUT
  );
  it(
    'should update an existing Account to update Coverage with unmatched contained subscriber',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillWithQR1Refs(
        { ...expectedPrimaryPolicyHolderFromQR1, birthDate: '1990-01-01' },
        patientId
      );
      const persistedCoverage1 = fillWithQR1Refs(
        {
          ...qr1ExpectedCoverageResources.primary,
        },
        patientId
      );

      const batchRequests = batchTestInsuranceWrites({
        primary: {
          subscriber: persistedRP1,
          coverage: persistedCoverage1,
          ensureOrder: true,
          containedSubscriber: true,
        },
        account: fillWithQR1Refs(stubAccount, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(2);
      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

      const { primaryCoverageRef, secondaryCoverageRef } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        patientId,
      });
      const allCoverages = (
        await oystehrClient.fhir.search<Coverage | RelatedPerson>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
            {
              name: '_include',
              value: 'Coverage:subscriber',
            },
          ],
        })
      ).unbundle();
      expect(allCoverages).toBeDefined();
      expect(allCoverages.length).toBe(2);
      const primaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === primaryCoverageRef;
      }) as Coverage;
      const secondaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === secondaryCoverageRef;
      }) as Coverage;

      expect(primaryCoverage).toBeDefined();
      expect(secondaryCoverage).toBeDefined();
      expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);

      expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
      expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

      const { secondary } = qr1ExpectedCoverageResources;
      normalizedCompare(secondary, secondaryCoverage, patientId);

      const shouldHaveNewSubscriber = writtenResources.find((res) => res.resourceType === 'Coverage') as Coverage;
      const oldContained = shouldHaveNewSubscriber.contained?.[0] as RelatedPerson;
      const newContained = primaryCoverage.contained?.[0] as RelatedPerson;
      expect(shouldHaveNewSubscriber.id).toEqual(primaryCoverage.id);
      expect(newContained).toBeDefined();
      expect(oldContained).toBeDefined();
      expect(oldContained.birthDate).toEqual('1990-01-01');
      expect(oldContained.name).toEqual(newContained.name);
      expect(oldContained.patient).toEqual(newContained.patient);
      expect(oldContained).not.toEqual(newContained);

      const canceledCoverages = (
        await oystehrClient.fhir.search<Coverage>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'cancelled',
            },
          ],
        })
      ).unbundle();
      expect(canceledCoverages.length).toBe(0);
    },
    DEFAULT_TIMEOUT
  );
  it(
    'should update an existing Account to update secondary Coverage with unmatched contained subscriber',
    async () => {
      const patientId = getPatientId();
      const persistedRP2 = fillWithQR1Refs(
        { ...expectedSecondaryPolicyHolderFromQR1, birthDate: '1990-01-01' },
        patientId
      );
      const persistedCoverage2 = fillWithQR1Refs(
        {
          ...qr1ExpectedCoverageResources.secondary,
        },
        patientId
      );

      const batchRequests = batchTestInsuranceWrites({
        secondary: {
          subscriber: persistedRP2,
          coverage: persistedCoverage2,
          ensureOrder: true,
          containedSubscriber: true,
        },
        account: fillWithQR1Refs(stubAccount, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(2);
      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

      const { primaryCoverageRef, secondaryCoverageRef } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        patientId,
      });
      const allCoverages = (
        await oystehrClient.fhir.search<Coverage | RelatedPerson>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
            {
              name: '_include',
              value: 'Coverage:subscriber',
            },
          ],
        })
      ).unbundle();
      expect(allCoverages).toBeDefined();
      expect(allCoverages.length).toBe(2);
      const primaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === primaryCoverageRef;
      }) as Coverage;
      const secondaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === secondaryCoverageRef;
      }) as Coverage;

      expect(primaryCoverage).toBeDefined();
      expect(secondaryCoverage).toBeDefined();
      expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);

      expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
      expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

      const { primary } = qr1ExpectedCoverageResources;
      normalizedCompare(primary, primaryCoverage, patientId);

      const shouldHaveNewSubscriber = writtenResources.find((res) => res.resourceType === 'Coverage') as Coverage;
      const oldContained = shouldHaveNewSubscriber.contained?.[0] as RelatedPerson;
      const newContained = secondaryCoverage.contained?.[0] as RelatedPerson;
      expect(shouldHaveNewSubscriber.id).toEqual(secondaryCoverage.id);
      expect(newContained).toBeDefined();
      expect(oldContained).toBeDefined();
      expect(oldContained.birthDate).toEqual('1990-01-01');
      expect(oldContained.name).toEqual(newContained.name);
      expect(oldContained.patient).toEqual(newContained.patient);
      expect(oldContained).not.toEqual(newContained);

      const canceledCoverages = (
        await oystehrClient.fhir.search<Coverage>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'cancelled',
            },
          ],
        })
      ).unbundle();
      expect(canceledCoverages.length).toBe(0);
    },
    DEFAULT_TIMEOUT
  );
  it(
    'should correctly create an Account where primary and secondary Coverages are swapped',
    async () => {
      const patientId = getPatientId();
      const persistedRP2 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs(patientId));
      const persistedRP1 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs(patientId));
      const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs(patientId));
      const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs(patientId));

      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(4);

      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;
      const writtenPrimaryCoverage = writtenResources.find(
        (res): res is Coverage => res.resourceType === 'Coverage' && (res as Coverage).order === 1
      ) as Coverage;
      const writtenSecondaryCoverage = writtenResources.find(
        (res): res is Coverage => res.resourceType === 'Coverage' && (res as Coverage).order === 2
      ) as Coverage;

      expect(writtenAccount).toBeUndefined();
      expect(writtenPrimaryCoverage).toBeDefined();
      expect(writtenSecondaryCoverage).toBeDefined();

      const { primaryCoverageRef, secondaryCoverageRef, account } = await applyEffectAndValidateResults({
        patientId: patientId,
      });
      expect(account.coverage?.length).toBe(2);
      expect(primaryCoverageRef.startsWith('Coverage/')).toBe(true);
      expect(secondaryCoverageRef.startsWith('Coverage/')).toBe(true);
      expect(primaryCoverageRef).toEqual(`Coverage/${writtenSecondaryCoverage.id}`);
      expect(secondaryCoverageRef).toEqual(`Coverage/${writtenPrimaryCoverage.id}`);

      const allCoverages = (
        await oystehrClient.fhir.search<Coverage | RelatedPerson>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
            {
              name: '_include',
              value: 'Coverage:subscriber',
            },
          ],
        })
      ).unbundle();

      expect(allCoverages).toBeDefined();
      expect(allCoverages.length).toBe(4);
      expect(allCoverages.filter((cov) => cov.resourceType === 'Coverage').length).toBe(2);
    },
    DEFAULT_TIMEOUT
  );

  it(
    'should correctly update an Account where primary and secondary Coverages are swapped',
    async () => {
      const patientId = getPatientId();
      const persistedRP2 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs(patientId));
      const persistedRP1 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs(patientId));
      const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs(patientId));
      const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs(patientId));

      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
        account: fillWithQR1Refs(stubAccount, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(5);

      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;
      const writtenPrimaryCoverage = writtenResources.find(
        (res): res is Coverage => res.resourceType === 'Coverage' && (res as Coverage).order === 1
      ) as Coverage;
      const writtenSecondaryCoverage = writtenResources.find(
        (res): res is Coverage => res.resourceType === 'Coverage' && (res as Coverage).order === 2
      ) as Coverage;

      expect(writtenAccount).toBeDefined();
      expect(writtenPrimaryCoverage).toBeDefined();
      expect(writtenSecondaryCoverage).toBeDefined();

      const { primaryCoverageRef, secondaryCoverageRef, account } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        patientId,
      });
      expect(account.coverage?.length).toBe(2);
      expect(primaryCoverageRef.startsWith('Coverage/')).toBe(true);
      expect(secondaryCoverageRef.startsWith('Coverage/')).toBe(true);
      expect(primaryCoverageRef).toEqual(`Coverage/${writtenSecondaryCoverage.id}`);
      expect(secondaryCoverageRef).toEqual(`Coverage/${writtenPrimaryCoverage.id}`);

      const allCoverages = (
        await oystehrClient.fhir.search<Coverage | RelatedPerson>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
            {
              name: '_include',
              value: 'Coverage:subscriber',
            },
          ],
        })
      ).unbundle();

      expect(allCoverages).toBeDefined();
      expect(allCoverages.length).toBe(4);
      expect(allCoverages.filter((cov) => cov.resourceType === 'Coverage').length).toBe(2);
    },
    DEFAULT_TIMEOUT
  );

  it(
    'should correctly update an Account whose existing primary coverage becomes secondary and secondary is replaced with new Coverage',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1, patientId);
      const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs(patientId));

      const persistedRP2 = fillWithQR1Refs(expectedPrimaryPolicyHolderFromQR1, patientId);
      const persistedCoverage2 = changeCoverageMemberId(qr1ExpectedCoverageResources.primary, patientId);

      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
        account: fillWithQR1Refs(stubAccount, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(5);

      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;
      const writtenPrimaryCoverage = writtenResources.find(
        (res): res is Coverage => res.resourceType === 'Coverage' && (res as Coverage).order === 1
      ) as Coverage;
      const writtenSecondaryCoverage = writtenResources.find(
        (res): res is Coverage => res.resourceType === 'Coverage' && (res as Coverage).order === 2
      ) as Coverage;

      expect(writtenAccount).toBeDefined();
      expect(writtenPrimaryCoverage).toBeDefined();
      expect(writtenSecondaryCoverage).toBeDefined();

      const { primaryCoverageRef, secondaryCoverageRef, account } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        patientId,
      });

      expect(secondaryCoverageRef).toEqual(`Coverage/${writtenPrimaryCoverage.id}`);

      const allCoverages = (
        await oystehrClient.fhir.search<Coverage | RelatedPerson>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
            {
              name: '_include',
              value: 'Coverage:subscriber',
            },
          ],
        })
      ).unbundle();

      expect(allCoverages).toBeDefined();
      expect(allCoverages.length).toBe(3);
      const primaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === primaryCoverageRef;
      }) as Coverage;
      const secondaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === secondaryCoverageRef;
      }) as Coverage;

      expect(primaryCoverage).toBeDefined();
      expect(secondaryCoverage).toBeDefined();
      expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(account.coverage?.find((cov) => cov.coverage?.reference === secondaryCoverageRef)).toBeDefined();
    },
    DEFAULT_TIMEOUT
  );
  it(
    'should correctly update an Account whose existing secondary coverage becomes primary and primary is replaced with new Coverage',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1, patientId);
      const persistedCoverage1 = changeCoverageMemberId(qr1ExpectedCoverageResources.secondary, patientId);

      const persistedRP2 = fillWithQR1Refs(expectedPrimaryPolicyHolderFromQR1, patientId);
      const persistedCoverage2 = fillWithQR1Refs(qr1ExpectedCoverageResources.primary, patientId);

      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
        account: fillWithQR1Refs(stubAccount, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(5);

      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;
      const writtenPrimaryCoverage = writtenResources.find(
        (res): res is Coverage => res.resourceType === 'Coverage' && (res as Coverage).order === 1
      ) as Coverage;
      const writtenSecondaryCoverage = writtenResources.find(
        (res): res is Coverage => res.resourceType === 'Coverage' && (res as Coverage).order === 2
      ) as Coverage;

      expect(writtenAccount).toBeDefined();
      expect(writtenPrimaryCoverage).toBeDefined();
      expect(writtenSecondaryCoverage).toBeDefined();

      const { primaryCoverageRef, secondaryCoverageRef, account } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        patientId,
      });

      expect(primaryCoverageRef).toEqual(`Coverage/${writtenSecondaryCoverage.id}`);

      const allCoverages = (
        await oystehrClient.fhir.search<Coverage | RelatedPerson>({
          resourceType: 'Coverage',
          params: [
            {
              name: 'patient',
              value: `Patient/${patientId}`,
            },
            {
              name: 'status',
              value: 'active',
            },
            {
              name: '_include',
              value: 'Coverage:subscriber',
            },
          ],
        })
      ).unbundle();

      expect(allCoverages).toBeDefined();
      expect(allCoverages.length).toBe(3);
      const primaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === primaryCoverageRef;
      }) as Coverage;
      const secondaryCoverage = allCoverages.find((coverage) => {
        const coverageRef = `Coverage/${coverage.id}`;
        return coverageRef === secondaryCoverageRef;
      }) as Coverage;
      expect(primaryCoverage).toBeDefined();
      expect(secondaryCoverage).toBeDefined();
      expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${patientId}`);
      expect(account.coverage?.find((cov) => cov.coverage?.reference === primaryCoverageRef)).toBeDefined();
    },
    DEFAULT_TIMEOUT
  );
  it(
    'should correctly update an Account with a new guarantor when there is no existing guarantor',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1, patientId);
      const persistedCoverage1 = changeCoverageMemberId(qr1ExpectedCoverageResources.secondary, patientId);
      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        account: fillWithQR1Refs(stubAccount, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient | Organization>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(3);

      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;
      expect(writtenAccount).toBeDefined();
      expect(writtenAccount.guarantor).toBeUndefined();
      expect(writtenAccount.contained).toBeUndefined();

      const { account } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        patientId,
      });
      const containedGuarantor = account.contained?.find(
        (res) => res.resourceType === 'RelatedPerson'
      ) as RelatedPerson;
      expect(containedGuarantor).toBeDefined();
      expect(containedGuarantor).toEqual(fillWithQR1Refs(expectedAccountGuarantorFromQR1, patientId));
    },
    DEFAULT_TIMEOUT
  );
  it(
    'should make no changes to an existing contained guarantor when the input matches',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1, patientId);
      const persistedCoverage1 = changeCoverageMemberId(qr1ExpectedCoverageResources.secondary, patientId);
      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        account: fillWithQR1Refs(stubAccount, patientId),
        containedGuarantor: fillWithQR1Refs(expectedAccountGuarantorFromQR1, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient | Organization>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(3);

      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;
      expect(writtenAccount).toBeDefined();
      expect(writtenAccount.guarantor).toBeDefined();
      expect(writtenAccount.contained).toBeDefined();

      const { account } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        patientId,
      });
      const containedGuarantor = account.contained?.find(
        (res) => res.resourceType === 'RelatedPerson'
      ) as RelatedPerson;
      expect(account.contained?.length).toBe(1);
      expect(containedGuarantor).toBeDefined();
      expect({ ...containedGuarantor }).toEqual(fillWithQR1Refs(expectedAccountGuarantorFromQR1, patientId));
      expect(containedGuarantor).toEqual(writtenAccount.contained?.[0]);
    },
    DEFAULT_TIMEOUT
  );

  it(
    'should make no changes to an existing persisted guarantor when the input matches',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1, patientId);
      const persistedCoverage1 = changeCoverageMemberId(qr1ExpectedCoverageResources.secondary, patientId);
      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        account: fillWithQR1Refs(stubAccount, patientId),
        persistedGuarantor: fillWithQR1Refs(expectedAccountGuarantorFromQR1, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient | Organization>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(4);

      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;
      expect(writtenAccount).toBeDefined();
      expect(writtenAccount.guarantor).toBeDefined();
      expect(writtenAccount.contained).toBeUndefined();

      const { account, persistedGuarantor } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        guarantorRef: writtenAccount.guarantor?.[0]?.party?.reference,
        patientId,
      });
      const containedGuarantor = account.contained?.find(
        (res) => res.resourceType === 'RelatedPerson'
      ) as RelatedPerson;
      expect(containedGuarantor).toBeUndefined();
      expect(persistedGuarantor).toBeDefined();
      assert(persistedGuarantor);
      expect(`${persistedGuarantor.resourceType}/${persistedGuarantor.id}`).toEqual(
        account.guarantor?.[0]?.party?.reference
      );
    },
    DEFAULT_TIMEOUT
  );

  it(
    'should update the relationship on an existing persisted guarantor when all other input matches',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1, patientId);
      const persistedCoverage1 = changeCoverageMemberId(qr1ExpectedCoverageResources.secondary, patientId);
      const newRelationship = [
        {
          coding: [
            {
              system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
              code: 'spouse',
              display: 'Spouse',
            },
          ],
        },
      ];
      const guarantorToPersist = {
        ...expectedAccountGuarantorFromQR1,
        relationship: newRelationship,
      };
      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        account: fillWithQR1Refs(stubAccount, patientId),
        persistedGuarantor: fillWithQR1Refs(guarantorToPersist, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient | Organization>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(4);

      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;
      expect(writtenAccount).toBeDefined();
      expect(writtenAccount.guarantor).toBeDefined();
      expect(writtenAccount.contained).toBeUndefined();

      const { account, persistedGuarantor } = await applyEffectAndValidateResults({
        patientId,
        idToCheck: writtenAccount.id,
        guarantorRef: writtenAccount.guarantor?.[0]?.party?.reference,
      });
      const containedGuarantor = account.contained?.find(
        (res) => res.resourceType === 'RelatedPerson'
      ) as RelatedPerson;
      expect(containedGuarantor).toBeUndefined();
      expect(persistedGuarantor).toBeDefined();
      assert(persistedGuarantor);
      expect(`${persistedGuarantor.resourceType}/${persistedGuarantor.id}`).toEqual(
        account.guarantor?.[0]?.party?.reference
      );
      expect(persistedGuarantor.resourceType).toEqual('RelatedPerson');
      expect((persistedGuarantor as RelatedPerson).relationship).toEqual(newRelationship);
    },
    DEFAULT_TIMEOUT
  );

  it('should update guarantor from referenced Patient to contained RP when guarantor relationship != self', async () => {
    const patientId = getPatientId();
    const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1, patientId);
    const persistedCoverage1 = changeCoverageMemberId(qr1ExpectedCoverageResources.secondary, patientId);
    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      account: fillWithQR1Refs(stubAccount, patientId),
      persistedGuarantorReference: fillWithQR1Refs(`{{PATIENT_REF}}`, patientId),
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient | Organization>(
      transactionRequests
    );
    expect(writtenResources.length).toBe(3);

    const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;
    expect(writtenAccount).toBeDefined();
    expect(writtenAccount.guarantor).toBeDefined();
    expect(writtenAccount.contained).toBeUndefined();

    const { account, persistedGuarantor } = await applyEffectAndValidateResults({
      patientId,
      idToCheck: writtenAccount.id,
    });
    const containedGuarantor = account.contained?.find((res) => res.resourceType === 'RelatedPerson') as RelatedPerson;
    expect(containedGuarantor).toBeDefined();
    expect(persistedGuarantor).toBeUndefined();
    assert(containedGuarantor);
    expect(`#${containedGuarantor.id}`).toEqual(account.guarantor?.[0]?.party?.reference);
    expect(account.guarantor?.length).toBe(2);
    expect(fillWithQR1Refs(`{{PATIENT_REF}}`, patientId)).toEqual(account.guarantor?.[1]?.party?.reference);
    expect(account.guarantor?.[0]?.period?.end).toBeUndefined();
    expect(account.guarantor?.[1]?.period?.end).toBeDefined();
  });

  it(
    'should update guarantor from contained RP to referenced Patient when relationship = self',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1, patientId);
      const persistedCoverage1 = changeCoverageMemberId(qr1ExpectedCoverageResources.secondary, patientId);
      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        account: fillWithQR1Refs(stubAccount, patientId),
        containedGuarantor: fillWithQR1Refs(expectedAccountGuarantorFromQR1, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient | Organization>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(3);

      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;
      expect(writtenAccount).toBeDefined();
      expect(writtenAccount.guarantor).toBeDefined();
      expect(writtenAccount.contained).toBeDefined();
      const QR_WITH_PATIENT_GUARANTOR = { ...BASE_QR, item: replaceGuarantorWithPatient(BASE_QR.item ?? []) };
      const { account, persistedGuarantor } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        qr: QR_WITH_PATIENT_GUARANTOR,
        guarantorRef: fillWithQR1Refs(`{{PATIENT_REF}}`, patientId),
        patientId,
      });
      const containedGuarantor = account.contained?.find(
        (res) => res.resourceType === 'RelatedPerson'
      ) as RelatedPerson;
      expect(persistedGuarantor).toBeDefined();
      assert(containedGuarantor);
      expect(`#${containedGuarantor.id}`).toEqual(account.guarantor?.[1]?.party?.reference);
      expect(account.guarantor?.length).toBe(2);
      expect(fillWithQR1Refs(`{{PATIENT_REF}}`, patientId)).toEqual(account.guarantor?.[0]?.party?.reference);
      expect(account.guarantor?.[0]?.period?.end).toBeUndefined();
      expect(account.guarantor?.[1]?.period?.end).toBeDefined();
    },
    DEFAULT_TIMEOUT
  );

  it(
    'should update guarantor from referenced RP to Patient when relationship = self',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1, patientId);
      const persistedCoverage1 = changeCoverageMemberId(qr1ExpectedCoverageResources.secondary, patientId);
      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        account: fillWithQR1Refs(stubAccount, patientId),
        persistedGuarantor: fillWithQR1Refs(expectedAccountGuarantorFromQR1, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient | Organization>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(4);

      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;
      expect(writtenAccount).toBeDefined();
      expect(writtenAccount.guarantor).toBeDefined();
      expect(writtenAccount.contained).toBeUndefined();

      const qr = QR_WITH_PATIENT_GUARANTOR();
      const { account, persistedGuarantor } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        qr,
        guarantorRef: fillWithQR1Refs(`{{PATIENT_REF}}`, patientId),
        patientId,
      });
      const containedGuarantor = account.contained?.find(
        (res) => res.resourceType === 'RelatedPerson'
      ) as RelatedPerson;
      expect(containedGuarantor).toBeUndefined();
      expect(persistedGuarantor).toBeDefined();
      expect(account.guarantor?.length).toBe(2);
      expect(fillWithQR1Refs(`{{PATIENT_REF}}`, patientId)).toEqual(account.guarantor?.[0]?.party?.reference);
      expect(account.guarantor?.[0]?.period?.end).toBeUndefined();
      expect(account.guarantor?.[1]?.period?.end).toBeDefined();
      expect(account.guarantor?.[0]?.party?.reference).toEqual(
        persistedGuarantor?.resourceType + '/' + persistedGuarantor?.id
      );
    },
    DEFAULT_TIMEOUT
  );

  it(
    'should handle successive guarantor updates resulting in multiple contained RP resources',
    async () => {
      const patientId = getPatientId();
      const persistedRP1 = fillWithQR1Refs(expectedPrimaryPolicyHolderFromQR1, patientId);
      const persistedCoverage1 = changeCoverageMemberId(qr1ExpectedCoverageResources.primary, patientId);
      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        account: fillWithQR1Refs(stubAccount, patientId),
        containedGuarantor: fillWithQR1Refs(expectedAccountGuarantorFromQR1, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient | Organization>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(3);

      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;
      expect(writtenAccount).toBeDefined();
      expect(writtenAccount.guarantor).toBeDefined();
      expect(writtenAccount.contained).toBeDefined();

      const qr = QR_WITH_PATIENT_GUARANTOR();
      const { account, persistedGuarantor } = await applyEffectAndValidateResults({
        patientId,
        idToCheck: writtenAccount.id,
        qr,
        guarantorRef: fillWithQR1Refs(`{{PATIENT_REF}}`, patientId),
      });
      const containedGuarantor = account.contained?.find(
        (res) => res.resourceType === 'RelatedPerson'
      ) as RelatedPerson;
      expect(containedGuarantor).toBeDefined();
      expect(persistedGuarantor).toBeDefined();
      expect(account.guarantor?.length).toBe(2);
      expect(fillWithQR1Refs(`{{PATIENT_REF}}`, patientId)).toEqual(account.guarantor?.[0]?.party?.reference);
      expect(account.guarantor?.[0]?.period?.end).toBeUndefined();
      expect(account.guarantor?.[1]?.period?.end).toBeDefined();
      expect(account.guarantor?.[0]?.party?.reference).toEqual(
        persistedGuarantor?.resourceType + '/' + persistedGuarantor?.id
      );

      const { account: account2 } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        qr: QR_WITH_ALT_GUARANTOR(),
        patientId,
      });
      expect(account2.contained?.length).toBe(2);
      expect(account2.guarantor?.length).toBe(3);
      expect(account2.guarantor?.[0]?.party?.reference).toEqual(`#${account2.contained?.[0]?.id}`);
      expect((account2.guarantor ?? []).filter((gRef) => gRef.period?.end !== undefined).length).toBe(2);
      const uniqueContained = new Set(account2.contained?.map((res) => res.id));
      expect(uniqueContained.size).toBe(2);

      const { account: account3, persistedGuarantor: persistedGuarantor2 } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        qr, // this is the patient guarantor qr again
        guarantorRef: fillWithQR1Refs(`{{PATIENT_REF}}`, patientId),
        patientId,
      });
      const containedGuarantor2 = account3.contained?.find(
        (res) => res.resourceType === 'RelatedPerson'
      ) as RelatedPerson;
      expect(containedGuarantor2).toBeDefined();
      expect(persistedGuarantor2).toBeDefined();
      expect(account3.guarantor?.length).toBe(4);
      expect(fillWithQR1Refs(`{{PATIENT_REF}}`, patientId)).toEqual(account3.guarantor?.[0]?.party?.reference);
      expect(account.guarantor?.[0]?.period?.end).toBeUndefined();
      expect(account.guarantor?.[1]?.period?.end).toBeDefined();
      expect(account.guarantor?.[0]?.party?.reference).toEqual(
        persistedGuarantor?.resourceType + '/' + persistedGuarantor?.id
      );
      expect(account3.contained?.length).toBe(2);
    },
    DEFAULT_TIMEOUT
  );
  it(
    'should update contained primary subscriber to persisted Patient when relationship = self',
    async () => {
      const patientId = getPatientId();
      const containedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1, patientId);
      const persistedCoverage1 = changeCoverageMemberId(qr1ExpectedCoverageResources.secondary, patientId);
      const batchRequests = batchTestInsuranceWrites({
        primary: {
          subscriber: containedRP1,
          coverage: persistedCoverage1,
          ensureOrder: true,
          containedSubscriber: true,
        },
        account: fillWithQR1Refs(stubAccount, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient | Organization>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(2);

      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;
      expect(writtenAccount).toBeDefined();
      expect(writtenAccount.coverage).toBeDefined();
      const writtenPrimaryCoverage = writtenResources.find(
        (res) => res.resourceType === 'Coverage' && res.order === 1
      ) as Coverage;
      expect(writtenPrimaryCoverage).toBeDefined();
      expect(writtenPrimaryCoverage.subscriber).toBeDefined();
      expect(writtenPrimaryCoverage.contained).toBeDefined();
      expect(writtenPrimaryCoverage.contained?.[0]).toEqual(containedRP1);
      expect(writtenPrimaryCoverage.subscriber?.reference).toEqual(`#${writtenPrimaryCoverage.contained?.[0]?.id}`);
      const qr = QR_WITH_PATIENT_PRIMARY_SUBSCRIBER();
      const relationshipValue = qr.item
        ?.find((item) => item.linkId === 'payment-option-page')
        ?.item?.find((item) => item.linkId === 'patient-relationship-to-insured')?.answer?.[0]?.valueString;
      expect(relationshipValue).toBeDefined();
      expect(relationshipValue).toBe('Self');
      const { primaryCoverageRef } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        qr,
        patientId,
      });
      expect(primaryCoverageRef).toBeDefined();
      const [_, coverageId] = primaryCoverageRef.split('/');
      const persistedCoverageAndSubscriber = (
        await oystehrClient.fhir.search<Coverage | RelatedPerson | Patient>({
          resourceType: 'Coverage',
          params: [
            {
              name: '_id',
              value: coverageId,
            },
            {
              name: '_include',
              value: 'Coverage:subscriber',
            },
          ],
        })
      ).unbundle();
      const persistedCoverage = persistedCoverageAndSubscriber.find(
        (res) => res.resourceType === 'Coverage'
      ) as Coverage;
      const persistedSubscriber = persistedCoverageAndSubscriber.find(
        (res) => `${res.resourceType}/${res.id}` === persistedCoverage.subscriber?.reference
      ) as RelatedPerson;
      expect(persistedCoverage).toBeDefined();
      expect(persistedCoverage.contained).toBeUndefined();
      expect(persistedCoverage.subscriber?.reference).toEqual(fillWithQR1Refs(`{{PATIENT_REF}}`, patientId));
      expect(persistedSubscriber).toBeDefined();
      expect(`Patient/${persistedSubscriber.id}`).toEqual(persistedCoverage.subscriber?.reference);
    },
    DEFAULT_TIMEOUT
  );

  it(
    'should update contained secondary subscriber to persisted Patient when relationship = self',
    async () => {
      const patientId = getPatientId();
      const containedRP2 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1, patientId);
      const persistedCoverage2 = changeCoverageMemberId(qr1ExpectedCoverageResources.secondary, patientId);
      const batchRequests = batchTestInsuranceWrites({
        secondary: {
          subscriber: containedRP2,
          coverage: persistedCoverage2,
          ensureOrder: true,
          containedSubscriber: true,
        },
        account: fillWithQR1Refs(stubAccount, patientId),
      });

      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient | Organization>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(2);

      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;
      expect(writtenAccount).toBeDefined();
      expect(writtenAccount.coverage).toBeDefined();
      const writtenSecondaryCoverage = writtenResources.find(
        (res) => res.resourceType === 'Coverage' && res.order === 2
      ) as Coverage;
      expect(writtenSecondaryCoverage).toBeDefined();
      expect(writtenSecondaryCoverage.subscriber).toBeDefined();
      expect(writtenSecondaryCoverage.contained).toBeDefined();
      expect(writtenSecondaryCoverage.contained?.[0]).toEqual(containedRP2);
      expect(writtenSecondaryCoverage.subscriber?.reference).toEqual(`#${writtenSecondaryCoverage.contained?.[0]?.id}`);
      const qr = QR_WITH_PATIENT_SECONDARY_SUBSCRIBER();
      const relationshipValue = qr.item
        ?.find((item) => item.linkId === 'payment-option-page')
        ?.item?.find((item) => item.linkId === 'secondary-insurance')
        ?.item?.find((item) => item.linkId === 'patient-relationship-to-insured-2')?.answer?.[0]?.valueString;
      expect(relationshipValue).toBeDefined();
      expect(relationshipValue).toBe('Self');
      const { secondaryCoverageRef } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        qr,
        patientId,
      });
      expect(secondaryCoverageRef).toBeDefined();
      const [_, coverageId] = secondaryCoverageRef.split('/');
      const persistedCoverageAndSubscriber = (
        await oystehrClient.fhir.search<Coverage | RelatedPerson | Patient>({
          resourceType: 'Coverage',
          params: [
            {
              name: '_id',
              value: coverageId,
            },
            {
              name: '_include',
              value: 'Coverage:subscriber',
            },
          ],
        })
      ).unbundle();
      const persistedCoverage = persistedCoverageAndSubscriber.find(
        (res) => res.resourceType === 'Coverage'
      ) as Coverage;
      const persistedSubscriber = persistedCoverageAndSubscriber.find(
        (res) => `${res.resourceType}/${res.id}` === persistedCoverage.subscriber?.reference
      ) as RelatedPerson;
      expect(persistedCoverage).toBeDefined();
      expect(persistedCoverage.contained).toBeUndefined();
      expect(persistedCoverage.subscriber?.reference).toEqual(fillWithQR1Refs(`{{PATIENT_REF}}`, patientId));
      expect(persistedSubscriber).toBeDefined();
      expect(`Patient/${persistedSubscriber.id}`).toEqual(persistedCoverage.subscriber?.reference);
    },
    DEFAULT_TIMEOUT
  );

  it(
    'should update contained primary and secondary subscribers as well as Account guarantor to persisted Patient when relationship = self',
    async () => {
      const patientId = getPatientId();
      const containedRP1 = fillWithQR1Refs(expectedPrimaryPolicyHolderFromQR1, patientId);
      const containedRP2 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1, patientId);
      const persistedCoverage1 = changeCoverageMemberId(qr1ExpectedCoverageResources.primary, patientId);
      const persistedCoverage2 = fillWithQR1Refs(qr1ExpectedCoverageResources.secondary, patientId);
      const batchRequests = batchTestInsuranceWrites({
        primary: {
          subscriber: containedRP1,
          coverage: persistedCoverage1,
          ensureOrder: true,
          containedSubscriber: true,
        },
        secondary: {
          subscriber: containedRP2,
          coverage: persistedCoverage2,
          ensureOrder: true,
          containedSubscriber: true,
        },
        account: fillWithQR1Refs(stubAccount, patientId),
        containedGuarantor: fillWithQR1Refs(expectedAccountGuarantorFromQR1, patientId),
      });
      const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
      expect(transactionRequests).toBeDefined();
      const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient | Organization>(
        transactionRequests
      );
      expect(writtenResources.length).toBe(3);

      const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;
      expect(writtenAccount).toBeDefined();
      expect(writtenAccount.coverage).toBeDefined();
      expect(writtenAccount).toBeDefined();
      expect(writtenAccount.guarantor).toBeDefined();
      expect(writtenAccount.contained).toBeDefined();

      const writtenPrimaryCoverage = writtenResources.find(
        (res) => res.resourceType === 'Coverage' && res.order === 1
      ) as Coverage;
      expect(writtenPrimaryCoverage).toBeDefined();
      expect(writtenPrimaryCoverage.subscriber).toBeDefined();
      expect(writtenPrimaryCoverage.contained).toBeDefined();
      expect(writtenPrimaryCoverage.contained?.[0]).toEqual(containedRP1);
      expect(writtenPrimaryCoverage.subscriber?.reference).toEqual(`#${writtenPrimaryCoverage.contained?.[0]?.id}`);
      const writtenSecondaryCoverage = writtenResources.find(
        (res) => res.resourceType === 'Coverage' && res.order === 2
      ) as Coverage;
      expect(writtenSecondaryCoverage).toBeDefined();
      expect(writtenSecondaryCoverage.subscriber).toBeDefined();
      expect(writtenSecondaryCoverage.contained).toBeDefined();
      expect(writtenSecondaryCoverage.contained?.[0]).toEqual(containedRP2);
      expect(writtenSecondaryCoverage.subscriber?.reference).toEqual(`#${writtenSecondaryCoverage.contained?.[0]?.id}`);
      const qr = QR_WITH_PATIENT_FOR_ALL_SUBSCRIBERS_AND_GUARANTOR();
      const { account, secondaryCoverageRef, primaryCoverageRef, persistedGuarantor } =
        await applyEffectAndValidateResults({
          idToCheck: writtenAccount.id,
          qr,
          guarantorRef: fillWithQR1Refs(`{{PATIENT_REF}}`, patientId),
          patientId,
        });
      expect(primaryCoverageRef).toBeDefined();
      expect(secondaryCoverageRef).toBeDefined();
      const [, primaryCoverageId] = primaryCoverageRef.split('/');
      const [, secondaryCoverageId] = secondaryCoverageRef.split('/');
      const persistedPrimaryCoverageAndSubscriber = (
        await oystehrClient.fhir.search<Coverage | RelatedPerson | Patient>({
          resourceType: 'Coverage',
          params: [
            {
              name: '_id',
              value: primaryCoverageId,
            },
            {
              name: '_include',
              value: 'Coverage:subscriber',
            },
          ],
        })
      ).unbundle();
      const persistedPrimaryCoverage = persistedPrimaryCoverageAndSubscriber.find(
        (res) => res.resourceType === 'Coverage'
      ) as Coverage;
      const persistedPrimarySubscriber = persistedPrimaryCoverageAndSubscriber.find(
        (res) => `${res.resourceType}/${res.id}` === persistedPrimaryCoverage.subscriber?.reference
      ) as RelatedPerson;
      expect(persistedPrimaryCoverage).toBeDefined();
      expect(persistedPrimaryCoverage.contained).toBeUndefined();
      expect(persistedPrimaryCoverage.subscriber?.reference).toEqual(fillWithQR1Refs(`{{PATIENT_REF}}`, patientId));
      expect(persistedPrimarySubscriber).toBeDefined();
      expect(`Patient/${persistedPrimarySubscriber.id}`).toEqual(persistedPrimaryCoverage.subscriber?.reference);

      const persistedSecondaryCoverageAndSubscriber = (
        await oystehrClient.fhir.search<Coverage | RelatedPerson | Patient>({
          resourceType: 'Coverage',
          params: [
            {
              name: '_id',
              value: secondaryCoverageId,
            },
            {
              name: '_include',
              value: 'Coverage:subscriber',
            },
          ],
        })
      ).unbundle();
      const persistedSecondaryCoverage = persistedSecondaryCoverageAndSubscriber.find(
        (res) => res.resourceType === 'Coverage'
      ) as Coverage;
      const persistedSecondarySubscriber = persistedSecondaryCoverageAndSubscriber.find(
        (res) => `${res.resourceType}/${res.id}` === persistedSecondaryCoverage.subscriber?.reference
      ) as RelatedPerson;
      expect(persistedSecondaryCoverage).toBeDefined();
      expect(persistedSecondaryCoverage.contained).toBeUndefined();
      expect(persistedSecondaryCoverage.subscriber?.reference).toEqual(fillWithQR1Refs(`{{PATIENT_REF}}`, patientId));
      expect(persistedSecondarySubscriber).toBeDefined();
      expect(`Patient/${persistedSecondarySubscriber.id}`).toEqual(persistedSecondaryCoverage.subscriber?.reference);

      const containedGuarantor = account.contained?.find(
        (res) => res.resourceType === 'RelatedPerson'
      ) as RelatedPerson;
      expect(persistedGuarantor).toBeDefined();
      assert(containedGuarantor);
      expect(`#${containedGuarantor.id}`).toEqual(account.guarantor?.[1]?.party?.reference);
      expect(account.guarantor?.length).toBe(2);
      expect(fillWithQR1Refs(`{{PATIENT_REF}}`, patientId)).toEqual(account.guarantor?.[0]?.party?.reference);
      expect(account.guarantor?.[0]?.period?.end).toBeUndefined();
      expect(account.guarantor?.[1]?.period?.end).toBeDefined();
    },
    DEFAULT_TIMEOUT
  );
  it(
    'should create an Account with Patient guarantor when responsible party relationship = self',
    async () => {
      const patient = await oystehrClient.fhir.create<Patient>({
        resourceType: 'Patient',
        name: [
          {
            // cSpell:disable-next I don't know half of you half as well as I should like; and I like less than half of you half as well as you deserve.
            given: ['Bibi'],
            family: 'Baggins',
          },
        ],
        birthDate: '2025-03-27',
        gender: 'female',
        active: true,
      });
      const patientId = patient.id;
      expect(patientId).toBeDefined();
      assert(patientId);

      const freshAccount = await oystehrClient.fhir.create<Account>({
        resourceType: 'Account',
        status: 'active',
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/account-type',
              code: 'PBILLACCT',
              display: 'patient billing account',
            },
          ],
        },
        subject: [
          {
            reference: `Patient/${patientId}`,
          },
        ],
      });

      const relatedPerson = await oystehrClient.fhir.create<RelatedPerson>({
        resourceType: 'RelatedPerson',
        patient: {
          reference: `Patient/${patientId}`,
        },
        relationship: [
          {
            coding: [
              {
                code: 'user-relatedperson',
                system: 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship',
              },
            ],
          },
        ],
      });

      expect(relatedPerson).toBeDefined();

      const dummyAppt = await oystehrClient.fhir.create<Appointment>({
        resourceType: 'Appointment',
        status: 'booked',
        meta: {
          tag: [{ code: OTTEHR_MODULE.IP }],
        },
        participant: [
          {
            actor: {
              reference: `Patient/${patientId}`,
            },
            status: 'accepted',
          },
        ],
        start: '2025-03-27T10:00:00Z',
        end: '2025-03-27T10:15:00Z',
      });

      const dummyEncounter = await oystehrClient.fhir.create<Encounter>({
        resourceType: 'Encounter',
        status: 'planned',
        subject: {
          reference: `Patient/${patientId}`,
        },
        appointment: [
          {
            reference: `Appointment/${dummyAppt.id}`,
          },
        ],
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'VR',
          display: 'virtual',
        },
      });

      expect(dummyAppt).toBeDefined();
      expect(dummyAppt.id).toBeDefined();
      assert(dummyAppt.id);
      expect(dummyEncounter).toBeDefined();
      expect(dummyEncounter.id).toBeDefined();
      assert(dummyEncounter.id);
      expect(freshAccount).toBeDefined();
      expect(freshAccount.id).toBeDefined();
      assert(freshAccount.id);

      const { account, persistedGuarantor } = await applyEffectAndValidateResults({
        idToCheck: freshAccount.id,
        qr: QR_WITH_PATIENT_FOR_ALL_SUBSCRIBERS_AND_GUARANTOR(),
        guarantorRef: `Patient/${patientId}`,
        patientId,
        dummyResourceRefs: {
          appointment: `Appointment/${dummyAppt.id}`,
          encounter: `Encounter/${dummyEncounter.id}`,
        },
      });

      expect(account).toBeDefined();

      expect(account.guarantor).toBeDefined();
      expect(account.guarantor?.length).toBe(1);
      expect(account.guarantor?.[0]?.party?.reference).toEqual(`Patient/${patientId}`);
      expect(persistedGuarantor).toBeDefined();
      assert(persistedGuarantor);
      expect(persistedGuarantor.resourceType).toEqual('Patient');
      expect(persistedGuarantor.id).toEqual(patientId);

      const batchDeletes: BatchInputDeleteRequest[] = [
        {
          method: 'DELETE',
          url: `Patient/${patientId}`,
        },
        {
          method: 'DELETE',
          url: `Account/${freshAccount.id}`,
        },
      ];
      const response = await oystehrClient.fhir.transaction({
        requests: batchDeletes,
      });
      expect(response.entry).toBeDefined();
      response.entry?.forEach((entry) => {
        expect(entry.response).toBeDefined();
        expect(entry.response?.outcome?.id).toBe('ok');
      });
    },
    DEFAULT_TIMEOUT
  );
  // todo: tests for EHR updates: 1) test when no guarantor is provided; 2) test when insurance-is-secondary = true
});
