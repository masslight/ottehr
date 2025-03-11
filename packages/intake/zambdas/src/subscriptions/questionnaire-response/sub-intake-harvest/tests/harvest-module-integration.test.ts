import { describe, it, expect, assert } from 'vitest';
import * as fs from 'fs';
import { getAuth0Token } from '../../../../shared';
import { createOystehrClient } from '../../../../shared/helpers';
import baseQRItem from './data/integration-base-qr-1.json';
import {
  expectedCoverageResources as qr1ExpectedCoverageResources,
  expectedPrimaryPolicyHolderFromQR1,
  expectedSecondaryPolicyHolderFromQR1,
  expectedAccountGuarantorFromQR1,
} from './data/expected-coverage-resources-qr1';
import {
  Account,
  Coverage,
  InsurancePlan,
  Organization,
  Patient,
  QuestionnaireResponse,
  RelatedPerson,
  Resource,
} from 'fhir/r4b';
import { COVERAGE_MEMBER_IDENTIFIER_BASE, sleep, unbundleBatchPostOutput } from 'utils';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { performEffect } from '..';
import {
  batchTestInsuranceWrites,
  fillReferences,
  replaceGuarantorWithAlternate,
  replaceGuarantorWithPatient,
  replaceSubscriberWithPatient,
} from './helpers';
import { relatedPersonsAreSame } from '../helpers';
import { uuid } from 'short-uuid';

const TEST_ENCOUNTER_ID_KEY = 'test-encounter-id';
const TEST_PATIENT_ID_KEY = 'test-patient-id';
const TEST_APPOINTMENT_ID_KEY = 'test-appointment-id';
const TEST_QUESTIONNAIRE_RESPONSE_ID_KEY = 'test-questionnaire-response-id';

const TEST_CONFIG: Record<string, string> = {
  [TEST_ENCOUNTER_ID_KEY]: '9b019c97-3156-4745-b384-5dc8a60f63d2',
  [TEST_APPOINTMENT_ID_KEY]: '308c7a77-c992-45f6-b41c-00d021fe4710',
  [TEST_PATIENT_ID_KEY]: '099639e6-c89c-4bad-becf-ce15ce010f21',
  [TEST_QUESTIONNAIRE_RESPONSE_ID_KEY]: 'e5f86b53-cfc4-49f1-baa7-ac70be95589b',
};

const stubAccount: Account = {
  resourceType: 'Account',
  type: {
    coding: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/account-type',
        code: 'PBILLACCT',
        display: 'patient billing account',
      },
    ],
  },
  status: 'active',
  subject: [{ reference: `{{PATIENT_REF}}` }],
  description: 'Patient account',
};

describe('Harvest Module Integration Tests', () => {
  const envConfig = JSON.parse(fs.readFileSync('.env/local.json', 'utf8'));
  const INSURANCE_PLAN_ORG_MAP: Record<string, string> = {};
  let token: string | undefined;
  let oystehrClient: Oystehr;
  let BASE_QR: QuestionnaireResponse;

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

  const getQR1Refs = (): string[] => {
    const [key, val] = Object.entries(INSURANCE_PLAN_ORG_MAP)[0];
    const refs = [`InsurancePlan/${key}`, `Organization/${val}`, `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`];
    return refs;
  };

  const fillWithQR1Refs = (template: any): any => {
    const refs = getQR1Refs();
    return fillReferences(template, refs);
  };

  const normalizedCompare = (rawTemplate: any, rawExpectation: any): any => {
    const template = fillWithQR1Refs(rawTemplate);
    expect(template).toEqual(stripIdAndMeta(rawExpectation));
  };

  const changeCoveragerMemberId = (coverage: Coverage): Coverage => {
    const newId = uuid();
    return fillWithQR1Refs({
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
    });
  };

  const cleanup = async (): Promise<void> => {
    console.log('Cleaning up environment...');
    if (!token) {
      throw new Error('Failed to fetch auth token.');
    }
    const oystehrClient = createOystehrClient(token, envConfig);
    const createdAccount = (
      await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
          },
          {
            name: 'status',
            value: 'active',
          },
        ],
      })
    ).unbundle();
    const patientCoverages = (
      await oystehrClient.fhir.search<Coverage | RelatedPerson>({
        resourceType: 'Coverage',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
          },
          {
            name: '_include',
            value: 'Coverage:subscriber:RelatedPerson',
          },
        ],
      })
    ).unbundle();
    const deletes: BatchInputDeleteRequest[] = patientCoverages.map((res) => {
      if ((res as any).resourceType === 'Patient') {
        throw new Error('Patient should not be included in the search results');
      }
      return {
        method: 'DELETE',
        url: `${res.resourceType}/${res.id}`,
      };
    });
    if (createdAccount[0]?.id) {
      deletes.push({
        method: 'DELETE',
        url: `Account/${createdAccount[0].id}`,
      });
    }
    await oystehrClient.fhir.transaction({ requests: deletes });
  };

  interface ValidateAccountInput {
    qr?: QuestionnaireResponse;
    idToCheck?: string;
    guarantorRef?: string;
  }
  interface ValidatedAccountData {
    account: Account;
    primaryCoverageRef: string;
    secondaryCoverageRef: string;
    persistedGuarantor?: RelatedPerson | Patient;
  }
  const applyEffectAndValidateResults = async (input: ValidateAccountInput): Promise<ValidatedAccountData> => {
    const { qr, idToCheck, guarantorRef } = input;
    const effect = await performEffect({ qr: qr ?? BASE_QR, secrets: envConfig }, oystehrClient);
    expect(effect).toBe('all tasks executed successfully');
    const foundAccounts = (
      await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
      foundGuarantor = await oystehrClient.fhir.get<RelatedPerson | Patient>({ resourceType, id: resourceId });
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
    console.log('Setting up environment...');
    // Add your setup code here
    expect(process.env).toBeDefined();
    expect(envConfig).toBeDefined();

    if (!token) {
      token = await getAuth0Token(envConfig);
    }

    oystehrClient = createOystehrClient(token, envConfig);
    expect(oystehrClient).toBeDefined();
    const quesionnaireResponse = await oystehrClient.fhir.get<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      id: TEST_CONFIG[TEST_QUESTIONNAIRE_RESPONSE_ID_KEY],
    });
    expect(quesionnaireResponse).toBeDefined();
    expect(quesionnaireResponse.encounter?.reference).toEqual(`Encounter/${TEST_CONFIG[TEST_ENCOUNTER_ID_KEY]}`);

    const ipAndOrg1 = (
      await oystehrClient.fhir.search<InsurancePlan | Organization>({
        resourceType: 'InsurancePlan',
        params: [
          {
            name: 'owned-by.name:exact',
            value: 'Aetna',
          },
          {
            name: 'owned-by.active',
            value: 'true',
          },
          {
            name: 'status',
            value: 'active',
          },
          {
            name: '_include',
            value: 'InsurancePlan:owned-by',
          },
        ],
      })
    ).unbundle();

    const iPs = ipAndOrg1.filter((ip) => ip.resourceType === 'InsurancePlan') as InsurancePlan[];
    const orgs = ipAndOrg1.filter((org) => org.resourceType === 'Organization') as Organization[];
    expect(iPs.length).toBeGreaterThan(0);
    expect(orgs.length).toBeGreaterThan(0);
    iPs.forEach((ip: InsurancePlan) => {
      const ownedByReference = ip.ownedBy?.reference;
      if (ownedByReference) {
        const org = orgs.find((org) => `Organization/${org.id}` === ownedByReference);
        if (org) {
          INSURANCE_PLAN_ORG_MAP[ip.id!] = org.id!;
        }
      }
    });
    expect(Object.keys(INSURANCE_PLAN_ORG_MAP).length).toBeGreaterThan(0);

    const firstPair = Object.entries(INSURANCE_PLAN_ORG_MAP)[0];

    const [key, val] = firstPair;

    const refs = [`InsurancePlan/${key}`, `Organization/${val}`];

    const replacedItem = fillReferences(baseQRItem, refs);

    quesionnaireResponse.item = replacedItem;
    quesionnaireResponse.status = 'completed';

    BASE_QR = quesionnaireResponse;
    expect(BASE_QR).toBeDefined();
  });

  beforeEach(async () => {
    await cleanup();
  });
  afterAll(async () => {
    await cleanup();
  });

  it('should perform a sample test', async () => {
    // Add your test code here
    expect(true).toBe(true);
    const createdAccount = (
      await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
  it('should create an account with two associated coverages from the base sample QR', async () => {
    const effect = await performEffect({ qr: BASE_QR, secrets: envConfig }, oystehrClient);
    expect(effect).toBe('all tasks executed successfully');
    // give the updates a chance to propagate
    await sleep(500);

    const createdAccount = (
      await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);

    // both coverages should have contained RP as the subscriber
    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    const { primary, secondary } = qr1ExpectedCoverageResources;
    normalizedCompare(primary, primaryCoverage);
    normalizedCompare(secondary, secondaryCoverage);
  });

  it('should update existing coverages to live on the new Account when the inputs match', async () => {
    const persistedRP1 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs());
    const persistedRP2 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs());
    const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs());
    const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs());

    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
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

    const effect = await performEffect({ qr: BASE_QR, secrets: envConfig }, oystehrClient);
    expect(effect).toBe('all tasks executed successfully');

    const createdAccount = (
      await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);

    // both coverages should have the existing persisted RP as the subscriber
    expect(primaryCoverage?.subscriber?.reference).toEqual(`RelatedPerson/${writtenPrimarySubscriber.id}`);
    expect(secondaryCoverage?.subscriber?.reference).toEqual(`RelatedPerson/${writtenSecondarySubscriber.id}`);

    expect(writtenPrimaryCoverage).toEqual(primaryCoverage);
    expect(writtenSecondaryCoverage).toEqual(secondaryCoverage);
  });

  it('should update existing primary coverage to live on the new Account when the inputs match, but should create a new one for secondary if no match found', async () => {
    const persistedRP1 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs());
    const persistedRP2 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs());
    const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs());
    const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs());

    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: false },
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
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

    const effect = await performEffect({ qr: BASE_QR, secrets: envConfig }, oystehrClient);
    expect(effect).toBe('all tasks executed successfully');

    const createdAccount = (
      await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(extraCoverageJustHangingOutInFhir).toBeDefined();
    expect(extraCoverageJustHangingOutInFhir?.status).toBe('active');
    expect(extraCoverageJustHangingOutInFhir?.subscriber?.reference).toEqual(
      `RelatedPerson/${writtenSecondarySubscriber.id}`
    );

    expect(primaryCoverage?.subscriber?.reference).toEqual(`RelatedPerson/${writtenPrimarySubscriber.id}`);
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    expect(writtenPrimaryCoverage).toEqual(primaryCoverage);
    const { secondary } = qr1ExpectedCoverageResources;
    normalizedCompare(secondary, secondaryCoverage);

    expect(relatedPersonsAreSame(writtenSecondarySubscriber, secondaryCoverage?.contained?.[0] as RelatedPerson)).toBe(
      true
    );
  });

  it('should update existing secondary coverage to live on the new Account when the inputs match, but should create a new one for primary is no match found', async () => {
    const persistedRP1 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs());
    const persistedRP2 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs());
    const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs());
    const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs());

    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: false },
      secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
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

    const effect = await performEffect({ qr: BASE_QR, secrets: envConfig }, oystehrClient);
    expect(effect).toBe('all tasks executed successfully');

    const createdAccount = (
      await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(extraCoverageJustHangingOutInFhir?.status).toBe('active');
    expect(extraCoverageJustHangingOutInFhir?.subscriber?.reference).toEqual(
      `RelatedPerson/${writtenPrimarySubscriber.id}`
    );

    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual(`RelatedPerson/${writtenSecondarySubscriber.id}`);

    expect(writtenSecondaryCoverage).toEqual(secondaryCoverage);
    const { primary } = qr1ExpectedCoverageResources;
    normalizedCompare(primary, primaryCoverage);

    expect(relatedPersonsAreSame(writtenPrimarySubscriber, primaryCoverage?.contained?.[0] as RelatedPerson)).toBe(
      true
    );
  });

  it('should create two new coverages when neither matches existing coverages', async () => {
    const persistedRP1 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs());
    const persistedRP2 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs());
    const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs());
    const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs());

    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: false },
      secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: false },
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
    expect(writtenResources.length).toBe(4);

    const effect = await performEffect({ qr: BASE_QR, secrets: envConfig }, oystehrClient);
    expect(effect).toBe('all tasks executed successfully');

    const createdAccount = (
      await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);

    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    const { primary, secondary } = qr1ExpectedCoverageResources;
    normalizedCompare(primary, primaryCoverage);
    normalizedCompare(secondary, secondaryCoverage);
  });

  it('existing Account with no coverages should be updated with newly written coverages', async () => {
    const batchRequests = batchTestInsuranceWrites({ account: fillWithQR1Refs(stubAccount) });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
    expect(writtenResources.length).toBe(1);
    const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

    const effect = await performEffect({ qr: BASE_QR, secrets: envConfig }, oystehrClient);
    expect(effect).toBe('all tasks executed successfully');
    const foundAccounts = (
      await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);

    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    const { primary, secondary } = qr1ExpectedCoverageResources;
    normalizedCompare(primary, primaryCoverage);
    normalizedCompare(secondary, secondaryCoverage);
  });

  it('should update an existing Account to replace old coverage with unmatched member number, which should be updated to "cancelled', async () => {
    const persistedRP1 = fillWithQR1Refs(expectedPrimaryPolicyHolderFromQR1);
    const persistedCoverage1 = changeCoveragerMemberId(qr1ExpectedCoverageResources.primary);

    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      account: fillWithQR1Refs(stubAccount),
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
    expect(writtenResources.length).toBe(3);
    const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

    const { primaryCoverageRef, secondaryCoverageRef } = await applyEffectAndValidateResults({
      idToCheck: writtenAccount.id,
    });
    const allCoverages = (
      await oystehrClient.fhir.search<Coverage>({
        resourceType: 'Coverage',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);

    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    const { primary, secondary } = qr1ExpectedCoverageResources;
    normalizedCompare(primary, primaryCoverage);
    normalizedCompare(secondary, secondaryCoverage);

    const canceledCoverages = (
      await oystehrClient.fhir.search<Coverage>({
        resourceType: 'Coverage',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
  });
  it('should update an existing Account to update secondary Coverage with unmatched contained subscriber', async () => {
    const persistedRP2 = fillWithQR1Refs({ ...expectedSecondaryPolicyHolderFromQR1, birthDate: '1990-01-01' });
    const persistedCoverage2 = fillWithQR1Refs({
      ...qr1ExpectedCoverageResources.secondary,
    });

    const batchRequests = batchTestInsuranceWrites({
      secondary: {
        subscriber: persistedRP2,
        coverage: persistedCoverage2,
        ensureOrder: true,
        containedSubscriber: true,
      },
      account: fillWithQR1Refs(stubAccount),
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
    expect(writtenResources.length).toBe(2);
    const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

    const { primaryCoverageRef, secondaryCoverageRef } = await applyEffectAndValidateResults({
      idToCheck: writtenAccount.id,
    });
    const allCoverages = (
      await oystehrClient.fhir.search<Coverage | RelatedPerson>({
        resourceType: 'Coverage',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);

    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    const { primary } = qr1ExpectedCoverageResources;
    normalizedCompare(primary, primaryCoverage);

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
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
          },
          {
            name: 'status',
            value: 'cancelled',
          },
        ],
      })
    ).unbundle();
    expect(canceledCoverages.length).toBe(0);
  });
  it('should update an existing Account to update secondary Coverage with unmatched persisted subscriber, old subscriber should be unchanged', async () => {
    const persistedRP2 = fillWithQR1Refs({ ...expectedSecondaryPolicyHolderFromQR1, birthDate: '1990-01-01' });
    const persistedCoverage2 = fillWithQR1Refs({
      ...qr1ExpectedCoverageResources.secondary,
    });

    const batchRequests = batchTestInsuranceWrites({
      secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
      account: fillWithQR1Refs(stubAccount),
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
    expect(writtenResources.length).toBe(3);
    const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

    const { primaryCoverageRef, secondaryCoverageRef } = await applyEffectAndValidateResults({
      idToCheck: writtenAccount.id,
    });
    const allCoverages = (
      await oystehrClient.fhir.search<Coverage | RelatedPerson>({
        resourceType: 'Coverage',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);

    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    const { primary } = qr1ExpectedCoverageResources;
    normalizedCompare(primary, primaryCoverage);

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
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
          },
          {
            name: 'status',
            value: 'cancelled',
          },
        ],
      })
    ).unbundle();
    expect(canceledCoverages.length).toBe(0);
  });
  it('should update an existing Account to update Coverage with unmatched persisted subscriber, old subscriber should be unchanged', async () => {
    const persistedRP1 = fillWithQR1Refs({ ...expectedPrimaryPolicyHolderFromQR1, birthDate: '1990-01-01' });
    const persistedCoverage1 = fillWithQR1Refs({
      ...qr1ExpectedCoverageResources.primary,
    });

    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      account: fillWithQR1Refs(stubAccount),
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
    expect(writtenResources.length).toBe(3);
    const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

    const { primaryCoverageRef, secondaryCoverageRef } = await applyEffectAndValidateResults({
      idToCheck: writtenAccount.id,
    });
    const allCoverages = (
      await oystehrClient.fhir.search<Coverage | RelatedPerson>({
        resourceType: 'Coverage',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);

    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    const { secondary } = qr1ExpectedCoverageResources;
    normalizedCompare(secondary, secondaryCoverage);

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
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
          },
          {
            name: 'status',
            value: 'cancelled',
          },
        ],
      })
    ).unbundle();
    expect(canceledCoverages.length).toBe(0);
  });
  it('should update an existing Account to update Coverage with unmatched contained subscriber', async () => {
    const persistedRP1 = fillWithQR1Refs({ ...expectedPrimaryPolicyHolderFromQR1, birthDate: '1990-01-01' });
    const persistedCoverage1 = fillWithQR1Refs({
      ...qr1ExpectedCoverageResources.primary,
    });

    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true, containedSubscriber: true },
      account: fillWithQR1Refs(stubAccount),
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
    expect(writtenResources.length).toBe(2);
    const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

    const { primaryCoverageRef, secondaryCoverageRef } = await applyEffectAndValidateResults({
      idToCheck: writtenAccount.id,
    });
    const allCoverages = (
      await oystehrClient.fhir.search<Coverage | RelatedPerson>({
        resourceType: 'Coverage',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);

    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    const { secondary } = qr1ExpectedCoverageResources;
    normalizedCompare(secondary, secondaryCoverage);

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
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
          },
          {
            name: 'status',
            value: 'cancelled',
          },
        ],
      })
    ).unbundle();
    expect(canceledCoverages.length).toBe(0);
  });
  it('should update an existing Account to update secondary Coverage with unmatched contained subscriber', async () => {
    const persistedRP2 = fillWithQR1Refs({ ...expectedSecondaryPolicyHolderFromQR1, birthDate: '1990-01-01' });
    const persistedCoverage2 = fillWithQR1Refs({
      ...qr1ExpectedCoverageResources.secondary,
    });

    const batchRequests = batchTestInsuranceWrites({
      secondary: {
        subscriber: persistedRP2,
        coverage: persistedCoverage2,
        ensureOrder: true,
        containedSubscriber: true,
      },
      account: fillWithQR1Refs(stubAccount),
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
    expect(writtenResources.length).toBe(2);
    const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

    const { primaryCoverageRef, secondaryCoverageRef } = await applyEffectAndValidateResults({
      idToCheck: writtenAccount.id,
    });
    const allCoverages = (
      await oystehrClient.fhir.search<Coverage | RelatedPerson>({
        resourceType: 'Coverage',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);

    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    const { primary } = qr1ExpectedCoverageResources;
    normalizedCompare(primary, primaryCoverage);

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
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
          },
          {
            name: 'status',
            value: 'cancelled',
          },
        ],
      })
    ).unbundle();
    expect(canceledCoverages.length).toBe(0);
  });
  it('should correctly create an Account where primary and secondary Coverages are swapped', async () => {
    const persistedRP2 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs());
    const persistedRP1 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs());
    const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs());
    const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs());

    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
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

    const { primaryCoverageRef, secondaryCoverageRef, account } = await applyEffectAndValidateResults({});
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
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
  });

  it('should correctly update an Account where primary and secondary Coverages are swapped', async () => {
    const persistedRP2 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs());
    const persistedRP1 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs());
    const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs());
    const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs());

    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
      account: fillWithQR1Refs(stubAccount),
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
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
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
  });

  it('should correctly update an Account whose existing primary coverage becomes secondary and secondary is replaced with new Coverage', async () => {
    const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1);
    const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs());

    const persistedRP2 = fillWithQR1Refs(expectedPrimaryPolicyHolderFromQR1);
    const persistedCoverage2 = changeCoveragerMemberId(qr1ExpectedCoverageResources.primary);

    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
      account: fillWithQR1Refs(stubAccount),
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
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
    });

    expect(secondaryCoverageRef).toEqual(`Coverage/${writtenPrimaryCoverage.id}`);

    const allCoverages = (
      await oystehrClient.fhir.search<Coverage | RelatedPerson>({
        resourceType: 'Coverage',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(account.coverage?.find((cov) => cov.coverage?.reference === secondaryCoverageRef)).toBeDefined();
  });
  it('should correctly update an Account whose existing secondary coverage becomes primary and primary is replaced with new Coverage', async () => {
    const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1);
    const persistedCoverage1 = changeCoveragerMemberId(qr1ExpectedCoverageResources.secondary);

    const persistedRP2 = fillWithQR1Refs(expectedPrimaryPolicyHolderFromQR1);
    const persistedCoverage2 = fillWithQR1Refs(qr1ExpectedCoverageResources.primary);

    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
      account: fillWithQR1Refs(stubAccount),
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
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
    });

    expect(primaryCoverageRef).toEqual(`Coverage/${writtenSecondaryCoverage.id}`);

    const allCoverages = (
      await oystehrClient.fhir.search<Coverage | RelatedPerson>({
        resourceType: 'Coverage',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
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
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(account.coverage?.find((cov) => cov.coverage?.reference === primaryCoverageRef)).toBeDefined();
  });
  it('should correctly update an Account with a new guarantor when there is no existing guarantor', async () => {
    const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1);
    const persistedCoverage1 = changeCoveragerMemberId(qr1ExpectedCoverageResources.secondary);
    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      account: fillWithQR1Refs(stubAccount),
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
    });
    const containedGuarantor = account.contained?.find((res) => res.resourceType === 'RelatedPerson') as RelatedPerson;
    expect(containedGuarantor).toBeDefined();
    expect(containedGuarantor).toEqual(fillWithQR1Refs(expectedAccountGuarantorFromQR1));
  });
  it('should make no changes to an existing contained guarantor when the input matches', async () => {
    const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1);
    const persistedCoverage1 = changeCoveragerMemberId(qr1ExpectedCoverageResources.secondary);
    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      account: fillWithQR1Refs(stubAccount),
      containedGuarantor: fillWithQR1Refs(expectedAccountGuarantorFromQR1),
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
    });
    const containedGuarantor = account.contained?.find((res) => res.resourceType === 'RelatedPerson') as RelatedPerson;
    expect(account.contained?.length).toBe(1);
    expect(containedGuarantor).toBeDefined();
    expect({ ...containedGuarantor }).toEqual(fillWithQR1Refs(expectedAccountGuarantorFromQR1));
    expect(containedGuarantor).toEqual(writtenAccount.contained?.[0]);
  });
  it('should make no changes to an existing persisted guarantor when the input matches', async () => {
    const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1);
    const persistedCoverage1 = changeCoveragerMemberId(qr1ExpectedCoverageResources.secondary);
    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      account: fillWithQR1Refs(stubAccount),
      persistedGuarantor: fillWithQR1Refs(expectedAccountGuarantorFromQR1),
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
    });
    const containedGuarantor = account.contained?.find((res) => res.resourceType === 'RelatedPerson') as RelatedPerson;
    expect(containedGuarantor).toBeUndefined();
    expect(persistedGuarantor).toBeDefined();
    assert(persistedGuarantor);
    expect(`${persistedGuarantor.resourceType}/${persistedGuarantor.id}`).toEqual(
      account.guarantor?.[0]?.party?.reference
    );
  });
  it('should update the relationship on an existing persisted guarantor when all other input matches', async () => {
    const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1);
    const persistedCoverage1 = changeCoveragerMemberId(qr1ExpectedCoverageResources.secondary);
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
      account: fillWithQR1Refs(stubAccount),
      persistedGuarantor: fillWithQR1Refs(guarantorToPersist),
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
    });
    const containedGuarantor = account.contained?.find((res) => res.resourceType === 'RelatedPerson') as RelatedPerson;
    expect(containedGuarantor).toBeUndefined();
    expect(persistedGuarantor).toBeDefined();
    assert(persistedGuarantor);
    expect(`${persistedGuarantor.resourceType}/${persistedGuarantor.id}`).toEqual(
      account.guarantor?.[0]?.party?.reference
    );
    expect(persistedGuarantor.resourceType).toEqual('RelatedPerson');
    expect((persistedGuarantor as RelatedPerson).relationship).toEqual(newRelationship);
  });
  it('should update guarantor from referenced Patient to contained RP when guarantor relationship != self', async () => {
    const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1);
    const persistedCoverage1 = changeCoveragerMemberId(qr1ExpectedCoverageResources.secondary);
    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      account: fillWithQR1Refs(stubAccount),
      persistedGuarantorReference: fillWithQR1Refs(`{{PATIENT_REF}}`),
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
      idToCheck: writtenAccount.id,
    });
    const containedGuarantor = account.contained?.find((res) => res.resourceType === 'RelatedPerson') as RelatedPerson;
    expect(containedGuarantor).toBeDefined();
    expect(persistedGuarantor).toBeUndefined();
    assert(containedGuarantor);
    expect(`#${containedGuarantor.id}`).toEqual(account.guarantor?.[0]?.party?.reference);
    expect(account.guarantor?.length).toBe(2);
    expect(fillWithQR1Refs(`{{PATIENT_REF}}`)).toEqual(account.guarantor?.[1]?.party?.reference);
    expect(account.guarantor?.[0]?.period?.end).toBeUndefined();
    expect(account.guarantor?.[1]?.period?.end).toBeDefined();
  });
  it('should update guarantor from contained RP to referenced Patient when relationship = self', async () => {
    const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1);
    const persistedCoverage1 = changeCoveragerMemberId(qr1ExpectedCoverageResources.secondary);
    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      account: fillWithQR1Refs(stubAccount),
      containedGuarantor: fillWithQR1Refs(expectedAccountGuarantorFromQR1),
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
      guarantorRef: fillWithQR1Refs(`{{PATIENT_REF}}`),
    });
    const containedGuarantor = account.contained?.find((res) => res.resourceType === 'RelatedPerson') as RelatedPerson;
    expect(persistedGuarantor).toBeDefined();
    assert(containedGuarantor);
    expect(`#${containedGuarantor.id}`).toEqual(account.guarantor?.[1]?.party?.reference);
    expect(account.guarantor?.length).toBe(2);
    expect(fillWithQR1Refs(`{{PATIENT_REF}}`)).toEqual(account.guarantor?.[0]?.party?.reference);
    expect(account.guarantor?.[0]?.period?.end).toBeUndefined();
    expect(account.guarantor?.[1]?.period?.end).toBeDefined();
  });
  it('should update guarantor from referenced RP to Patient when relationship = self', async () => {
    const persistedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1);
    const persistedCoverage1 = changeCoveragerMemberId(qr1ExpectedCoverageResources.secondary);
    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      account: fillWithQR1Refs(stubAccount),
      persistedGuarantor: fillWithQR1Refs(expectedAccountGuarantorFromQR1),
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
      guarantorRef: fillWithQR1Refs(`{{PATIENT_REF}}`),
    });
    const containedGuarantor = account.contained?.find((res) => res.resourceType === 'RelatedPerson') as RelatedPerson;
    expect(containedGuarantor).toBeUndefined();
    expect(persistedGuarantor).toBeDefined();
    expect(account.guarantor?.length).toBe(2);
    expect(fillWithQR1Refs(`{{PATIENT_REF}}`)).toEqual(account.guarantor?.[0]?.party?.reference);
    expect(account.guarantor?.[0]?.period?.end).toBeUndefined();
    expect(account.guarantor?.[1]?.period?.end).toBeDefined();
    expect(account.guarantor?.[0]?.party?.reference).toEqual(
      persistedGuarantor?.resourceType + '/' + persistedGuarantor?.id
    );
  });
  it(
    'should handle successive guarantor updates resulting in multiple contained RP resources',
    async () => {
      const persistedRP1 = fillWithQR1Refs(expectedPrimaryPolicyHolderFromQR1);
      const persistedCoverage1 = changeCoveragerMemberId(qr1ExpectedCoverageResources.primary);
      const batchRequests = batchTestInsuranceWrites({
        primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
        account: fillWithQR1Refs(stubAccount),
        containedGuarantor: fillWithQR1Refs(expectedAccountGuarantorFromQR1),
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
        idToCheck: writtenAccount.id,
        qr,
        guarantorRef: fillWithQR1Refs(`{{PATIENT_REF}}`),
      });
      const containedGuarantor = account.contained?.find(
        (res) => res.resourceType === 'RelatedPerson'
      ) as RelatedPerson;
      expect(containedGuarantor).toBeDefined();
      expect(persistedGuarantor).toBeDefined();
      expect(account.guarantor?.length).toBe(2);
      expect(fillWithQR1Refs(`{{PATIENT_REF}}`)).toEqual(account.guarantor?.[0]?.party?.reference);
      expect(account.guarantor?.[0]?.period?.end).toBeUndefined();
      expect(account.guarantor?.[1]?.period?.end).toBeDefined();
      expect(account.guarantor?.[0]?.party?.reference).toEqual(
        persistedGuarantor?.resourceType + '/' + persistedGuarantor?.id
      );

      const { account: account2 } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        qr: QR_WITH_ALT_GUARANTOR(),
      });
      expect(account2.contained?.length).toBe(2);
      expect(account2.guarantor?.length).toBe(3);
      expect(account2.guarantor?.[0]?.party?.reference).toEqual(`#${account2.contained?.[0]?.id}`);
      expect((account2.guarantor ?? []).filter((gref) => gref.period?.end !== undefined).length).toBe(2);
      const uniqueContained = new Set(account2.contained?.map((res) => res.id));
      expect(uniqueContained.size).toBe(2);

      const { account: account3, persistedGuarantor: persistedGuarantor2 } = await applyEffectAndValidateResults({
        idToCheck: writtenAccount.id,
        qr, // this is the patient guarantor qr again
        guarantorRef: fillWithQR1Refs(`{{PATIENT_REF}}`),
      });
      const containedGuarantor2 = account3.contained?.find(
        (res) => res.resourceType === 'RelatedPerson'
      ) as RelatedPerson;
      expect(containedGuarantor2).toBeDefined();
      expect(persistedGuarantor2).toBeDefined();
      expect(account3.guarantor?.length).toBe(4);
      expect(fillWithQR1Refs(`{{PATIENT_REF}}`)).toEqual(account3.guarantor?.[0]?.party?.reference);
      expect(account.guarantor?.[0]?.period?.end).toBeUndefined();
      expect(account.guarantor?.[1]?.period?.end).toBeDefined();
      expect(account.guarantor?.[0]?.party?.reference).toEqual(
        persistedGuarantor?.resourceType + '/' + persistedGuarantor?.id
      );
      expect(account3.contained?.length).toBe(2);
    },
    { timeout: 10000 }
  );
  it('should update contained primary subscriber to persisted Patient when relationship = self', async () => {
    const containedRP1 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1);
    const persistedCoverage1 = changeCoveragerMemberId(qr1ExpectedCoverageResources.secondary);
    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: containedRP1, coverage: persistedCoverage1, ensureOrder: true, containedSubscriber: true },
      account: fillWithQR1Refs(stubAccount),
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
    });
    expect(primaryCoverageRef).toBeDefined();
    const [_, coverageId] = primaryCoverageRef.split('/');
    const persistedCoverageAndSubsriber = (
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
    const persistedCoverage = persistedCoverageAndSubsriber.find((res) => res.resourceType === 'Coverage') as Coverage;
    const persistedSubscriber = persistedCoverageAndSubsriber.find(
      (res) => `${res.resourceType}/${res.id}` === persistedCoverage.subscriber?.reference
    ) as RelatedPerson;
    expect(persistedCoverage).toBeDefined();
    expect(persistedCoverage.contained).toBeUndefined();
    expect(persistedCoverage.subscriber?.reference).toEqual(fillWithQR1Refs(`{{PATIENT_REF}}`));
    expect(persistedSubscriber).toBeDefined();
    expect(`Patient/${persistedSubscriber.id}`).toEqual(persistedCoverage.subscriber?.reference);
  });
  it('should update contained secondary subscriber to persisted Patient when relationship = self', async () => {
    const containedRP2 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1);
    const persistedCoverage2 = changeCoveragerMemberId(qr1ExpectedCoverageResources.secondary);
    const batchRequests = batchTestInsuranceWrites({
      secondary: {
        subscriber: containedRP2,
        coverage: persistedCoverage2,
        ensureOrder: true,
        containedSubscriber: true,
      },
      account: fillWithQR1Refs(stubAccount),
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
    });
    expect(secondaryCoverageRef).toBeDefined();
    const [_, coverageId] = secondaryCoverageRef.split('/');
    const persistedCoverageAndSubsriber = (
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
    const persistedCoverage = persistedCoverageAndSubsriber.find((res) => res.resourceType === 'Coverage') as Coverage;
    const persistedSubscriber = persistedCoverageAndSubsriber.find(
      (res) => `${res.resourceType}/${res.id}` === persistedCoverage.subscriber?.reference
    ) as RelatedPerson;
    expect(persistedCoverage).toBeDefined();
    expect(persistedCoverage.contained).toBeUndefined();
    expect(persistedCoverage.subscriber?.reference).toEqual(fillWithQR1Refs(`{{PATIENT_REF}}`));
    expect(persistedSubscriber).toBeDefined();
    expect(`Patient/${persistedSubscriber.id}`).toEqual(persistedCoverage.subscriber?.reference);
  });

  it('should update contained primary and secondary subscribers as well as Account guarantor to persisted Patient when relationship = self', async () => {
    const containedRP1 = fillWithQR1Refs(expectedPrimaryPolicyHolderFromQR1);
    const containedRP2 = fillWithQR1Refs(expectedSecondaryPolicyHolderFromQR1);
    const persistedCoverage1 = changeCoveragerMemberId(qr1ExpectedCoverageResources.primary);
    const persistedCoverage2 = fillWithQR1Refs(qr1ExpectedCoverageResources.secondary);
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
      account: fillWithQR1Refs(stubAccount),
      containedGuarantor: fillWithQR1Refs(expectedAccountGuarantorFromQR1),
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
        guarantorRef: fillWithQR1Refs(`{{PATIENT_REF}}`),
      });
    expect(primaryCoverageRef).toBeDefined();
    expect(secondaryCoverageRef).toBeDefined();
    const [, primaryCoverageId] = primaryCoverageRef.split('/');
    const [, secondaryCoverageId] = secondaryCoverageRef.split('/');
    const persistedPrimaryCoverageAndSubsriber = (
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
    const persistedPrimaryCoverage = persistedPrimaryCoverageAndSubsriber.find(
      (res) => res.resourceType === 'Coverage'
    ) as Coverage;
    const persistedPrimarySubscriber = persistedPrimaryCoverageAndSubsriber.find(
      (res) => `${res.resourceType}/${res.id}` === persistedPrimaryCoverage.subscriber?.reference
    ) as RelatedPerson;
    expect(persistedPrimaryCoverage).toBeDefined();
    expect(persistedPrimaryCoverage.contained).toBeUndefined();
    expect(persistedPrimaryCoverage.subscriber?.reference).toEqual(fillWithQR1Refs(`{{PATIENT_REF}}`));
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
    expect(persistedSecondaryCoverage.subscriber?.reference).toEqual(fillWithQR1Refs(`{{PATIENT_REF}}`));
    expect(persistedSecondarySubscriber).toBeDefined();
    expect(`Patient/${persistedSecondarySubscriber.id}`).toEqual(persistedSecondaryCoverage.subscriber?.reference);

    const containedGuarantor = account.contained?.find((res) => res.resourceType === 'RelatedPerson') as RelatedPerson;
    expect(persistedGuarantor).toBeDefined();
    assert(containedGuarantor);
    expect(`#${containedGuarantor.id}`).toEqual(account.guarantor?.[1]?.party?.reference);
    expect(account.guarantor?.length).toBe(2);
    expect(fillWithQR1Refs(`{{PATIENT_REF}}`)).toEqual(account.guarantor?.[0]?.party?.reference);
    expect(account.guarantor?.[0]?.period?.end).toBeUndefined();
    expect(account.guarantor?.[1]?.period?.end).toBeDefined();
  });
});
