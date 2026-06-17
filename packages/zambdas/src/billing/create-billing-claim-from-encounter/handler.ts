import { deepStrictEqual } from 'node:assert';
import Oystehr, {
  BatchInputDeleteRequest,
  BatchInputPatchRequest,
  BatchInputPostRequest,
  BatchInputPutRequest,
} from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Account,
  AccountCoverage,
  Appointment,
  Claim,
  ClaimDiagnosis,
  ClaimItem,
  CodeableConcept,
  Condition,
  Coverage,
  Encounter,
  Location,
  Organization,
  Patient,
  Person,
  Practitioner,
  Procedure,
  Reference,
  RelatedPerson,
  Resource,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  ACCOUNT_TYPE_CODE_SYSTEM,
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
  CODE_SYSTEM_CPT_MODIFIER,
  CODE_SYSTEM_OYSTEHR_CLAIM_PROCEDURE_MODIFIER,
  CODE_SYSTEM_OYSTEHR_RCM_CMS1500_REFERRING_PROVIDER_TYPE,
  CODE_SYSTEM_PROCESS_PRIORITY,
  CreateBillingClaimFromEncounterInput,
  CreateBillingClaimFromEncounterInputSchema,
  EXTENSION_URL_CPT_MODIFIER,
  FHIR_IDENTIFIER_NPI,
  FHIR_RESOURCE_NOT_FOUND,
  getCoding,
  getNPIIdentifier,
  getPayerId,
  getSecret,
  getTimezone,
  InternalError,
  isAppointmentAutoAccident,
  isAppointmentOccupationalMedicine,
  isAppointmentUrgentCare,
  isAppointmentWorkersComp,
  isValidUUID,
  MISSING_REQUEST_SECRETS,
  PARTICIPATION_CODE_SYSTEM,
  Secrets,
  SecretsKeys,
  SERVICE_CATEGORY_SYSTEM,
  TIMEZONES,
} from 'utils';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  assertDefined,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  formatZodError,
  safeJsonParse,
  sendErrors,
  ZambdaInput,
} from '../../shared';
import {
  BILLING_RESOURCE_TAG,
  BILLING_WORKING_COPY_TAG,
  createBillingClient,
  CURRENT_STATUS_TAG_SYSTEM,
  findRef,
  prepareCopy,
  prepareWorkingCopy,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../shared';

export interface CreateClaimFromEncounterParams extends CreateBillingClaimFromEncounterInput {
  secrets: NonNullable<ZambdaInput['secrets']>;
}

export type ComplexValidationOutput = { clinicalResources: ClinicalResources; billingResources: BillingResources };

// Type alias for resources relevant to billing
type BillingFhirResource =
  | Patient
  | Coverage
  | Practitioner
  | Organization
  | Location
  | Person
  | Claim
  | Account
  | RelatedPerson;

type CoverageRefs = { coverageRef: Reference; payorRef: Reference }[];
type EncounterType = 'uc' | 'wc' | 'occmed' | 'auto';

interface ClinicalResources {
  encounter: Encounter;
  patient: Patient;
  appointment: Appointment;
  accounts: Account[];
  coverages: Coverage[];
  practitioners: Practitioner[];
  location: Location;
  billingProvider: Organization;
  payors: Organization[];
  diagnoses: Array<Condition>;
  procedures: Array<Procedure>;
}

interface BillingResources {
  person?: Person;
  mainPatient?: Patient;
  accounts: Account[];
  coverages: Coverage[];
  subscribers: RelatedPerson[];
  practitioners: Practitioner[];
  renderingProvider?: Practitioner;
  serviceFacility?: Location;
  billingProvider?: Organization;
}

interface ClaimResources {
  patientId: string;
  encounter: Encounter;
  // Only patient is required, everything else will prompt for data before claim submission in the UI
  /** Ordered list of coverages. First entry is the target of the claim. */
  coverageRefs: CoverageRefs;
  serviceFacility?: Location;
  // Only rendering and billing providers handled now
  renderingProvider?: Practitioner;
  billingProvider?: Organization;
  diagnoses?: Array<Condition>;
  procedures?: Array<Procedure>;
}

type CreateClaimFromEncounterRequests = Array<
  | BatchInputPostRequest<BillingFhirResource>
  | BatchInputPatchRequest<BillingFhirResource>
  | BatchInputPutRequest<BillingFhirResource>
  | BatchInputDeleteRequest
>;

let m2mToken: string;

export async function handler(input: ZambdaInput): Promise<APIGatewayProxyResult> {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const billingOystehr = createBillingClient(m2mToken, params.secrets);
  // CW TODO: expand to helper and use in all zambdas
  const clinicalOystehr = createOystehrClient(m2mToken, params.secrets, { ignoreTags: [BILLING_RESOURCE_TAG] });

  const cvo = await complexValidation(clinicalOystehr, billingOystehr, params);

  const response = await performEffect(billingOystehr, cvo);
  return { statusCode: 200, body: JSON.stringify(response) };
}

export async function performEffect(
  billingOystehr: Oystehr,
  cvo: ComplexValidationOutput
): Promise<{ claimId: string }> {
  const { clinicalResources, billingResources } = cvo;

  const requests: CreateClaimFromEncounterRequests = [];
  const order: string[] = [];

  // Create or update main billing patient from clinical patient
  let mainPatient = billingResources.mainPatient;
  if (!mainPatient) {
    mainPatient = prepareCopy(clinicalResources.patient, clinicalResources.patient.id!);
    mainPatient.id = 'urn:uuid:main-patient';
    requests.push({ method: 'POST', url: '/Patient', resource: mainPatient, fullUrl: mainPatient.id });
    order.push('patient');
  } else {
    const updatedMainPatient = prepareCopy(clinicalResources.patient, clinicalResources.patient.id!);
    updatedMainPatient.id = mainPatient.id;
    try {
      deepStrictEqual(mainPatient, updatedMainPatient);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      mainPatient = updatedMainPatient;
      requests.push({ method: 'PUT', url: `/Patient/${mainPatient.id}`, resource: updatedMainPatient });
      order.push('patient');
    }
  }

  // Create working copy from main patient
  const claimPatient = prepareWorkingCopy(mainPatient, mainPatient.id!);
  claimPatient.id = 'urn:uuid:claim-patient';
  requests.push({ method: 'POST', url: '/Patient', resource: claimPatient, fullUrl: claimPatient.id });
  order.push('patient');

  // Sync accounts, coverages, and subscriber between clinical and billing
  let mainPatientCoverages: Coverage[] = [];
  let mainPatientSubscribers: RelatedPerson[] = [];
  const seenBillingAccountIds = new Set<string>();
  const mainPatientAccounts = clinicalResources.accounts.map((a) => {
    const existingBillingAccount = billingResources.accounts.find(
      (bac) =>
        bac.extension?.some(
          (ext) =>
            ext.url === SOURCE_IDENTIFIER_SYSTEM &&
            ext.valueReference?.reference === uuidOrUrnReference('Account', a.id!).reference
        )
    );
    if (!existingBillingAccount) {
      // No existing billing copy, create new everything
      const [covRequests, covOrder] = copyCoverageAndSubscriberForAccount(
        billingOystehr,
        clinicalResources.coverages,
        a,
        mainPatient.id!,
        clinicalResources.payors
      );
      mainPatientCoverages = covRequests
        .filter((cov): cov is BatchInputPostRequest<Coverage> => cov.method === 'POST' && cov.url === '/Coverage')
        .map((cov) => cov.resource);
      mainPatientSubscribers = covRequests
        .filter((rp): rp is BatchInputPostRequest<RelatedPerson> => rp.method === 'POST' && rp.url === '/RelatedPerson')
        .map((rp) => rp.resource);
      requests.push(...covRequests);
      order.push(...covOrder);
      const accountCopy = copyAccount(a, mainPatient.id!, mainPatientCoverages);
      requests.push({ method: 'POST', url: '/Account', resource: accountCopy });
      order.push('account');
      return accountCopy;
    } else {
      // Update billing copy if changed
      let accountCopy = copyAccount(a, mainPatient.id!, billingResources.coverages);
      accountCopy.id = existingBillingAccount.id;
      try {
        deepStrictEqual(existingBillingAccount, accountCopy);
        mainPatientCoverages = billingResources.coverages;
        mainPatientSubscribers = billingResources.subscribers;
        return existingBillingAccount;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        // This leaks coverages, but we decided it is safe to do
        const [covRequests, covOrder] = copyCoverageAndSubscriberForAccount(
          billingOystehr,
          clinicalResources.coverages,
          a,
          mainPatient.id!,
          clinicalResources.payors
        );
        mainPatientCoverages = covRequests
          .filter((cov): cov is BatchInputPostRequest<Coverage> => cov.method === 'POST' && cov.url === '/Coverage')
          .map((cov) => cov.resource);
        mainPatientSubscribers = covRequests
          .filter(
            (rp): rp is BatchInputPostRequest<RelatedPerson> => rp.method === 'POST' && rp.url === '/RelatedPerson'
          )
          .map((rp) => rp.resource);
        requests.push(...covRequests);
        order.push(...covOrder);
        accountCopy = copyAccount(a, mainPatient.id!, mainPatientCoverages);
        requests.push({ method: 'PUT', url: `/Account/${existingBillingAccount.id}`, resource: accountCopy });
        order.push('account');
        return accountCopy;
      } finally {
        seenBillingAccountIds.add(existingBillingAccount.id!);
      }
    }
  });
  billingResources.accounts
    .filter((bac) => !seenBillingAccountIds.has(bac.id!))
    .forEach((bac) => {
      requests.push({ method: 'DELETE', url: `/Account/${bac.id}` });
      order.push('account');
    });

  // Create coverage copies for working copy patient
  const claimCoverages = mainPatientCoverages
    .map((c) => {
      const [covRequests, covOrder] = copyCoverageAndSubscriber(
        billingOystehr,
        c,
        claimPatient.id!,
        clinicalResources.payors,
        c.subscriber?.reference && !c.subscriber.reference.startsWith('#')
          ? mainPatientSubscribers.find((s) => {
              return s.id === c.subscriber?.reference?.replace('RelatedPerson/', '');
            })
          : undefined,
        true
      );
      requests.push(...covRequests);
      order.push(...covOrder);
      return covRequests.find((r): r is BatchInputPostRequest<Coverage> => r.method === 'POST' && r.url === '/Coverage')
        ?.resource;
    })
    .filter((c): c is Coverage => !!c);

  // Create or update billing person that links patients
  if (billingResources.person) {
    requests.push({
      method: 'PATCH',
      url: `/Person/${billingResources.person.id!}`,
      operations: [
        {
          op: 'replace',
          path: 'link',
          value: [
            ...(billingResources.person.link ?? []),
            { target: uuidOrUrnReference('Patient', mainPatient.id!) },
            { target: uuidOrUrnReference('Patient', claimPatient.id) },
          ],
        },
      ],
      ifMatch: `W/"${billingResources.person.meta?.versionId}"`,
    });
  } else {
    requests.push({
      method: 'POST',
      url: '/Person',
      resource: {
        resourceType: 'Person',
        link: [
          { target: { reference: `Patient/${clinicalResources.patient.id!}` } },
          { target: uuidOrUrnReference('Patient', mainPatient.id!) },
          { target: uuidOrUrnReference('Patient', claimPatient.id) },
        ],
      },
    });
  }
  order.push('person');

  const encounterType = determineEncounterType(clinicalResources.appointment);

  const claim = buildClaim({
    patientId: claimPatient.id,
    encounter: clinicalResources.encounter,
    diagnoses: clinicalResources.diagnoses,
    procedures: clinicalResources.procedures,
    coverageRefs: getClaimCoveragesForEncounter(encounterType, mainPatientAccounts, claimCoverages),
    renderingProvider: billingResources.renderingProvider,
    serviceFacility: billingResources.serviceFacility,
    billingProvider: billingResources.billingProvider,
  });
  requests.push({ method: 'POST', url: '/Claim', resource: claim });
  order.push('claim');

  // Remove urns from id before submitting transaction
  requests.forEach((r) => {
    if (r.method === 'POST' && r.resource.id?.startsWith('urn:uuid:')) {
      delete r.resource.id;
    }
  });

  const txResult = await billingOystehr.fhir.transaction<BillingFhirResource>({ requests });
  const entries = (txResult.entry ?? []).map((e) => e.resource).filter(Boolean) as Resource[];

  if (entries.length !== order.length) {
    console.log(
      'Tx result does not match length of request',
      entries.length,
      txResult.entry?.length,
      order.length,
      requests.length,
      JSON.stringify(order)
    );
    throw InternalError;
  }

  const copies: Partial<ClinicalResources> = {};
  for (let i = 0; i < order.length; i++) {
    // const expected = requests[i].url.replace('/', '');
    // Remove leading slash and anything after second slash
    const secondSlash = requests[i].url.indexOf('/', 1);
    const expected = requests[i].url.slice(1, secondSlash > 0 ? secondSlash : undefined);
    if (entries[i].resourceType !== expected) {
      console.log(requests[i].url, secondSlash, expected);
      console.log(
        'Tx results out of order',
        entries.length,
        txResult.entry?.length,
        order.length,
        requests.length,
        JSON.stringify(order),
        expected
      );
      throw InternalError;
    }
    copies[order[i] as keyof ClinicalResources] = entries[i] as any;
  }
  const createdClaim = entries.find((e): e is Claim => e.resourceType === 'Claim');
  if (!createdClaim || !createdClaim.id) {
    console.log('Claim not created');
    throw InternalError;
  }

  return { claimId: createdClaim.id };
}

function uuidOrUrnReference(resourceType: BillingFhirResource['resourceType'], uuidOrUrn: string): Reference {
  return { reference: uuidOrUrnReferenceString(resourceType, uuidOrUrn) };
}

function uuidOrUrnReferenceString(resourceType: BillingFhirResource['resourceType'], uuidOrUrn: string): string {
  if (uuidOrUrn.startsWith('urn:uuid:')) {
    return uuidOrUrn;
  }
  return `${resourceType}/${uuidOrUrn}`;
}

function determineEncounterType(appointment: Appointment): EncounterType {
  if (isAppointmentUrgentCare(appointment)) {
    // Auto is a subset of UC
    if (isAppointmentAutoAccident(appointment)) {
      return 'auto';
    }
    return 'uc';
  }
  if (isAppointmentWorkersComp(appointment)) {
    return 'wc';
  }
  if (isAppointmentOccupationalMedicine(appointment)) {
    return 'occmed';
  }
  throw new Error(`Unknown appointment type: ${getCoding(appointment.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code}`);
}

export function getClaimCoveragesForEncounter(
  encounterType: EncounterType,
  mainPatientAccounts: Account[],
  claimCoverages: Coverage[]
): CoverageRefs {
  switch (encounterType) {
    case 'uc': {
      const ucAccount = mainPatientAccounts.find(
        (mpacc) => mpacc.type?.coding?.some((c) => c.system === ACCOUNT_TYPE_CODE_SYSTEM && c.code === 'PBILLACCT')
      );
      let primaryCoverage: Coverage | undefined;
      let secondaryCoverage: Coverage | undefined;
      console.log('colin', JSON.stringify(ucAccount?.coverage));
      console.log('colin', JSON.stringify(claimCoverages));
      ucAccount?.coverage?.forEach((uccov) => {
        const foundClaimCoverage = claimCoverages.find(
          (ccov) =>
            ccov.extension?.find((ccovid) => ccovid.url === SOURCE_IDENTIFIER_SYSTEM)?.valueReference?.reference ===
            uccov.coverage.reference
        );
        if (uccov.priority === 1) {
          primaryCoverage = foundClaimCoverage;
        }
        if (uccov.priority === 2) {
          secondaryCoverage = foundClaimCoverage;
        }
      });
      return [
        ...(primaryCoverage
          ? [{ coverageRef: uuidOrUrnReference('Coverage', primaryCoverage.id!), payorRef: primaryCoverage.payor[0] }]
          : []),
        ...(secondaryCoverage
          ? [
              {
                coverageRef: uuidOrUrnReference('Coverage', secondaryCoverage.id!),
                payorRef: secondaryCoverage.payor[0],
              },
            ]
          : []),
      ];
    }
    case 'wc': {
      const wcAccount = mainPatientAccounts.find(
        (mpacc) => mpacc.type?.coding?.some((c) => c.system === ACCOUNT_TYPE_CODE_SYSTEM && c.code === 'WCMOPACCT')
      );
      let wcCoverage: Coverage | undefined;
      wcAccount?.coverage?.forEach((wccov) => {
        const foundClaimCoverage = claimCoverages.find(
          (ccov) =>
            ccov.extension?.find((ccovid) => ccovid.url === SOURCE_IDENTIFIER_SYSTEM)?.valueReference?.reference ===
            wccov.coverage.reference
        );
        if (wccov.priority === 1) {
          wcCoverage = foundClaimCoverage;
        }
      });
      return [
        ...(wcCoverage
          ? [{ coverageRef: uuidOrUrnReference('Coverage', wcCoverage.id!), payorRef: wcCoverage.payor[0] }]
          : []),
      ];
    }
    case 'occmed': {
      // No insurance
      // TODO: Support non-insurance payers
      return [];
    }
    case 'auto':
      // Really depends on the case, resolve manually
      return [];
  }
}

export function copyAccount(account: Account, patientId: string, billingCoverages?: Coverage[]): Account {
  const copy = prepareCopy(account, account.id!);
  copy.subject = [uuidOrUrnReference('Patient', patientId)];
  if (billingCoverages?.length) {
    copy.coverage = account.coverage
      ?.map((acov): AccountCoverage | undefined => {
        const billingCoverage = billingCoverages?.find(
          (bcov) =>
            bcov.extension?.find((ccovid) => ccovid.url === SOURCE_IDENTIFIER_SYSTEM)?.valueReference?.reference ===
            acov.coverage.reference
        );
        if (billingCoverage) {
          return {
            coverage: uuidOrUrnReference('Coverage', billingCoverage.id!),
            priority: acov.priority,
          };
        }
        return;
      })
      .filter((cov): cov is AccountCoverage => !!cov);
  }
  return copy;
}

export function copyCoverageAndSubscriberForAccount(
  billingOystehr: Oystehr,
  coverages: Coverage[],
  account: Account,
  patientUuidOrUrn: string,
  payors: Organization[]
): [CreateClaimFromEncounterRequests, string[]] {
  const requests: CreateClaimFromEncounterRequests = [];
  const order: string[] = [];
  // Find full Coverage resources related to this Account
  coverages
    .filter((ccov) =>
      (account.coverage ?? []).some((acov) => acov.coverage.reference?.replace('Coverage/', '') === ccov.id)
    )
    .forEach((ccov) => {
      const [covRequests, covOrder] = copyCoverageAndSubscriber(billingOystehr, ccov, patientUuidOrUrn, payors);
      requests.push(...covRequests);
      order.push(...covOrder);
    });
  return [requests, order];
}

export function copyCoverageAndSubscriber(
  billingOystehr: Oystehr,
  coverage: Coverage,
  patientUuidOrUrn: string,
  payors: Organization[],
  coverageSubscriber?: RelatedPerson,
  workingCopy?: boolean
): [CreateClaimFromEncounterRequests, string[]] {
  const requests: CreateClaimFromEncounterRequests = [];
  const order: string[] = [];
  const cleanedCoverageId = coverage.id?.replace('urn:uuid:', '');
  const copy = workingCopy ? prepareWorkingCopy(coverage, coverage.id!) : prepareCopy(coverage, coverage.id!);
  copy.beneficiary = uuidOrUrnReference('Patient', patientUuidOrUrn);
  // Subscriber is patient by default, check for contained RelatedPerson
  let subscriberId = patientUuidOrUrn;
  if (copy.subscriber?.reference?.startsWith('#') && copy.contained && copy.contained.length > 0) {
    // Subscriber is contained on the coverage
    const containedSubscriber = copy.contained.find(
      (contained): contained is RelatedPerson =>
        contained.id === copy.subscriber?.reference?.replace('#', '') && contained.resourceType === 'RelatedPerson'
    );
    if (containedSubscriber) {
      const subscriber = workingCopy ? prepareWorkingCopy(containedSubscriber) : prepareCopy(containedSubscriber);
      subscriber.id = `urn:uuid:${workingCopy ? 'claim' : 'billing'}-coverage-rp-${cleanedCoverageId}`;
      subscriber.patient = uuidOrUrnReference('Patient', patientUuidOrUrn);
      requests.push({
        method: 'POST',
        url: '/RelatedPerson',
        resource: subscriber,
        fullUrl: subscriber.id,
      });
      order.push('relatedperson');
      subscriberId = subscriber.id;
      copy.contained = copy.contained.filter((contained) => contained.id !== containedSubscriber.id);
    }
  } else if (coverageSubscriber) {
    // Subscriber was found and passed in to the function
    const subscriber = workingCopy
      ? prepareWorkingCopy(coverageSubscriber, coverageSubscriber.id!)
      : prepareCopy(coverageSubscriber, coverageSubscriber.id!);
    subscriber.id = `urn:uuid:${workingCopy ? 'claim' : 'billing'}-coverage-rp-${cleanedCoverageId}`;
    requests.push({
      method: 'POST',
      url: '/RelatedPerson',
      resource: subscriber,
      fullUrl: subscriber.id,
    });
    order.push('relatedperson');
    subscriberId = subscriber.id;
  }
  copy.subscriber = uuidOrUrnReference('RelatedPerson', subscriberId);
  // Move all coverages to payer URLs
  const internalRefId = copy.payor[0].reference?.replace('Organization/', '');
  if (internalRefId && isValidUUID(internalRefId)) {
    // TODO: this does not support billing copies of non-insurance payers
    const org = payors.find((p) => p.id === internalRefId);
    const payerId = getPayerId(org);
    if (payerId) {
      copy.payor = [{ reference: billingOystehr.rcm.constructPayerUrl({ id: payerId }) }];
    }
  }
  copy.id = `urn:uuid:${workingCopy ? 'claim' : 'billing'}-coverage-${cleanedCoverageId}`;
  requests.push({
    method: 'POST',
    url: '/Coverage',
    resource: copy,
    fullUrl: copy.id,
  });
  order.push('coverage');
  return [requests, order];
}

async function getClinicalResources(
  oystehr: Oystehr,
  params: CreateClaimFromEncounterParams
): Promise<ClinicalResources> {
  const resources = (
    await oystehr.fhir.search<
      Encounter | Patient | Location | Practitioner | Account | Coverage | Condition | Procedure
    >({
      resourceType: 'Encounter',
      params: [
        {
          // By id
          name: '_id',
          value: params.encounterId,
        },
        {
          // Include patient
          name: '_include',
          value: 'Encounter:subject',
        },
        {
          // Include appointment
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          // Include location
          name: '_include',
          value: 'Encounter:location',
        },
        {
          // Include practitioners
          name: '_include',
          value: 'Encounter:practitioner',
        },
        {
          // Include accounts
          name: '_include',
          value: 'Encounter:account',
        },
        {
          // Include account coverages
          name: '_include',
          value: 'Account:coverage:Coverage',
        },
        {
          // Include diagnosis
          name: '_include',
          value: 'Encounter:diagnosis',
        },
        {
          // Reverse include procedures
          name: '_revinclude',
          value: 'Procedure:encounter:Encounter',
        },
      ],
    })
  ).unbundle();

  const encounter = resources.find((r): r is Encounter => r.resourceType === 'Encounter');
  if (!encounter) throw FHIR_RESOURCE_NOT_FOUND('Encounter');

  const patient = findRef<Patient>(resources, encounter.subject?.reference);
  if (!patient) throw FHIR_RESOURCE_NOT_FOUND('Patient');

  const appointment = findRef<Appointment>(resources, encounter.appointment?.[0].reference);
  if (!appointment) throw FHIR_RESOURCE_NOT_FOUND('Appointment');

  // TODO: consider whether these should be required
  const location = findRef<Location>(resources, encounter.location?.[0].location.reference);
  if (!location) throw FHIR_RESOURCE_NOT_FOUND('Location');

  const practitioners = resources.filter((r): r is Practitioner => r.resourceType === 'Practitioner');
  if (!practitioners.length) throw FHIR_RESOURCE_NOT_FOUND('Practitioner');

  const accounts = resources.filter((r): r is Account => r.resourceType === 'Account');
  if (!accounts.length) throw FHIR_RESOURCE_NOT_FOUND('Account');

  const coverages = resources.filter((r): r is Coverage => r.resourceType === 'Coverage');
  if (!coverages.length) throw FHIR_RESOURCE_NOT_FOUND('Coverage');

  const diagnoses = resources.filter((r): r is Condition => r.resourceType === 'Condition');
  if (!diagnoses.length) throw FHIR_RESOURCE_NOT_FOUND('Condition');

  const procedures = resources.filter((r): r is Procedure => r.resourceType === 'Procedure');
  if (!procedures.length) throw FHIR_RESOURCE_NOT_FOUND('Procedure');

  const payors = await Promise.all(
    coverages.map<Promise<Organization>>(async (c) => {
      // Assume single payor per coverage
      const payorRef = c.payor?.[0]?.reference;
      if (!payorRef) throw FHIR_RESOURCE_NOT_FOUND('Organization');
      return isValidUUID(payorRef.replace('Organization/', ''))
        ? oystehr.fhir.get<Organization>({
            resourceType: 'Organization',
            id: payorRef.replace('Organization/', ''),
          })
        : oystehr.rcm.getPayerByUrl({ url: payorRef });
    })
  );

  const defaultBillingProviderRef = params.secrets.DEFAULT_BILLING_PROVIDER;
  if (!defaultBillingProviderRef) throw FHIR_RESOURCE_NOT_FOUND('Organization');
  const billingProviders = (
    await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [
        {
          name: '_id',
          value: defaultBillingProviderRef.replace('Organization/', ''),
        },
      ],
    })
  ).unbundle();
  if (!billingProviders.length) throw FHIR_RESOURCE_NOT_FOUND('Organization');

  return {
    encounter,
    patient,
    appointment,
    practitioners,
    location,
    billingProvider: billingProviders[0],
    accounts,
    coverages,
    payors,
    diagnoses,
    procedures,
  };
}

async function findExistingBillingResources(
  billingOystehr: Oystehr,
  originals: ClinicalResources,
  secrets: Secrets
): Promise<BillingResources> {
  const personSearch = (
    await billingOystehr.fhir.search<Person | Patient | Account | Coverage | RelatedPerson>({
      resourceType: 'Person',
      params: [
        { name: 'link', value: `Patient/${originals.patient.id}` },
        { name: 'include', value: 'patient' },
        {
          // Include account coverages
          name: '_revinclude',
          value: 'Account:patient:Patient',
        },
        {
          // Include account coverages
          name: '_include',
          value: 'Account:coverage:Coverage',
        },
        {
          // Include coverage subscribers
          name: '_include',
          value: 'Coverage:subscriber:RelatedPerson',
        },
      ],
    })
  ).unbundle();
  const existingPersons = personSearch.filter((r): r is Person => r.resourceType === 'Person');
  if (existingPersons.length > 1) {
    await sendErrors(
      new Error(`More than one billing person for Patient/${originals.patient.id}`),
      getSecret(SecretsKeys.ENVIRONMENT, secrets)
    );
  }
  const existingPerson = existingPersons.length ? existingPersons[0] : undefined;
  // Main patient is the patient of record on billing app side that we stamp out per-claim copies from
  const existingMainPatients = personSearch.filter(
    (r): r is Patient =>
      r.resourceType === 'Patient' &&
      !r.meta?.tag?.some(
        (t) => t.system === BILLING_WORKING_COPY_TAG.system && t.code === BILLING_WORKING_COPY_TAG.code
      )
  );
  if (existingMainPatients.length > 1) {
    await sendErrors(
      new Error(`More than one main billing patient for Patient/${originals.patient.id}`),
      getSecret(SecretsKeys.ENVIRONMENT, secrets)
    );
  }
  const existingMainPatient = existingMainPatients.length ? existingMainPatients[0] : undefined;
  const existingAccounts = personSearch.filter((r): r is Account => r.resourceType === 'Account');
  const existingCoverages = personSearch.filter((r): r is Coverage => r.resourceType === 'Coverage');
  const existingSubscribers = personSearch.filter((r): r is RelatedPerson => r.resourceType === 'RelatedPerson');

  const serviceFacilitySearch = (
    await billingOystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        {
          name: 'identifier',
          value: `${FHIR_IDENTIFIER_NPI}|${getNPIIdentifier(originals.location)}`,
        },
      ],
    })
  ).unbundle();
  const matchingServiceFacility = serviceFacilitySearch.length > 0 ? serviceFacilitySearch[0] : undefined;

  const matchingPractitioners = (
    await Promise.all(
      originals.practitioners.map<Promise<Practitioner | undefined>>(async (p) => {
        const practitionerSearch = (
          await billingOystehr.fhir.search<Practitioner>({
            resourceType: 'Practitioner',
            params: [
              {
                name: 'identifier',
                value: `${FHIR_IDENTIFIER_NPI}|${getNPIIdentifier(p)}`,
              },
            ],
          })
        ).unbundle();
        return practitionerSearch.length > 0 ? practitionerSearch[0] : undefined;
      })
    )
  ).filter((p): p is Practitioner => !!p);
  const clinicalAttendingProviderRef = originals.encounter.participant?.find(
    (part) => part.type?.some((t) => t.coding?.find((c) => c.system === PARTICIPATION_CODE_SYSTEM)?.code === 'ATND')
  )?.individual?.reference;
  const clinicalAttendingProvider = originals.practitioners.find(
    (prac) => clinicalAttendingProviderRef && prac.id === clinicalAttendingProviderRef.replace('Practitioner/', '')
  );
  const renderingProvider = matchingPractitioners.find(
    (prac) =>
      clinicalAttendingProvider &&
      getNPIIdentifier(prac) &&
      getNPIIdentifier(clinicalAttendingProvider) &&
      getNPIIdentifier(prac)?.value === getNPIIdentifier(clinicalAttendingProvider)?.value
  );

  const billingProviderSearch = (
    await billingOystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [
        {
          name: 'identifier',
          value: `${FHIR_IDENTIFIER_NPI}|${getNPIIdentifier(originals.billingProvider)}`,
        },
      ],
    })
  ).unbundle();
  const matchingBillingProvider = billingProviderSearch.length > 0 ? billingProviderSearch[0] : undefined;

  return {
    person: existingPerson,
    mainPatient: existingMainPatient,
    accounts: existingAccounts,
    coverages: existingCoverages,
    subscribers: existingSubscribers,
    practitioners: matchingPractitioners,
    renderingProvider: renderingProvider,
    serviceFacility: matchingServiceFacility,
    billingProvider: matchingBillingProvider,
  };
}

function buildClaim(resources: ClaimResources): Claim {
  const now = new Date().toISOString().slice(0, 10);

  const claim: Claim = {
    resourceType: 'Claim',
    status: 'draft',
    meta: { tag: [{ system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' }] },
    type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: 'professional' }] },
    use: 'claim',
    created: now,
    patient: uuidOrUrnReference('Patient', resources.patientId),
    provider: resources.billingProvider?.id
      ? { reference: `Organization/${resources.billingProvider.id}` }
      : { display: 'Unknown' },
    facility: resources.serviceFacility ? { reference: `Location/${resources.serviceFacility.id}` } : undefined,
    insurer: resources.coverageRefs[0].payorRef ? resources.coverageRefs[0].payorRef : undefined,
    insurance: resources.coverageRefs.map((cov, i) => ({
      sequence: i + 1,
      focal: i === 0,
      coverage: cov.coverageRef,
    })),
    careTeam: resources.renderingProvider
      ? [
          {
            sequence: 1,
            provider: { reference: `Practitioner/${resources.renderingProvider.id}` },
            role: { coding: [{ system: CODE_SYSTEM_OYSTEHR_RCM_CMS1500_REFERRING_PROVIDER_TYPE, code: '82' }] },
          },
        ]
      : undefined,
    diagnosis: resources.diagnoses
      ? resources.diagnoses.map<ClaimDiagnosis>((dx, i) => ({
          sequence: i + 1,
          diagnosisCodeableConcept: dx.code,
        }))
      : [],
    priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
    total: undefined,
    item: resources.procedures
      ? resources.procedures.map<ClaimItem>((p, i) => ({
          sequence: i + 1,
          careTeamSequence: resources.renderingProvider ? [1] : undefined,
          diagnosisSequence: resources.diagnoses ? [1] : undefined,
          productOrService: assertDefined(p.code, 'Procedure code'),
          modifier: p.extension
            ?.flatMap<CodeableConcept | undefined>((ext) =>
              ext.url === EXTENSION_URL_CPT_MODIFIER
                ? ext.valueCodeableConcept?.coding
                    ?.map<CodeableConcept | undefined>((cc) =>
                      cc.system === CODE_SYSTEM_CPT_MODIFIER
                        ? { coding: [{ system: CODE_SYSTEM_OYSTEHR_CLAIM_PROCEDURE_MODIFIER, code: cc.code }] }
                        : undefined
                    )
                    .filter((cc): cc is CodeableConcept => !!cc)
                : undefined
            )
            .filter((cca): cca is CodeableConcept => !!cca),
          servicedPeriod: {
            start: getLocalDateOfService(
              assertDefined(resources.encounter.period?.start, 'Encounter start'),
              resources.serviceFacility
            ),
            end: resources.encounter.period?.end
              ? getLocalDateOfService(resources.encounter.period.end, resources.serviceFacility)
              : undefined,
          },
          locationCodeableConcept:
            resources.serviceFacility &&
            resources.serviceFacility.extension?.some((ext) => ext.url === CODE_SYSTEM_CMS_PLACE_OF_SERVICE)
              ? {
                  coding: [
                    {
                      system: CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
                      code: resources.serviceFacility.extension.find(
                        (ext) => ext.url === CODE_SYSTEM_CMS_PLACE_OF_SERVICE
                      )?.valueString,
                    },
                  ],
                }
              : undefined,
          net: undefined,
          quantity: { value: 1, unit: 'UN' },
        }))
      : [],
  };

  return claim;
}

function getLocalDateOfService(appointmentStart: string, location: Location | undefined): string {
  const timezone = location ? getTimezone(location) : TIMEZONES[0];
  return DateTime.fromISO(appointmentStart).setZone(timezone).toISODate()!;
}

export async function complexValidation(
  clinicalOystehr: Oystehr,
  billingOystehr: Oystehr,
  params: CreateClaimFromEncounterParams
): Promise<ComplexValidationOutput> {
  const existingClaims = (
    await billingOystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [{ name: 'identifier', value: `${ottehrIdentifierSystem('claim-encounter-id')}|${params.encounterId}` }],
    })
  ).unbundle();
  if (existingClaims.length > 0) {
    throw INVALID_INPUT_ERROR('Claim has already been created for this encounter');
  }
  const clinicalResources = await getClinicalResources(clinicalOystehr, params);
  const billingResources = await findExistingBillingResources(billingOystehr, clinicalResources, params.secrets);
  return { clinicalResources, billingResources };
}

export function validateRequestParameters(input: ZambdaInput): CreateClaimFromEncounterParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  let raw: unknown;
  try {
    raw = safeJsonParse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  const result = CreateBillingClaimFromEncounterInputSchema.safeParse(raw);
  if (!result.success) throw INVALID_INPUT_ERROR(formatZodError(result.error));

  return { ...result.data, secrets: input.secrets };
}
