import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Address,
  Claim,
  Coverage,
  FhirResource,
  Identifier,
  Location,
  Organization,
  Patient,
  Practitioner,
} from 'fhir/r4b';
import {
  CODE_SYSTEM_OYSTEHR_RCM_CMS1500_REFERRING_PROVIDER_TYPE,
  FHIR_IDENTIFIER_CODE_TAX_EMPLOYER,
  FHIR_IDENTIFIER_CODE_TAX_SS,
  FHIR_IDENTIFIER_NPI,
  FHIR_IDENTIFIER_SYSTEM,
  FHIR_RESOURCE_NOT_FOUND,
  getPayerUrl,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, prepareWorkingCopy, sortClaimInsurance } from '../shared';
import { UpdateBillingClaimParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'update-billing-claim';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// Fetch the working copy, apply the provided fields, write it back. Only provided fields are touched.
async function performEffect(oystehr: Oystehr, params: UpdateBillingClaimParams): Promise<{ id: string | undefined }> {
  switch (params.resourceType) {
    case 'Claim':
      return attachClaimResources(oystehr, params);
    case 'Patient': {
      const patient = await fetchById<Patient>(oystehr, 'Patient', params.resourceId);
      const { fields } = params;
      applyName(patient, fields.firstName, fields.lastName);
      if (fields.dob !== undefined) patient.birthDate = fields.dob;
      if (fields.gender !== undefined) patient.gender = fields.gender as Patient['gender'];
      if (fields.address !== undefined) patient.address = [buildAddress(fields.address)];
      return save(oystehr, patient);
    }
    case 'Practitioner': {
      const practitioner = await fetchById<Practitioner>(oystehr, 'Practitioner', params.resourceId);
      const { fields } = params;
      applyName(practitioner, fields.firstName, fields.lastName);
      if (fields.npi !== undefined) setNpi(practitioner, fields.npi);
      if (fields.taxId !== undefined) setTaxId(practitioner, fields.taxId);
      return save(oystehr, practitioner);
    }
    case 'Coverage': {
      const coverage = await fetchById<Coverage>(oystehr, 'Coverage', params.resourceId);
      if (params.fields.subscriberId !== undefined) coverage.subscriberId = params.fields.subscriberId;
      if (params.fields.status !== undefined) coverage.status = params.fields.status;
      return save(oystehr, coverage);
    }
    case 'Location': {
      const location = await fetchById<Location>(oystehr, 'Location', params.resourceId);
      const { fields } = params;
      if (fields.name !== undefined) location.name = fields.name;
      if (fields.npi !== undefined) setNpi(location, fields.npi);
      if (fields.address !== undefined) location.address = buildAddress(fields.address);
      return save(oystehr, location);
    }
    case 'Organization': {
      const organization = await fetchById<Organization>(oystehr, 'Organization', params.resourceId);
      const { fields } = params;
      if (fields.name !== undefined) organization.name = fields.name;
      if (fields.npi !== undefined) setNpi(organization, fields.npi);
      if (fields.taxId !== undefined) setTaxId(organization, fields.taxId);
      return save(oystehr, organization);
    }
  }
}

// Attach resources the claim was created without: working copy of the original + claim reference
// (mirrors create-billing-claim's working-copy wiring).
async function attachClaimResources(
  oystehr: Oystehr,
  params: Extract<UpdateBillingClaimParams, { resourceType: 'Claim' }>
): Promise<{ id: string | undefined }> {
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.resourceId);
  const { fields } = params;

  if (fields.billingProvider) {
    const copy = await createCopy(oystehr, fields.billingProvider.type, fields.billingProvider.id);
    claim.provider = { reference: `${fields.billingProvider.type}/${copy.id}` };
  }

  if (fields.renderingProvider) {
    const copy = await createCopy(oystehr, fields.renderingProvider.type, fields.renderingProvider.id);
    claim.careTeam = [
      {
        sequence: 1,
        provider: { reference: `${fields.renderingProvider.type}/${copy.id}` },
        role: { coding: [{ system: CODE_SYSTEM_OYSTEHR_RCM_CMS1500_REFERRING_PROVIDER_TYPE, code: '82' }] },
      },
      ...(claim.careTeam ?? []).filter((member) => member.sequence !== 1),
    ];
    claim.item = claim.item?.map((item) => ({
      ...item,
      careTeamSequence: Array.from(new Set([1, ...(item.careTeamSequence ?? [])])),
    }));
  }

  if (fields.facilityId) {
    const copy = await createCopy(oystehr, 'Location', fields.facilityId);
    claim.facility = { reference: `Location/${copy.id}` };
  }

  if (fields.coverageId) {
    const original = await fetchById<Coverage>(oystehr, 'Coverage', fields.coverageId);
    const copy = prepareWorkingCopy(original, fields.coverageId);
    if (claim.patient?.reference) {
      copy.beneficiary = { reference: claim.patient.reference };
      copy.subscriber = { reference: claim.patient.reference };
    }
    const created = await oystehr.fhir.create(copy);
    claim.insurance = [
      { sequence: 1, focal: true, coverage: { reference: `Coverage/${created.id}` } },
      ...(claim.insurance ?? []).filter((i) => i.sequence !== 1),
    ];
    const payerRef = created.payor?.[0]?.reference;
    if (payerRef) claim.insurer = { reference: payerRef };
  }

  if (fields.payerId) {
    const payerUrl = getPayerUrl(fields.payerId);
    claim.insurer = { reference: payerUrl };
    const coverageRef = sortClaimInsurance(claim)[0]?.coverage?.reference;
    if (coverageRef?.startsWith('Coverage/')) {
      const coverage = await fetchById<Coverage>(oystehr, 'Coverage', coverageRef.replace('Coverage/', ''));
      coverage.payor = [{ reference: payerUrl }];
      await oystehr.fhir.update(coverage);
    }
  }

  return save(oystehr, claim);
}

async function createCopy(
  oystehr: Oystehr,
  resourceType: 'Practitioner' | 'Organization' | 'Location',
  resourceId: string
): Promise<FhirResource> {
  const original = await fetchById<FhirResource>(oystehr, resourceType, resourceId);
  return oystehr.fhir.create(prepareWorkingCopy(original, resourceId));
}

async function fetchById<T extends FhirResource>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  id: string
): Promise<T> {
  const result = await oystehr.fhir.search<T>({ resourceType, params: [{ name: '_id', value: id }] });
  const resource = result.unbundle()[0];
  if (!resource) throw FHIR_RESOURCE_NOT_FOUND(resourceType);
  return resource;
}

async function save(oystehr: Oystehr, resource: FhirResource): Promise<{ id: string | undefined }> {
  const updated = await oystehr.fhir.update(resource);
  return { id: updated.id };
}

function applyName(resource: Patient | Practitioner, firstName?: string, lastName?: string): void {
  const name: { use: 'official'; given?: string[]; family?: string } = { use: 'official' };
  if (firstName !== undefined) name.given = [firstName];
  if (lastName !== undefined) name.family = lastName;
  if (name.given || name.family) resource.name = [name];
}

function buildAddress(parts: {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}): Address {
  const line = [parts.line1, parts.line2].filter((l): l is string => !!l);
  return {
    ...(line.length ? { line } : {}),
    city: parts.city,
    state: parts.state,
    postalCode: parts.postalCode,
  };
}

// getNPI reads identifier.system === FHIR_IDENTIFIER_NPI; write the same shape (as create-billing-provider does).
function setNpi(resource: Practitioner | Organization | Location, npi: string): void {
  const identifier = resource.identifier ?? [];
  const existing = identifier.find((id) => id.system === FHIR_IDENTIFIER_NPI);
  if (npi) {
    if (existing) existing.value = npi;
    else identifier.push({ system: FHIR_IDENTIFIER_NPI, value: npi });
    resource.identifier = identifier;
  } else if (existing) {
    resource.identifier = identifier.filter((id) => id.system !== FHIR_IDENTIFIER_NPI);
  }
}

// getTaxID matches type.coding TAX_EMPLOYER/TAX_SS; new entries use TAX_EMPLOYER (as create-billing-provider does).
function setTaxId(resource: Practitioner | Organization, taxId: string): void {
  const isTax = (id: Identifier): boolean =>
    !!id.type?.coding?.some(
      (tc) =>
        tc.system === FHIR_IDENTIFIER_SYSTEM &&
        (tc.code === FHIR_IDENTIFIER_CODE_TAX_EMPLOYER || tc.code === FHIR_IDENTIFIER_CODE_TAX_SS)
    );
  const identifier = resource.identifier ?? [];
  const existing = identifier.find(isTax);
  if (taxId) {
    if (existing) existing.value = taxId;
    else {
      identifier.push({
        type: { coding: [{ system: FHIR_IDENTIFIER_SYSTEM, code: FHIR_IDENTIFIER_CODE_TAX_EMPLOYER }] },
        value: taxId,
      });
    }
    resource.identifier = identifier;
  } else if (existing) {
    resource.identifier = identifier.filter((id) => !isTax(id));
  }
}
