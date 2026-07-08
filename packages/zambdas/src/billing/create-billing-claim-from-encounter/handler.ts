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
  Basic,
  ChargeItemDefinition,
  Claim,
  ClaimDiagnosis,
  ClaimItem,
  CodeableConcept,
  Coding,
  Condition,
  Coverage,
  Encounter,
  Location,
  Organization,
  Patient,
  Person,
  Practitioner,
  Procedure,
  Provenance,
  ProvenanceAgent,
  Reference,
  RelatedPerson,
  Resource,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  ACCOUNT_TYPE_CODE_SYSTEM,
  AR_STAGE,
  BILLING_RESOURCE_TAG,
  CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM,
  ChargeItemDefinitionDefault,
  claimStatusValuesToTags,
  CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
  CODE_SYSTEM_CPT_MODIFIER,
  CODE_SYSTEM_HL7_HCPCS,
  CODE_SYSTEM_ICD_10,
  CODE_SYSTEM_OYSTEHR_CLAIM_PROCEDURE_MODIFIER,
  CODE_SYSTEM_OYSTEHR_CLAIM_REFERRING_PROVIDER_TYPE,
  CODE_SYSTEM_PROCESS_PRIORITY,
  CODE_SYSTEM_SERVICE_CATEGORY_CODES,
  CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM,
  CPT_CODE_SYSTEM,
  EXTENSION_URL_CPT_MODIFIER,
  FHIR_IDENTIFIER_NPI,
  FHIR_RESOURCE_NOT_FOUND,
  getCandidPlanTypeCodeFromCoverage,
  getCoding,
  getDefaultClaimSubmissionExtensions,
  getNPIIdentifier,
  getPayerId,
  getPaymentVariantFromEncounter,
  getSecret,
  getTimezone,
  InternalError,
  INVALID_INPUT_ERROR,
  isAppointmentOccupationalMedicine,
  isValidUUID,
  PARTICIPATION_CODE_SYSTEM,
  PaymentVariant,
  Secrets,
  SecretsKeys,
  SERVICE_CATEGORY_SYSTEM,
  setCoveragePlanType,
  TIMEZONES,
  withArStageInitialization,
} from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  assertDefined,
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  sendErrors,
  ZambdaInput,
} from '../../shared';
import { claimProvenanceRequest, recordedNow, resolveClaimActor } from '../provenance';
import {
  AUTO_ACCIDENT_TAG_DESCRIPTION,
  AUTO_ACCIDENT_TAG_NAME,
  BILLING_WORKING_COPY_TAG,
  BillingFhirResource,
  CLAIM_TAG_SYSTEM,
  createBillingClient,
  CURRENT_STATUS_TAG_SYSTEM,
  ensureClaimInsurance,
  findRef,
  getClaimTypeCoding,
  payerDisplay,
  prepareCopy,
  prepareWorkingCopy,
  PROVIDER_ROLE_RENDERING,
  PROVIDER_ROLE_TAG,
  resourceDisplayName,
  SOURCE_IDENTIFIER_SYSTEM,
  TAG_CODE_SYSTEM,
  TAG_DESCRIPTION_URL,
  TAG_IS_SYSTEM_TAG_URL,
} from '../shared';
import { CreateClaimFromEncounterParams, validateRequestParameters } from './validateRequestParameters';

// Local const so that DEPRECATED system doesn't get imported from utils
const CODE_SYSTEM_HCPCS = 'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets'; // used by Ottehr clinical in-house meds

export type ComplexValidationOutput = { clinicalResources: ClinicalResources; billingResources: BillingResources };

type CoverageRefs = { coverageRef: Reference; payorRef: Reference }[];

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
  autoAccidentTag?: Basic;
  billingService?: Basic;
  chargeMaster?: ChargeItemDefinition;
}

interface ClaimResources {
  patientId: string;
  encounter: Encounter;
  appointment: Appointment;
  // Only patient is required, everything else will prompt for data before claim submission in the UI
  /** Ordered list of coverages. First entry is the target of the claim. */
  coverageRefs: CoverageRefs;
  serviceFacility?: Location;
  // Only rendering and billing providers handled now
  renderingProvider?: Practitioner;
  billingProvider?: Organization;
  chargeMaster?: ChargeItemDefinition;
  diagnoses?: Array<Condition>;
  procedures?: Array<Procedure>;
  billingTags?: Array<string>;
}

type CreateClaimFromEncounterRequests = Array<
  | BatchInputPostRequest<BillingFhirResource | Provenance>
  | BatchInputPatchRequest<BillingFhirResource>
  | BatchInputPutRequest<BillingFhirResource>
  | BatchInputDeleteRequest
>;

let m2mToken: string;

export async function handler(input: ZambdaInput): Promise<APIGatewayProxyResult> {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const billingOystehr = createBillingClient(m2mToken, params.secrets);
  const clinicalOystehr = createClinicalOystehrClient(m2mToken, params.secrets);

  const cvo = await complexValidation(clinicalOystehr, billingOystehr, params);
  const agent = await resolveClaimActor(billingOystehr, input.headers?.Authorization, params.secrets);

  const response = await performEffect(billingOystehr, cvo, agent);
  return { statusCode: 200, body: JSON.stringify(response) };
}

export async function performEffect(
  billingOystehr: Oystehr,
  cvo: ComplexValidationOutput,
  agent: ProvenanceAgent
): Promise<{ claimId: string }> {
  const { clinicalResources, billingResources } = cvo;

  const requests: CreateClaimFromEncounterRequests = [];
  const order: string[] = [];

  // Create or update main billing patient from clinical patient
  let mainPatient = billingResources.mainPatient;
  if (!mainPatient) {
    mainPatient = prepareCopy<Patient>(clinicalResources.patient, clinicalResources.patient.id!);
    mainPatient.id = 'urn:uuid:main-patient';
    requests.push({ method: 'POST', url: '/Patient', resource: mainPatient, fullUrl: mainPatient.id });
    order.push('patient');
  } else {
    const updatedMainPatient = prepareCopy<Patient>(clinicalResources.patient, clinicalResources.patient.id!);
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
  const mainPatientCoverages: Coverage[] = [];
  const mainPatientSubscribers: RelatedPerson[] = [];
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
      mainPatientCoverages.push(
        ...covRequests
          .filter((cov): cov is BatchInputPostRequest<Coverage> => cov.method === 'POST' && cov.url === '/Coverage')
          .map((cov) => cov.resource)
      );
      mainPatientSubscribers.push(
        ...covRequests
          .filter(
            (rp): rp is BatchInputPostRequest<RelatedPerson> => rp.method === 'POST' && rp.url === '/RelatedPerson'
          )
          .map((rp) => rp.resource)
      );
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
        mainPatientCoverages.push(...billingResources.coverages);
        mainPatientSubscribers.push(...billingResources.subscribers);
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
        mainPatientCoverages.push(
          ...covRequests
            .filter((cov): cov is BatchInputPostRequest<Coverage> => cov.method === 'POST' && cov.url === '/Coverage')
            .map((cov) => cov.resource)
        );
        mainPatientSubscribers.push(
          ...covRequests
            .filter(
              (rp): rp is BatchInputPostRequest<RelatedPerson> => rp.method === 'POST' && rp.url === '/RelatedPerson'
            )
            .map((rp) => rp.resource)
        );
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
          path: '/link',
          value: [...(billingResources.person.link ?? []), { target: uuidOrUrnReference('Patient', claimPatient.id) }],
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
          { target: uuidOrUrnReference('Patient', mainPatient.id!) },
          { target: uuidOrUrnReference('Patient', claimPatient.id) },
        ],
        extension: [
          {
            url: SOURCE_IDENTIFIER_SYSTEM,
            valueReference: {
              reference: `Patient/${clinicalResources.patient.id!}`,
            },
          },
        ],
      },
    });
  }
  order.push('person');

  // Create working copy from rendering provider
  if (billingResources.renderingProvider) {
    const claimRenderingProvider = prepareWorkingCopy(
      billingResources.renderingProvider,
      billingResources.renderingProvider.id!
    );
    claimRenderingProvider.id = 'urn:uuid:claim-rendering-provider';
    requests.push({
      method: 'POST',
      url: '/Practitioner',
      resource: claimRenderingProvider,
      fullUrl: claimRenderingProvider.id,
    });
    order.push('rendering-provider');
  }

  // Create working copy from billing provider
  if (billingResources.billingProvider) {
    const claimBillingProvider = prepareWorkingCopy(
      billingResources.billingProvider,
      billingResources.billingProvider.id!
    );
    claimBillingProvider.id = 'urn:uuid:claim-billing-provider';
    requests.push({
      method: 'POST',
      url: '/Organization',
      resource: claimBillingProvider,
      fullUrl: claimBillingProvider.id,
    });
    order.push('billing-provider');
  }

  // Create working copy from service facility
  if (billingResources.serviceFacility) {
    const claimServiceFacility = prepareWorkingCopy(
      billingResources.serviceFacility,
      billingResources.serviceFacility.id!
    );
    claimServiceFacility.id = 'urn:uuid:claim-service-facility';
    requests.push({
      method: 'POST',
      url: '/Location',
      resource: claimServiceFacility,
      fullUrl: claimServiceFacility.id,
    });
    order.push('service-facility');
  }

  const appointmentService = getService(clinicalResources.appointment);
  if (appointmentService && !billingResources.billingService) {
    requests.push({
      method: 'POST',
      url: '/Basic',
      resource: {
        resourceType: 'Basic',
        code: {
          text: appointmentService,
          coding: [{ system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: appointmentService }],
        },
      },
    });
    order.push('billing-service');
  }

  const billingTags = [];
  if (clinicalResources.appointment.description?.toLowerCase() === 'auto accident') {
    billingTags.push('auto-accident');
    if (!billingResources.autoAccidentTag) {
      requests.push({
        method: 'POST',
        url: '/Basic',
        resource: {
          resourceType: 'Basic',
          code: { text: AUTO_ACCIDENT_TAG_NAME, coding: [{ system: TAG_CODE_SYSTEM, code: 'tag' }] },
          extension: [
            { url: TAG_DESCRIPTION_URL, valueString: AUTO_ACCIDENT_TAG_DESCRIPTION },
            { url: TAG_IS_SYSTEM_TAG_URL, valueBoolean: true },
          ],
        },
      });
      order.push('auto-accident-tag');
    }
  }

  const claim = buildClaim({
    patientId: claimPatient.id,
    encounter: clinicalResources.encounter,
    appointment: clinicalResources.appointment,
    diagnoses: clinicalResources.diagnoses,
    procedures: clinicalResources.procedures,
    coverageRefs: getClaimCoveragesForEncounter(appointmentService, mainPatientAccounts, claimCoverages),
    renderingProvider: billingResources.renderingProvider,
    serviceFacility: billingResources.serviceFacility,
    billingProvider: billingResources.billingProvider,
    billingTags,
    chargeMaster: billingResources.chargeMaster,
  });
  const claimUrn = 'urn:uuid:claim';
  requests.push({ method: 'POST', url: '/Claim', resource: claim, fullUrl: claimUrn });
  order.push('claim');

  // Creation Provenance for the working claim, written in the same transaction. It targets the
  // claim's urn:uuid, which the transaction resolves to the real Claim reference.
  const creationProvenance = claimProvenanceRequest({
    targetReference: claimUrn,
    claimReference: claimUrn,
    after: claim,
    agent,
    activity: 'create',
    recorded: recordedNow(),
  });
  if (creationProvenance) {
    requests.push(creationProvenance);
    order.push('provenance');
  }

  // Remove urns from id before submitting transaction
  requests.forEach((r) => {
    if (r.method === 'POST' && r.resource.id?.startsWith('urn:uuid:')) {
      delete r.resource.id;
    }
  });

  console.log('all claim requests', JSON.stringify(requests, undefined, 2));
  const txResult = await billingOystehr.fhir.transaction<BillingFhirResource | Provenance>({ requests });
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

// Claim.insurance reference to a coverage copy, carrying the payer's name as the display so history
// records read as e.g. "Aetna (60054)" instead of a urn/id reference.
function coverageDisplayReference(coverage: Coverage): Reference {
  return { ...uuidOrUrnReference('Coverage', coverage.id!), display: coverage.payor?.[0]?.display };
}

function uuidOrUrnReferenceString(resourceType: BillingFhirResource['resourceType'], uuidOrUrn: string): string {
  if (uuidOrUrn.startsWith('urn:uuid:')) {
    return uuidOrUrn;
  }
  return `${resourceType}/${uuidOrUrn}`;
}

function getService(appointment: Appointment): string | undefined {
  return getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code;
}

export function getClaimCoveragesForEncounter(
  service: string | undefined,
  mainPatientAccounts: Account[],
  claimCoverages: Coverage[]
): CoverageRefs {
  switch (service) {
    case CODE_SYSTEM_SERVICE_CATEGORY_CODES['urgent-care']: {
      const ucAccount = mainPatientAccounts.find(
        (mpacc) => mpacc.type?.coding?.some((c) => c.system === ACCOUNT_TYPE_CODE_SYSTEM && c.code === 'PBILLACCT')
      );
      let primaryCoverage: Coverage | undefined;
      let secondaryCoverage: Coverage | undefined;
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
          ? [{ coverageRef: coverageDisplayReference(primaryCoverage), payorRef: primaryCoverage.payor[0] }]
          : []),
        ...(secondaryCoverage
          ? [{ coverageRef: coverageDisplayReference(secondaryCoverage), payorRef: secondaryCoverage.payor[0] }]
          : []),
      ];
    }
    case CODE_SYSTEM_SERVICE_CATEGORY_CODES['workers-comp']: {
      const wcAccount = mainPatientAccounts.find(
        (mpacc) => mpacc.type?.coding?.some((c) => c.system === ACCOUNT_TYPE_CODE_SYSTEM && c.code === 'WCOMPACCT')
      );
      let wcCoverage: Coverage | undefined;
      wcAccount?.coverage?.forEach((wccov) => {
        const foundClaimCoverage = claimCoverages.find(
          (ccov) =>
            ccov.extension?.find((ccovid) => ccovid.url === SOURCE_IDENTIFIER_SYSTEM)?.valueReference?.reference ===
            wccov.coverage.reference
        );
        if (foundClaimCoverage) {
          wcCoverage = foundClaimCoverage;
        }
      });
      return [
        ...(wcCoverage ? [{ coverageRef: coverageDisplayReference(wcCoverage), payorRef: wcCoverage.payor[0] }] : []),
      ];
    }
    case CODE_SYSTEM_SERVICE_CATEGORY_CODES['occupational-medicine']: {
      // No insurance
      // TODO: Support non-insurance payers
      return [];
    }
    case CODE_SYSTEM_SERVICE_CATEGORY_CODES['pre-op']: {
      // No insurance
      // TODO: Support non-insurance payers
      return [];
    }
    default: {
      // "Non-system" service, take no action here
      return [];
    }
  }
}

export function copyAccount(account: Account, patientId: string, billingCoverages?: Coverage[]): Account {
  const copy = prepareCopy<Account>(account, account.id!);
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
  let copy = workingCopy
    ? prepareWorkingCopy<Coverage>(coverage, coverage.id!)
    : prepareCopy<Coverage>(coverage, coverage.id!);
  copy.beneficiary = uuidOrUrnReference('Patient', patientUuidOrUrn);
  // Subscriber is patient by default, check for contained RelatedPerson
  let subscriberId = patientUuidOrUrn;
  if (coverage.subscriber?.reference?.startsWith('#') && coverage.contained && coverage.contained.length > 0) {
    // Subscriber is contained on the coverage
    const containedSubscriber = coverage.contained.find(
      (contained): contained is RelatedPerson =>
        contained.id === coverage.subscriber?.reference?.replace('#', '') && contained.resourceType === 'RelatedPerson'
    );
    if (containedSubscriber) {
      const subscriber = workingCopy
        ? prepareWorkingCopy<RelatedPerson>(containedSubscriber)
        : prepareCopy<RelatedPerson>(containedSubscriber);
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
    }
  } else if (coverageSubscriber) {
    // Subscriber was found and passed in to the function
    const subscriber = workingCopy
      ? prepareWorkingCopy<RelatedPerson>(coverageSubscriber, coverageSubscriber.id!)
      : prepareCopy<RelatedPerson>(coverageSubscriber, coverageSubscriber.id!);
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
  // Move all coverages to payer URLs, carrying the payer's display name so downstream references
  // (claim.insurer, history records) stay human-readable.
  const payorRef = copy.payor[0].reference;
  const internalRefId = payorRef?.replace('Organization/', '');
  if (internalRefId && isValidUUID(internalRefId)) {
    // TODO: this does not support billing copies of non-insurance payers
    const org = payors.find((p) => p.id === internalRefId);
    const payerId = getPayerId(org);
    if (payerId) {
      copy.payor = [{ reference: billingOystehr.rcm.constructPayerUrl({ id: payerId }), display: payerDisplay(org) }];
    }
  } else if (payorRef && !copy.payor[0].display) {
    // Payor is already a payer URL: resolve its display from the payer organizations fetched upstream.
    const org = payors.find((p) => {
      const payerId = getPayerId(p);
      return payerId && billingOystehr.rcm.constructPayerUrl({ id: payerId }) === payorRef;
    });
    if (org) copy.payor = [{ reference: payorRef, display: payerDisplay(org) }];
  }
  const planTypeCode = getCandidPlanTypeCodeFromCoverage(coverage);
  if (planTypeCode) copy = setCoveragePlanType(copy, planTypeCode);
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
    await oystehr.fhir.search<Encounter | Patient | Location | Practitioner | Account | Condition | Procedure>({
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

  let diagnoses = resources.filter((r): r is Condition => r.resourceType === 'Condition');
  if (!diagnoses.length) throw FHIR_RESOURCE_NOT_FOUND('Condition');
  const primaryDiagnosisId = encounter.diagnosis
    ?.find((d) => d.rank === 1)
    ?.condition.reference?.replace('Condition/', '');
  if (primaryDiagnosisId) {
    const primaryDiagnosis = diagnoses.find((d) => d.id === primaryDiagnosisId);
    diagnoses = [
      ...(primaryDiagnosis ? [primaryDiagnosis] : []),
      ...diagnoses.filter((d) => d.id !== primaryDiagnosisId),
    ];
  }

  const procedures = resources.filter((r): r is Procedure => r.resourceType === 'Procedure');
  if (!procedures.length) throw FHIR_RESOURCE_NOT_FOUND('Procedure');

  // Manually look up coverages because FHIR doesn't support Account:coverage include
  const coverageIds = accounts.flatMap<string>((account) =>
    (account.coverage ?? [])
      .map<string | undefined>((coverage) => coverage.coverage.reference?.replace('Coverage/', ''))
      .filter<string>((coverageId): coverageId is string => !!coverageId)
  );
  let coverages: Coverage[] = [];
  if (coverageIds.length > 0) {
    coverages = (
      await oystehr.fhir.search<Coverage>({
        resourceType: 'Coverage',
        params: [{ name: '_id', value: coverageIds.join(',') }],
      })
    ).unbundle();
  }
  if (coverageIds.length && !coverages.length) throw FHIR_RESOURCE_NOT_FOUND('Coverage');

  // Manually look up payors because they may be internal Organization resources or Oystehr RCM payer URLs
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

  const defaultBillingProviderRef = params.secrets.DEFAULT_BILLING_RESOURCE;
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
  clinicalResources: ClinicalResources,
  secrets: Secrets
): Promise<BillingResources> {
  // Find billing cross-Patient Person resource
  const personSearch = (
    await billingOystehr.fhir.search<Person | Patient | Account>({
      resourceType: 'Person',
      params: [
        { name: 'link', value: `Patient/${clinicalResources.patient.id}` },
        { name: '_include', value: 'Person:patient' },
        {
          // Include account coverages
          name: '_revinclude',
          value: 'Account:patient:Patient',
        },
      ],
    })
  ).unbundle();
  const existingPersons = personSearch.filter((r): r is Person => r.resourceType === 'Person');
  if (existingPersons.length > 1) {
    await sendErrors(
      new Error(`More than one billing person for Patient/${clinicalResources.patient.id}`),
      getSecret(SecretsKeys.ENVIRONMENT, secrets)
    );
  }
  const existingPerson = existingPersons.length ? existingPersons[0] : undefined;

  // Main patient is the patient of record on billing app side that we stamp out per-claim copies from
  const existingMainPatients = personSearch.filter(
    (r): r is Patient =>
      r.resourceType === 'Patient' &&
      !!r.meta?.tag?.some((t) => t.system === BILLING_RESOURCE_TAG.system && t.code === BILLING_RESOURCE_TAG.code) &&
      !r.meta?.tag?.some(
        (t) => t.system === BILLING_WORKING_COPY_TAG.system && t.code === BILLING_WORKING_COPY_TAG.code
      )
  );
  if (existingMainPatients.length > 1) {
    await sendErrors(
      new Error(`More than one main billing patient for Patient/${clinicalResources.patient.id}`),
      getSecret(SecretsKeys.ENVIRONMENT, secrets)
    );
  }
  const existingMainPatient = existingMainPatients.length ? existingMainPatients[0] : undefined;

  // Account resources that link billing-side Coverages with the main billing Patient
  const existingAccounts = personSearch.filter((r): r is Account => r.resourceType === 'Account');

  // Separately look up coverages and subscribers because FHIR doesn't support Account:coverage include
  const coverageIds = existingAccounts.flatMap<string>((account) =>
    (account.coverage ?? [])
      .map<string | undefined>((coverage) => coverage.coverage.reference?.replace('Coverage/', ''))
      .filter<string>((coverageId): coverageId is string => !!coverageId)
  );
  let existingCoverages: Coverage[] = [];
  let existingSubscribers: RelatedPerson[] = [];
  if (coverageIds.length > 0) {
    const coverageSearch = (
      await billingOystehr.fhir.search<Coverage | RelatedPerson>({
        resourceType: 'Coverage',
        params: [
          { name: '_id', value: coverageIds.join(',') },
          {
            // Include coverage subscribers
            name: '_include',
            value: 'Coverage:subscriber',
          },
        ],
      })
    ).unbundle();
    existingCoverages = coverageSearch.filter((r): r is Coverage => r.resourceType === 'Coverage');
    existingSubscribers = coverageSearch.filter((r): r is RelatedPerson => r.resourceType === 'RelatedPerson');
  }

  // Look for a service facility matching the clinical Location's NPI
  const serviceFacilitySearch = (
    await billingOystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        {
          name: 'identifier',
          value: `${FHIR_IDENTIFIER_NPI}|${getNPIIdentifier(clinicalResources.location)?.value}`,
        },
        {
          name: 'status',
          value: 'active',
        },
      ],
    })
  ).unbundle();
  const matchingServiceFacility = serviceFacilitySearch.length > 0 ? serviceFacilitySearch[0] : undefined;

  // Look for rendering providers that match NPIs for Practitioners involved in the Encounter
  const matchingPractitioners = (
    await Promise.all(
      clinicalResources.practitioners.map<Promise<Practitioner | undefined>>(async (p) => {
        const practitionerSearch = (
          await billingOystehr.fhir.search<Practitioner>({
            resourceType: 'Practitioner',
            params: [
              {
                name: 'identifier',
                value: `${FHIR_IDENTIFIER_NPI}|${getNPIIdentifier(p)?.value}`,
              },
              {
                name: '_tag',
                value: `${PROVIDER_ROLE_TAG}|${PROVIDER_ROLE_RENDERING}`,
              },
            ],
          })
        ).unbundle();
        return practitionerSearch.length > 0 ? practitionerSearch[0] : undefined;
      })
    )
  ).filter((p): p is Practitioner => !!p);
  const clinicalAttendingProviderRef = clinicalResources.encounter.participant?.find(
    (part) => part.type?.some((t) => t.coding?.find((c) => c.system === PARTICIPATION_CODE_SYSTEM)?.code === 'ATND')
  )?.individual?.reference;
  const clinicalAttendingProvider = clinicalResources.practitioners.find(
    (prac) => clinicalAttendingProviderRef && prac.id === clinicalAttendingProviderRef.replace('Practitioner/', '')
  );
  const renderingProvider = matchingPractitioners.find(
    (prac) =>
      clinicalAttendingProvider &&
      getNPIIdentifier(prac) &&
      getNPIIdentifier(clinicalAttendingProvider) &&
      getNPIIdentifier(prac)?.value === getNPIIdentifier(clinicalAttendingProvider)?.value
  );

  // Look for the billing provider with an NPI matching the clinical "default billing resource"
  const billingProviderSearch = (
    await billingOystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [
        {
          name: 'identifier',
          value: `${FHIR_IDENTIFIER_NPI}|${getNPIIdentifier(clinicalResources.billingProvider)?.value}`,
        },
      ],
    })
  ).unbundle();
  const matchingBillingProvider = billingProviderSearch.length > 0 ? billingProviderSearch[0] : undefined;

  // Look for the auto-accident tag
  const tagSearch = (
    await billingOystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [{ name: 'code', value: `${TAG_CODE_SYSTEM}|tag` }],
    })
  ).unbundle();
  const autoAccidentTag = tagSearch.find((tag) => tag.code.text === AUTO_ACCIDENT_TAG_NAME);

  // Look for the "billing service" (urgent-care, workers-comp, etc) matching the appointment's serviceCategory
  let billingService: Basic | undefined;
  const appointmentService = getService(clinicalResources.appointment);
  if (appointmentService) {
    const serviceSearch = (
      await billingOystehr.fhir.search<Basic>({
        resourceType: 'Basic',
        params: [{ name: 'code', value: `${CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM}|${appointmentService}` }],
      })
    ).unbundle();
    if (serviceSearch.length) {
      billingService = serviceSearch[0];
    }
  }

  // Determine the payment variant and look up the correct charge master to use for service line prices
  const paymentVariant = getPaymentVariantFromEncounter(clinicalResources.encounter);
  let chargeMasterDefault: ChargeItemDefinitionDefault | undefined;
  if (paymentVariant === PaymentVariant.insurance) {
    chargeMasterDefault = 'insurance';
  } else if (paymentVariant === PaymentVariant.selfPay) {
    chargeMasterDefault = 'self-pay';
  }
  let chargeMaster: ChargeItemDefinition | undefined;
  if (chargeMasterDefault) {
    const cidSearch = (
      await billingOystehr.fhir.search<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        params: [
          {
            name: 'status',
            value: 'active',
          },
          {
            name: 'date',
            value: `lt${new Date().toISOString()}`,
          },
          {
            name: '_tag',
            value: `${CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM}|${chargeMasterDefault}`,
          },
          {
            name: '_sort',
            value: 'date',
          },
        ],
      })
    ).unbundle();
    if (cidSearch.length) {
      chargeMaster = cidSearch[0];
    }
  }

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
    autoAccidentTag,
    billingService,
    chargeMaster,
  };
}

// Initial AR Stage for a claim built from an encounter. Precedence (first match wins): the visit's
// payment selection (employer / insurance / self), then an occupational-medicine visit, then whether
// any coverage is present. Workers'-comp carries a WC coverage, so it falls out as Insurance Payer AR.
export function determineArStage(resources: ClaimResources): string {
  const paymentVariant = getPaymentVariantFromEncounter(resources.encounter);
  if (paymentVariant === PaymentVariant.employer) return AR_STAGE.nonInsurancePayer;
  if (paymentVariant === PaymentVariant.insurance) return AR_STAGE.insurancePayer;
  if (paymentVariant === PaymentVariant.selfPay) return AR_STAGE.patient;
  if (isAppointmentOccupationalMedicine(resources.appointment)) return AR_STAGE.nonInsurancePayer;
  return resources.coverageRefs.length > 0 ? AR_STAGE.insurancePayer : AR_STAGE.patient;
}

function buildClaim(resources: ClaimResources): Claim {
  const now = new Date().toISOString().slice(0, 10);
  const serviceCoding = getServiceCoding(resources.appointment);

  // AR Stage tag + the stage's auto-initialized progress status (e.g. Insurance AR Status -> "Created").
  const claimStatusTags = claimStatusValuesToTags(withArStageInitialization({ arStage: determineArStage(resources) }));

  let total = 0;
  const claim: Claim = {
    resourceType: 'Claim',
    identifier: [
      // Backlink to the source clinical encounter; also the key complexValidation() dedups on.
      { system: ottehrIdentifierSystem('claim-encounter-id'), value: resources.encounter.id! },
      // Backlink to the source clinical appointment — the EHR /visit/<id> route key for jumping to clinical.
      { system: ottehrIdentifierSystem('claim-appointment-id'), value: resources.appointment.id! },
    ],
    status: 'draft',
    meta: {
      tag: [
        { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
        getClaimTypeCoding(),
        ...(serviceCoding ? [serviceCoding] : []),
        ...(resources.billingTags ?? []).map((t) => ({ system: CLAIM_TAG_SYSTEM, code: t })),
        ...claimStatusTags,
      ],
    },
    type: { coding: [getClaimTypeCoding()] },
    use: 'claim',
    created: now,
    extension: getDefaultClaimSubmissionExtensions(),
    patient: uuidOrUrnReference('Patient', resources.patientId),
    provider: resources.billingProvider?.id
      ? {
          reference: `Organization/${resources.billingProvider.id}`,
          display: resourceDisplayName(resources.billingProvider),
        }
      : { display: 'Unknown' },
    facility: resources.serviceFacility
      ? {
          reference: `Location/${resources.serviceFacility.id}`,
          display: resourceDisplayName(resources.serviceFacility),
        }
      : undefined,
    insurer: resources.coverageRefs.length
      ? resources.coverageRefs[0].payorRef
        ? resources.coverageRefs[0].payorRef
        : undefined
      : undefined,
    insurance: ensureClaimInsurance(
      resources.coverageRefs.map((cov, i) => ({
        sequence: i + 1,
        focal: i === 0,
        coverage: cov.coverageRef,
      }))
    ),
    careTeam: resources.renderingProvider
      ? [
          {
            sequence: 1,
            provider: {
              reference: `Practitioner/${resources.renderingProvider.id}`,
              display: resourceDisplayName(resources.renderingProvider),
            },
            role: { coding: [{ system: CODE_SYSTEM_OYSTEHR_CLAIM_REFERRING_PROVIDER_TYPE, code: '82' }] },
          },
        ]
      : undefined,
    diagnosis: resources.diagnoses
      ? resources.diagnoses.map<ClaimDiagnosis>((dx, i) => ({
          sequence: i + 1,
          diagnosisCodeableConcept: {
            ...dx.code,
            coding: (dx.code?.coding ?? []).map((coding) => ({ ...coding, system: CODE_SYSTEM_ICD_10 })),
          },
        }))
      : [],
    priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
    item: resources.procedures
      ? resources.procedures.map<ClaimItem>((p, i) => {
          const procedureCode = assertDefined(p.code, 'Procedure code');
          // Swap Ottehr's legacy HCPCS code system for HL7's
          procedureCode.coding = [
            ...(procedureCode.coding ?? [])
              .filter((coding) => coding.system === CODE_SYSTEM_HCPCS)
              .map((coding) => ({
                ...coding,
                system: CODE_SYSTEM_HL7_HCPCS,
              })),
            ...(procedureCode.coding ?? []).filter((coding) => coding.system !== CODE_SYSTEM_HCPCS),
          ];
          const amount = getPriceForProcedure(p, resources.chargeMaster);
          total += amount;
          return {
            sequence: i + 1,
            careTeamSequence: resources.renderingProvider ? [1] : undefined,
            diagnosisSequence: resources.diagnoses ? [1] : undefined,
            productOrService: procedureCode,
            modifier: p.code?.coding?.[0].extension
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
                assertDefined(resources.appointment.start, 'Encounter start'),
                resources.serviceFacility
              ),
              end: resources.appointment.end
                ? getLocalDateOfService(resources.appointment.end, resources.serviceFacility)
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
            net: {
              value: amount,
              currency: 'USD',
            },
            quantity: { value: 1, unit: 'UN' },
          };
        })
      : [],
    total: {
      value: total,
      currency: 'USD',
    },
  };

  return claim;
}

function getLocalDateOfService(appointmentStart: string, location: Location | undefined): string {
  const timezone = location ? getTimezone(location) : TIMEZONES[0];
  return DateTime.fromISO(appointmentStart).setZone(timezone).toISODate()!;
}

function getServiceCoding(appointment: Appointment): Coding | undefined {
  const service = getService(appointment);
  if (!service) {
    return undefined;
  }
  return {
    system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM,
    code: service,
  };
}

function getPriceForProcedure(procedure: Procedure, chargeMaster?: ChargeItemDefinition): number {
  // Return early if nothing to check against
  if (!chargeMaster) {
    return 0;
  }
  // Find CPT code and CPT modifier
  const procedureCodeCoding = procedure.code?.coding?.find((coding) => coding.system === CPT_CODE_SYSTEM);
  const procedureCode = procedureCodeCoding?.code;
  const procedureCodeModifierExt = procedureCodeCoding?.extension?.find(
    (ext) => ext.url === EXTENSION_URL_CPT_MODIFIER
  );
  const procedureCodeModifier = procedureCodeModifierExt?.valueCodeableConcept?.coding?.find(
    (coding) => (coding.system = CODE_SYSTEM_CPT_MODIFIER)
  )?.code;
  // Return early if nothing to check
  if (!procedureCode) {
    return 0;
  }
  // Find price definition for CPT code
  const priceDefinition = chargeMaster.propertyGroup?.find((pg) => {
    const pc = pg.priceComponent?.[0];
    // No price component, no match
    if (!pc) return false;
    // Not a base price component, no match
    if (pc.type !== 'base') return false;
    // Coding doesn't match, no match
    if (!pc.code?.coding?.some((coding) => coding.system === CPT_CODE_SYSTEM && coding.code === procedureCode))
      return false;
    // If there's a modifier and it doesn't match, no match
    if (
      procedureCodeModifier &&
      !pc.extension?.some((ext) => ext.url === EXTENSION_URL_CPT_MODIFIER && ext.valueCode === procedureCodeModifier)
    )
      return false;
    return true;
  });
  if (!priceDefinition) {
    return 0;
  }
  const price = priceDefinition.priceComponent?.[0].amount?.value;
  return price ?? 0;
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
