import { deepStrictEqual } from 'node:assert';
import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Account,
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
  getNPIIdentifier,
  getPayerId,
  getTimezone,
  InternalError,
  isValidUUID,
  MISSING_REQUEST_SECRETS,
  TIMEZONES,
} from 'utils';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  assertDefined,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  formatZodError,
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
} from '../shared';

export interface CreateClaimFromEncounterParams extends CreateBillingClaimFromEncounterInput {
  secrets: NonNullable<ZambdaInput['secrets']>;
}

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

let m2mToken: string;

export async function handler(input: ZambdaInput): Promise<APIGatewayProxyResult> {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const billingOystehr = createBillingClient(m2mToken, params.secrets);
  const clinicalOystehr = createOystehrClient(m2mToken, params.secrets, { ignoreTags: [BILLING_RESOURCE_TAG] });

  const cvo = await complexValidation(clinicalOystehr, billingOystehr, params);

  const response = await performEffect(billingOystehr, cvo);
  return { statusCode: 200, body: JSON.stringify(response) };
}

interface ClinicalResources {
  encounter: Encounter;
  patient: Patient;
  accounts: Account[];
  coverages: Coverage[];
  practitioners: Practitioner[];
  location: Location;
  billingProvider: Organization;
  payors: Organization[];
  diagnoses: Array<Condition | Procedure>;
  procedures: Array<Procedure>;
}

interface BillingResources {
  person?: Person;
  mainPatient?: Patient;
  practitioners: Practitioner[];
  serviceFacility?: Location;
  billingProvider?: Organization;
}

interface ClaimResources {
  patientId: string;
  encounter: Encounter;
  // Only patient is required, everything else will prompt for data before claim submission in the UI
  coverageId?: string;
  payorRef?: Reference;
  serviceFacility?: Location;
  // Only rendering and billing providers handled now
  renderingProvider?: Practitioner;
  billingProvider?: Organization;
  diagnoses?: Array<Condition | Procedure>;
  procedures?: Array<Procedure>;
}

type ComplexValidationOutput = { clinicalResources: ClinicalResources; billingResources: BillingResources };

async function performEffect(billingOystehr: Oystehr, cvo: ComplexValidationOutput): Promise<{ claimId: string }> {
  const { clinicalResources, billingResources } = cvo;

  const requests: Array<
    | BatchInputPostRequest<BillingFhirResource>
    | BatchInputPatchRequest<BillingFhirResource>
    | BatchInputPutRequest<BillingFhirResource>
  > = [];
  const order: string[] = [];

  // Create or update main billing patient from clinical patient
  let mainPatientUrn: string | undefined;
  let mainPatient = billingResources.mainPatient;
  if (!mainPatient) {
    mainPatientUrn = `urn:uuid:main-patient`;
    mainPatient = prepareCopy(clinicalResources.patient, clinicalResources.patient.id!);
    requests.push({ method: 'POST', url: '/Patient', resource: mainPatient, fullUrl: mainPatientUrn });
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
  const claimPatientUrn = `urn:uuid:claim-patient`;
  const claimPatient = prepareWorkingCopy(mainPatient, mainPatientUrn ?? mainPatient.id!);
  requests.push({ method: 'POST', url: '/Patient', resource: claimPatient, fullUrl: claimPatientUrn });
  order.push('patient');

  // CW TODO: diff clinical and billing accounts
  const _accounts = clinicalResources.accounts.map((a) => {
    const copy = prepareCopy(a, a.id!);
    copy.subject = [{ reference: claimPatientUrn }];
    copy.coverage = [
      {
        coverage: {
          reference: `urn:uuid:claim-coverage-${clinicalResources.coverages.findIndex(
            (c) => c.id === a.coverage?.[0].coverage.reference?.replace('Coverage/', '')
          )}`,
        },
        priority: 1,
      },
    ];
    requests.push({ method: 'POST', url: '/Account', resource: copy });
    order.push('account');
  });

  // CW TODO: separate copies of coverages + RPs for main patient and claim patient

  // Create coverage copies for working copy patient
  const coverages = clinicalResources.coverages.map((c, i) => {
    const copy = prepareCopy(c, c.id!);
    copy.beneficiary = { reference: claimPatientUrn };
    // Subscriber is patient by default, check for contained RelatedPerson
    let subscriberUrn = claimPatientUrn;
    if (copy.subscriber?.reference?.startsWith('#') && copy.contained && copy.contained.length > 0) {
      // Subscriber is contained on the coverage
      const rp = copy.contained.find(
        (contained): contained is RelatedPerson =>
          contained.id === copy.subscriber?.reference?.replace('#', '') && contained.resourceType === 'RelatedPerson'
      );
      if (rp) {
        subscriberUrn = `urn:uuid:claim-coverage-rp-${i}`;
        requests.push({
          method: 'POST',
          url: '/RelatedPerson',
          resource: rp,
          fullUrl: subscriberUrn,
        });
        order.push('relatedperson');
      }
    }
    copy.subscriber = { reference: subscriberUrn };
    // Move all coverages to payer URLs
    const internalRefId = copy.payor[0].id?.replace('Organization/', '');
    if (internalRefId && isValidUUID(internalRefId)) {
      const org = clinicalResources.payors.find((p) => p.id === copy.payor[0].id?.replace('Organization/', ''));
      const payerId = getPayerId(org);
      if (payerId) {
        copy.payor = [{ reference: billingOystehr.rcm.constructPayerUrl({ id: payerId }) }];
      }
    }
    requests.push({ method: 'POST', url: '/Coverage', resource: copy, fullUrl: `urn:uuid:claim-coverage-${i}` });
    order.push('coverage');
    return copy;
  });

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
            { target: { reference: claimPatientUrn } },
            ...(mainPatientUrn ? [{ target: { reference: mainPatientUrn } }] : []),
          ],
        },
      ],
    });
  } else {
    requests.push({
      method: 'POST',
      url: '/Person',
      resource: {
        resourceType: 'Person',
        link: [
          { target: { reference: `Patient/${clinicalResources.patient.id!}` } },
          { target: { reference: mainPatientUrn ?? `Patient/${mainPatient.id!}` } },
          { target: { reference: claimPatientUrn } },
        ],
      },
    });
  }
  order.push('person');

  const claim = buildClaim({
    patientId: claimPatientUrn,
    encounter: clinicalResources.encounter,
    diagnoses: clinicalResources.diagnoses,
    coverageId: coverages.length > 0 ? 'urn:uuid:claim-coverage-0' : undefined,
    payorRef: coverages[0].payor[0],
    // CW TODO: select rendering provider based on encounter
    renderingProvider: billingResources.practitioners[0],
    serviceFacility: billingResources.serviceFacility,
    billingProvider: billingResources.billingProvider,
  });
  requests.push({ method: 'POST', url: '/Claim', resource: claim });
  order.push('claim');

  const txResult = await billingOystehr.fhir.transaction<BillingFhirResource>({ requests });
  const entries = (txResult.entry ?? []).map((e) => e.resource).filter(Boolean) as Resource[];

  if (entries.length !== order.length) throw InternalError;

  const copies: Partial<ClinicalResources> = {};
  for (let i = 0; i < order.length; i++) {
    const expected = requests[i].url.replace('/', '');
    if (entries[i].resourceType !== expected) throw InternalError;
    copies[order[i] as keyof ClinicalResources] = entries[i] as any;
  }

  const created = await billingOystehr.fhir.create<Claim>(claim);

  return { claimId: created.id! };
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
          name: 'id',
          value: params.encounterId,
        },
        {
          // Include patient
          name: '_include',
          value: 'Encounter:subject',
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

  // TODO: consider whether these should be required
  const location = findRef<Location>(resources, encounter.location?.[0].location.reference);
  if (!location) throw FHIR_RESOURCE_NOT_FOUND('Location');

  const practitioners = resources.filter((r): r is Practitioner => r.resourceType === 'Practitioner');
  if (!practitioners.length) throw FHIR_RESOURCE_NOT_FOUND('Practitioner');

  const accounts = resources.filter((r): r is Account => r.resourceType === 'Account');
  if (!accounts.length) throw FHIR_RESOURCE_NOT_FOUND('Account');

  const coverages = resources.filter((r): r is Coverage => r.resourceType === 'Coverage');
  if (!coverages.length) throw FHIR_RESOURCE_NOT_FOUND('Coverage');

  const diagnoses = resources.filter((r): r is Condition | Procedure =>
    ['Condition', 'Procedure'].includes(r.resourceType)
  );
  if (!diagnoses.length) throw FHIR_RESOURCE_NOT_FOUND('Condition');

  const procedures = resources.filter((r): r is Procedure => r.resourceType === 'Procedure');
  if (!procedures.length) throw FHIR_RESOURCE_NOT_FOUND('Procedure');

  const payors = await Promise.all(
    coverages.map<Promise<Organization>>(async (c) => {
      // Assume single payor per coverage
      const payorRef = c.payor[0].reference;
      if (!payorRef) throw FHIR_RESOURCE_NOT_FOUND('Organization');
      return isValidUUID(payorRef.replace('Organization/', ''))
        ? oystehr.fhir.get<Organization>({
            resourceType: 'Organization',
            id: payorRef.replace('Organization/', ''),
          })
        : oystehr.rcm.getPayerByUrl({ url: payorRef });
    })
  );

  const billingProvider = await oystehr.fhir.get<Organization>({
    resourceType: 'Organization',
    id: params.secrets.DEFAULT_BILLING_RESOURCE.replace('Organization/', ''),
  });

  return {
    encounter,
    patient,
    practitioners,
    location,
    billingProvider,
    accounts,
    coverages,
    payors,
    diagnoses,
    procedures,
  };
}

async function findExistingBillingResources(
  billingOystehr: Oystehr,
  originals: ClinicalResources
): Promise<BillingResources> {
  const personSearch = (
    await billingOystehr.fhir.search<Person | Patient>({
      resourceType: 'Person',
      params: [
        { name: 'link', value: `Patient/${originals.patient.id}` },
        { name: 'include', value: 'patient' },
      ],
    })
  ).unbundle();
  const existingPerson = personSearch.find((r): r is Person => r.resourceType === 'Person');
  // Main patient is the patient of record on billing app side that we stamp out per-claim copies from
  const existingMainPatient = personSearch.find(
    (r): r is Patient =>
      r.resourceType === 'Patient' &&
      !r.meta?.tag?.some(
        (t) => t.system === BILLING_WORKING_COPY_TAG.system && t.code === BILLING_WORKING_COPY_TAG.code
      )
  );

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
    practitioners: matchingPractitioners,
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
    patient: { reference: `Patient/${resources.patientId}` },
    provider: resources.billingProvider?.id
      ? { reference: `Organization/${resources.billingProvider.id}` }
      : { display: 'Unknown' },
    facility: resources.serviceFacility ? { reference: `Location:${resources.serviceFacility.id}` } : undefined,
    insurer: resources.payorRef ? resources.payorRef : undefined,
    // CW TODO: secondary insurance
    insurance: resources.coverageId
      ? [{ sequence: 1, focal: true, coverage: { reference: `Coverage/${resources.coverageId}` } }]
      : [],
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
    // CW TODO: charge amounts
    total: undefined,
    item: resources.procedures
      ? resources.procedures.map<ClaimItem>((p, i) => ({
          sequence: i + 1,
          careTeamSequence: resources.renderingProvider ? [1] : undefined,
          diagnosisSequence: resources.diagnoses ? [1] : undefined,
          productOrService: assertDefined(p.code, 'Procedure code'),
          // CW TODO: special e&m code modifier for telemed? (95)
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
          // CW TODO: this is the facility TYPE CODE -- 20 for UC, 22 or 10 for Telemed, etc
          locationCodeableConcept: resources.serviceFacility
            ? { coding: [{ system: CODE_SYSTEM_CMS_PLACE_OF_SERVICE, code: '' }] }
            : undefined,
          // CW TODO: charge amounts!
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

async function complexValidation(
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
  const billingResources = await findExistingBillingResources(billingOystehr, clinicalResources);
  return { clinicalResources, billingResources };
}

export function validateRequestParameters(input: ZambdaInput): CreateClaimFromEncounterParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  let raw: unknown;
  try {
    raw = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  const result = CreateBillingClaimFromEncounterInputSchema.safeParse(raw);
  if (!result.success) throw INVALID_INPUT_ERROR(formatZodError(result.error));

  return { ...result.data, secrets: input.secrets };
}
