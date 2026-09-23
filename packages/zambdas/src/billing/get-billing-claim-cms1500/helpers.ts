import {
  Address,
  Claim,
  ClaimCareTeam,
  ClaimSupportingInfo,
  ContactPoint,
  Coverage,
  HumanName,
  Organization,
  Patient,
  Practitioner,
  RelatedPerson,
} from 'fhir/r4b';
import { getCoveragePlanType } from 'utils/lib/fhir/billing';
import { FHIR_IDENTIFIER_CODE_TAX_SS, FHIR_IDENTIFIER_SYSTEM } from 'utils/lib/fhir/constants';
import { getExtensionValue, getNPI, getTaxID } from 'utils/lib/fhir/helpers';
import {
  CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY,
  CODE_SYSTEM_ICD_9,
  CODE_SYSTEM_OYSTEHR_RCM_CMS1500_REVENUE_CODE,
  EMERGENCY_REVENUE_CODE,
  EXTENSION_CLAIM_ASSIGNMENT_OR_PLAN_PARTICIPATION_CODE,
  EXTENSION_CLAIM_BENEFITS_ASSIGNMENT_CERTIFICATION_INDICATOR,
  EXTENSION_CLAIM_CONDITION_CODE,
  EXTENSION_CLAIM_PROVIDER_SIGNATURE_INDICATOR,
  EXTENSION_CLAIM_RELEASE_OF_INFORMATION_CODE,
  EXTENSION_OUTSIDE_CHARGES,
  EXTENSION_PATIENT_ACCOUNT_NUMBER,
  EXTENSION_PATIENT_PAID,
  EXTENSION_PATIENT_SIGNED_DATE,
  EXTENSION_PRACTITIONER_SIGNED_DATE,
} from 'utils/lib/helpers/rcm/constants';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import {
  Cms1500Address,
  Cms1500FormData,
  Cms1500InsuranceType,
  Cms1500PersonName,
  Cms1500Relationship,
  Cms1500ServiceLine,
  Cms1500Sex,
} from 'utils/lib/types/data/billing/cms1500.types';
import { AUTO_ACCIDENT_TAG_NAME } from 'utils/lib/types/data/billing/system-tags';
import { getCLIA } from '../service-facility.helpers';
import { ClaimGraph, EXTENSION_CLAIM_FREQUENCY_CODE, getClaimPcn, getTaxonomy } from '../shared';

export interface Cms1500Resources extends ClaimGraph {
  // Payer Organizations keyed by their payer list reference (Claim.insurer, Coverage.payor)
  payers: Map<string, Organization>;
  referringProvider?: Practitioner | Organization;
}

export const SIGNATURE_ON_FILE = 'SIGNATURE ON FILE';

// Item 1 from the coverage's claim filing indicator (X12 SBR09). NUCC counts HMOs, commercial, auto,
// liability and workers' compensation coverage as "Other" and employer plans as "Group Health Plan".
const INSURANCE_TYPE_BY_PLAN_TYPE: Record<string, Cms1500InsuranceType> = {
  MA: 'medicare',
  MB: 'medicare',
  MC: 'medicaid',
  CH: 'tricare',
  VA: 'champva',
  '12': 'group',
  '13': 'group',
  '14': 'group',
  '15': 'group',
  '17': 'group',
  BL: 'group',
  FI: 'group',
  OF: 'feca',
};

// Item 17 qualifiers, from either the X12 entity codes or the Oystehr RCM CMS-1500 role codes.
const REFERRING_QUALIFIER_BY_ROLE: Record<string, string> = {
  DN: 'DN',
  referring: 'DN',
  DK: 'DK',
  ordering: 'DK',
  DQ: 'DQ',
  supervising: 'DQ',
};

// Items 14 and 15 use the NUCC date qualifiers; an accident date is reported as "439 Accident".
const ACCIDENT_DATE_QUALIFIER = '439';

// Clinical lab procedures (CPT 80047-89398) carry the facility's CLIA number in item 23.
const isLabProcedure = (code: string | undefined): boolean => !!code && /^8\d{4}$/.test(code);

export function buildCms1500FormData(resources: Cms1500Resources): Cms1500FormData {
  const { claim, patient, coverages, billingProvider, serviceFacility, renderingProvider, referringProvider } =
    resources;
  const [primary, other] = coverages;
  const payer =
    resources.payers.get(claim.insurer?.reference ?? '') ?? resources.payers.get(primary?.payor?.[0]?.reference ?? '');
  const otherPayer = resources.payers.get(other?.payor?.[0]?.reference ?? '');
  const insured = subscriberOf(primary, resources);
  const otherInsured = subscriberOf(other, resources);
  const insuranceType = primary
    ? INSURANCE_TYPE_BY_PLAN_TYPE[getCoveragePlanType(primary) ?? ''] ?? 'other'
    : undefined;
  const billingNpi = billingProvider ? getNPI(billingProvider) : undefined;
  const renderingNpi = renderingProvider ? getNPI(renderingProvider) : undefined;
  const renderingTaxonomy = renderingProvider ? getTaxonomy(renderingProvider) : '';
  const billingTaxonomy = billingProvider ? getTaxonomy(billingProvider) : '';
  // 24I/24J only when the rendering provider differs from the billing provider in 33a/33b.
  const reportRendering = !!renderingNpi && renderingNpi !== billingNpi;

  const diagnoses = [...(claim.diagnosis ?? [])].sort((a, b) => a.sequence - b.sequence);
  const pointerOf = new Map(diagnoses.map((diagnosis, i) => [diagnosis.sequence, i + 1]));
  const supportingInfo = claim.supportingInfo ?? [];
  const lineInformationSequences = new Set((claim.item ?? []).flatMap((item) => item.informationSequence ?? []));
  const infoOf = (category: string): ClaimSupportingInfo | undefined =>
    supportingInfo.find((info) => hasCode(info.category, CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY, category));

  const accidentType = claim.accident?.type?.coding?.[0]?.code;
  const hasAutoAccidentTag = (claim.meta?.tag ?? []).some(
    (tag) => tag.system === CLAIM_TAG_SYSTEM && tag.code === AUTO_ACCIDENT_TAG_NAME
  );
  const onset = infoOf('onset');
  const otherDate = infoOf('other');
  const unableToWork = infoOf('employmentimpacted');
  const hospitalized = infoOf('hospitalized');
  const additionalInformation = supportingInfo.find(
    (info) =>
      hasCode(info.category, CODE_SYSTEM_CLAIM_INFORMATION_CATEGORY, 'info') &&
      !!info.valueString &&
      info.sequence < 100 &&
      !lineInformationSequences.has(info.sequence)
  )?.valueString;
  const outsideCharges = getExtensionValue(claim, EXTENSION_OUTSIDE_CHARGES, 'valueMoney')?.value;
  const frequencyCode = getExtensionValue(claim, EXTENSION_CLAIM_FREQUENCY_CODE, 'valueString');
  const resubmissionCode =
    frequencyCode === '7' || frequencyCode === '8'
      ? frequencyCode
      : claim.related?.[0]?.relationship?.coding?.[0]?.code;
  const focalInsurance = claim.insurance?.find((entry) => entry.focal) ?? claim.insurance?.[0];
  const clia = serviceFacility ? getCLIA(serviceFacility) : undefined;
  const hasLabProcedure = (claim.item ?? []).some((item) => isLabProcedure(item.productOrService?.coding?.[0]?.code));
  const releaseOfInformation = getExtensionValue(claim, EXTENSION_CLAIM_RELEASE_OF_INFORMATION_CODE, 'valueString');
  const assignment = getExtensionValue(claim, EXTENSION_CLAIM_ASSIGNMENT_OR_PLAN_PARTICIPATION_CODE, 'valueString');
  const taxId = billingProvider ? getTaxID(billingProvider) : undefined;
  const taxIdIsSsn = !!billingProvider?.identifier?.some(
    (id) =>
      id.value === taxId &&
      id.type?.coding?.some((c) => c.system === FHIR_IDENTIFIER_SYSTEM && c.code === FHIR_IDENTIFIER_CODE_TAX_SS)
  );
  const planName = (coverage: Coverage | undefined, coveragePayer: Organization | undefined): string | undefined =>
    coverageClass(coverage, 'plan')?.name || coveragePayer?.name;
  const referringMember = referringCareTeamMember(claim);

  const form: Cms1500FormData = {
    payer: payer ? { name: payer.name, address: toAddress(payer.address?.[0]) } : undefined,
    insuranceType,
    insuredId: primary?.subscriberId,
    patientName: toPersonName(patient?.name?.[0]),
    patientBirthDate: patient?.birthDate,
    patientSex: toSex(patient?.gender),
    patientAddress: toAddress(patient?.address?.[0]),
    patientPhone: phoneOf(patient?.telecom),
    patientRelationshipToInsured: primary ? toRelationship(primary.relationship?.coding?.[0]?.code) : undefined,
    insuredName: toPersonName(insured?.name?.[0]),
    insuredAddress: toAddress(insured?.address?.[0]),
    insuredPhone: phoneOf(insured?.telecom),
    insuredBirthDate: insured?.birthDate,
    insuredSex: toSex(insured?.gender),
    // Medicare asks for NONE when there is no insurance primary to Medicare.
    insuredPolicyGroupNumber:
      coverageClass(primary, 'group')?.value ?? (insuranceType === 'medicare' ? 'NONE' : undefined),
    insuredPlanName: planName(primary, payer),
    otherClaimId: claimIdentifier(claim),
    anotherHealthBenefitPlan: primary ? !!other : undefined,
    otherInsuredName: other ? toPersonName(otherInsured?.name?.[0]) : undefined,
    otherInsuredPolicyOrGroupNumber: other ? coverageClass(other, 'group')?.value ?? other.subscriberId : undefined,
    otherInsuredPlanName: other ? planName(other, otherPayer) : undefined,
    conditionRelatedTo: {
      employment: accidentType === 'WPA' || getCoveragePlanType(primary) === 'WC',
      autoAccident: accidentType === 'MVA' || hasAutoAccidentTag,
      autoAccidentState: claim.accident?.locationAddress?.state,
      otherAccident: !!claim.accident && accidentType !== 'WPA' && accidentType !== 'MVA',
    },
    claimCodes: (claim.extension ?? [])
      .filter((extension) => extension.url === EXTENSION_CLAIM_CONDITION_CODE && extension.valueString)
      .map((extension) => extension.valueString as string),
    patientSignatureOnFile: releaseOfInformation === 'Y' || releaseOfInformation === 'I',
    patientSignatureDate: getExtensionValue(claim, EXTENSION_PATIENT_SIGNED_DATE, 'valueDate'),
    insuredSignatureOnFile:
      getExtensionValue(claim, EXTENSION_CLAIM_BENEFITS_ASSIGNMENT_CERTIFICATION_INDICATOR, 'valueString') === 'Y',
    currentIllnessDate: onset?.timingDate
      ? { date: onset.timingDate, qualifier: onset.code?.coding?.[0]?.code }
      : undefined,
    otherDate: otherDate?.timingDate
      ? { date: otherDate.timingDate, qualifier: otherDate.code?.coding?.[0]?.code }
      : claim.accident?.date
      ? { date: claim.accident.date, qualifier: ACCIDENT_DATE_QUALIFIER }
      : undefined,
    unableToWork: unableToWork?.timingPeriod
      ? { from: unableToWork.timingPeriod.start, to: unableToWork.timingPeriod.end }
      : undefined,
    referringProvider:
      referringProvider && referringMember
        ? {
            qualifier: referringQualifier(referringMember),
            name:
              referringProvider.resourceType === 'Practitioner'
                ? toPersonName(referringProvider.name?.[0])
                : { first: '', last: referringProvider.name ?? '' },
            credentials:
              referringProvider.resourceType === 'Practitioner'
                ? referringProvider.name?.[0]?.suffix?.join(' ')
                : undefined,
            npi: getNPI(referringProvider),
          }
        : undefined,
    hospitalization: hospitalized?.timingPeriod
      ? { from: hospitalized.timingPeriod.start, to: hospitalized.timingPeriod.end }
      : undefined,
    additionalClaimInformation: additionalInformation,
    outsideLab: { purchased: outsideCharges != null, charges: outsideCharges },
    icdIndicator: diagnoses.some((diagnosis) => getCode(diagnosis.diagnosisCodeableConcept, CODE_SYSTEM_ICD_9))
      ? '9'
      : '0',
    diagnosisCodes: diagnoses
      .map((diagnosis) => diagnosis.diagnosisCodeableConcept?.coding?.[0]?.code)
      .filter((code): code is string => !!code),
    resubmission: resubmissionCode
      ? {
          code: resubmissionCode,
          originalReferenceNumber: claim.related?.[0]?.reference?.value ?? claim.related?.[0]?.claim?.identifier?.value,
        }
      : undefined,
    priorAuthorizationNumber: focalInsurance?.preAuthRef?.[0] ?? (hasLabProcedure ? clia : undefined),
    serviceLines: [...(claim.item ?? [])]
      .sort((a, b) => a.sequence - b.sequence)
      .map<Cms1500ServiceLine>((item) => {
        const supplemental = (item.informationSequence ?? [])
          .map((sequence) => supportingInfo.find((info) => info.sequence === sequence)?.valueString)
          .filter(Boolean)
          .join(' ');
        return {
          dateFrom: item.servicedPeriod?.start ?? item.servicedDate,
          dateTo: item.servicedPeriod?.end,
          placeOfService: item.locationCodeableConcept?.coding?.[0]?.code,
          emergency: !!getCode(item.revenue, CODE_SYSTEM_OYSTEHR_RCM_CMS1500_REVENUE_CODE, EMERGENCY_REVENUE_CODE),
          procedureCode: item.productOrService?.coding?.[0]?.code,
          modifiers: (item.modifier ?? [])
            .map((modifier) => modifier.coding?.[0]?.code)
            .filter((code): code is string => !!code),
          diagnosisPointers: (item.diagnosisSequence ?? [])
            .map((sequence) => pointerOf.get(sequence))
            .filter((pointer): pointer is number => pointer != null),
          charges:
            item.net?.value ??
            (item.unitPrice?.value != null ? item.unitPrice.value * (item.quantity?.value ?? 1) : undefined),
          units: item.quantity?.value,
          renderingProviderNpi: reportRendering ? renderingNpi : undefined,
          renderingProviderOtherIdQualifier: reportRendering && renderingTaxonomy ? 'ZZ' : undefined,
          renderingProviderOtherId: reportRendering && renderingTaxonomy ? renderingTaxonomy : undefined,
          supplementalInformation: supplemental || undefined,
        };
      }),
    federalTaxId: taxId ? { value: taxId, type: taxIdIsSsn ? 'SSN' : 'EIN' } : undefined,
    patientAccountNumber:
      getExtensionValue(claim, EXTENSION_PATIENT_ACCOUNT_NUMBER, 'valueString') ?? getClaimPcn(claim),
    acceptAssignment: assignment ? assignment === 'A' || assignment === 'B' : undefined,
    amountPaid: getExtensionValue(claim, EXTENSION_PATIENT_PAID, 'valueMoney')?.value,
    physicianSignature:
      getExtensionValue(claim, EXTENSION_CLAIM_PROVIDER_SIGNATURE_INDICATOR, 'valueBoolean') === true
        ? SIGNATURE_ON_FILE
        : undefined,
    physicianSignatureDate: getExtensionValue(claim, EXTENSION_PRACTITIONER_SIGNED_DATE, 'valueDate') ?? claim.created,
    serviceFacility: serviceFacility
      ? {
          name: serviceFacility.name,
          address: toAddress(serviceFacility.address),
          // Only when it differs from the billing provider's NPI in 33a
          npi: getNPI(serviceFacility) !== billingNpi ? getNPI(serviceFacility) : undefined,
        }
      : undefined,
    billingProvider: billingProvider
      ? {
          name:
            billingProvider.resourceType === 'Practitioner'
              ? displayName(billingProvider.name?.[0])
              : billingProvider.name,
          address: toAddress(billingProvider.address?.[0]),
          phone: phoneOf(billingProvider.telecom),
          npi: billingNpi,
          otherId: billingTaxonomy ? `ZZ${billingTaxonomy}` : undefined,
        }
      : undefined,
  };
  return form;
}

// The coverage's subscriber: the patient when the coverage points at them, else its RelatedPerson.
function subscriberOf(
  coverage: Coverage | undefined,
  resources: Pick<Cms1500Resources, 'patient' | 'subscribers'>
): Patient | RelatedPerson | undefined {
  const reference = coverage?.subscriber?.reference;
  if (!coverage) return undefined;
  if (!reference || reference.startsWith('Patient/')) return resources.patient;
  const id = reference.replace('RelatedPerson/', '');
  return resources.subscribers.find((subscriber) => subscriber.id === id);
}

// The care team member reported in item 17: a referring, ordering or supervising provider.
export function referringCareTeamMember(claim: Claim): ClaimCareTeam | undefined {
  return claim.careTeam?.find((member) => referringQualifier(member));
}

function referringQualifier(member: ClaimCareTeam): string | undefined {
  const code = member.role?.coding?.find((coding) => coding.code && REFERRING_QUALIFIER_BY_ROLE[coding.code])?.code;
  return code ? REFERRING_QUALIFIER_BY_ROLE[code] : undefined;
}

function coverageClass(coverage: Coverage | undefined, type: string): { value?: string; name?: string } | undefined {
  return coverage?.class?.find((entry) => entry.type?.coding?.some((coding) => coding.code === type));
}

function claimIdentifier(claim: Claim): Cms1500FormData['otherClaimId'] {
  const value = claim.identifier?.find((identifier) => identifier.use === 'secondary')?.value;
  return value ? { value } : undefined;
}

function hasCode(
  concept: { coding?: { system?: string; code?: string }[] } | undefined,
  system: string,
  code: string
): boolean {
  return !!concept?.coding?.some((coding) => coding.system === system && coding.code === code);
}

function getCode(
  concept: { coding?: { system?: string; code?: string }[] } | undefined,
  system: string,
  code?: string
): string | undefined {
  return concept?.coding?.find((coding) => coding.system === system && (code == null || coding.code === code))?.code;
}

function toPersonName(name: HumanName | undefined): Cms1500PersonName | undefined {
  if (!name?.family && !name?.given?.length) return undefined;
  return {
    last: name.family ?? '',
    first: name.given?.[0] ?? '',
    middle: name.given?.[1],
    suffix: name.suffix?.[0],
  };
}

function displayName(name: HumanName | undefined): string | undefined {
  const display = [...(name?.given ?? []), name?.family, ...(name?.suffix ?? [])].filter(Boolean).join(' ');
  return display || undefined;
}

function toAddress(address: Address | undefined): Cms1500Address | undefined {
  if (!address) return undefined;
  return {
    line1: address.line?.[0],
    line2: address.line?.[1],
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
  };
}

function toSex(gender: string | undefined): Cms1500Sex | undefined {
  if (gender === 'male') return 'M';
  if (gender === 'female') return 'F';
  return undefined;
}

function toRelationship(code: string | undefined): Cms1500Relationship {
  if (code === 'self') return 'self';
  if (code === 'spouse' || code === 'common') return 'spouse';
  if (code === 'child') return 'child';
  return 'other';
}

function phoneOf(telecom: ContactPoint[] | undefined): string | undefined {
  return telecom?.find((contact) => contact.system === 'phone' && contact.value)?.value;
}
