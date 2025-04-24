import { Coding, Coverage, CoverageClass, RelatedPerson } from 'fhir/r4b';
import { FHIR_EXTENSION } from 'utils';
import {
  AdditionalInsuranceFormValues,
  InsuredInformationModalFormValues,
  PatientInformationModalFormValues,
  PlanOwnedBy,
} from './form-values.types';
import { getPatientData } from './patient.helper';
import { mapPersonInformationToResource, mapPersonNameToResource } from './resources.helper';

export const getCoverageData = (
  coverage?: Coverage,
  subscriber?: RelatedPerson
): ReturnType<typeof getPatientData> & {
  relationship?: string;
  subscriberId?: string;
  policyGroup?: string;
  planName?: string;
  organizationId?: string;
} => {
  const relationship = coverage?.relationship?.coding?.find(
    (item) => item.system === FHIR_EXTENSION.Coverage.subscriberRelationship.url
  )?.display;

  const subscriberId = coverage?.subscriberId;

  const subscriberData = getPatientData(subscriber);

  const policyGroup = coverage?.class?.find((item) =>
    item.type.coding?.find(
      (coding) => coding.system === FHIR_EXTENSION.Coverage.coverageClass.url && coding.code === 'group'
    )
  )?.value;

  const planName = coverage?.class?.find((item) =>
    item.type.coding?.find(
      (coding) => coding.system === FHIR_EXTENSION.Coverage.coverageClass.url && coding.code === 'plan'
    )
  )?.name;

  const organizationId = coverage?.payor?.[0]?.reference?.split('/')[1];

  return { relationship, subscriberId, ...subscriberData, policyGroup, planName, organizationId };
};

export const mapPatientInformationToCoverageResource = (
  coverage: Coverage,
  patientInformation: PatientInformationModalFormValues
): Coverage => {
  const coverageCopy = structuredClone(coverage) as Coverage;

  const relationship = patientInformation.relationship;
  const relationshipCoding = {
    system: FHIR_EXTENSION.Coverage.subscriberRelationship.url,
    code: relationship.toLowerCase(),
    display: relationship,
  };
  if (!coverageCopy.relationship?.coding) {
    coverageCopy.relationship = { ...coverageCopy.relationship, coding: [] };
  }

  if (
    !coverageCopy.relationship.coding!.find(
      (item) => item.system === FHIR_EXTENSION.Coverage.subscriberRelationship.url
    )
  ) {
    coverageCopy.relationship.coding = [...(coverageCopy.relationship.coding || []), relationshipCoding];
  } else {
    coverageCopy.relationship.coding = coverageCopy.relationship.coding!.map((item) =>
      item.system === FHIR_EXTENSION.Coverage.subscriberRelationship.url ? relationshipCoding : item
    );
  }

  return coverageCopy;
};

const isCoverageClass = (coverageClass: CoverageClass, code: 'plan' | 'group'): Coding | undefined =>
  coverageClass.type.coding?.find(
    (coding) => coding.system === FHIR_EXTENSION.Coverage.coverageClass.url && coding.code === code
  );

const findCoverageClass = (
  coverageClasses: CoverageClass[] | undefined,
  code: 'plan' | 'group'
): CoverageClass | undefined => coverageClasses?.find((item) => isCoverageClass(item, code));

const updateOrCreateCoveragePlanClass = (coverageClass?: CoverageClass, planOwnedBy?: PlanOwnedBy): CoverageClass => {
  const getIdentifierCoding = (coding?: Coding[]): Coding | undefined =>
    coding?.find((coding) => coding.system === 'payer-id');

  const name = planOwnedBy?.name;
  const value = getIdentifierCoding(
    planOwnedBy?.ownedBy?.identifier?.find((id) => getIdentifierCoding(id.type?.coding))?.type?.coding
  )?.code;

  if (coverageClass) {
    return { ...coverageClass, name: name || coverageClass.name, value: value || coverageClass.value };
  } else {
    return {
      name,
      value: value || '',
      type: { coding: [{ code: 'plan', system: FHIR_EXTENSION.Coverage.coverageClass.url }] },
    };
  }
};

const updateOrCreateCoverageGroupClass = (coverageClass: CoverageClass | undefined, value: string): CoverageClass => {
  if (coverageClass) {
    return { ...coverageClass, name: coverageClass.name, value };
  } else {
    return {
      value,
      type: { coding: [{ code: 'group', system: FHIR_EXTENSION.Coverage.coverageClass.url }] },
    };
  }
};

const mapPolicyGroupToCoverageResource = (
  coverageCopy: Coverage,
  insuredInformation: Pick<InsuredInformationModalFormValues, 'policyGroup'>
): void => {
  if (insuredInformation.policyGroup) {
    const groupClass = findCoverageClass(coverageCopy.class, 'group');
    const modifiedGroupClass = updateOrCreateCoverageGroupClass(groupClass, insuredInformation.policyGroup);
    if (groupClass) {
      coverageCopy.class = coverageCopy.class!.map((coverageClass) =>
        isCoverageClass(coverageClass, 'group') ? modifiedGroupClass : coverageClass
      );
    } else {
      coverageCopy.class = [...(coverageCopy.class || []), modifiedGroupClass];
    }
  } else {
    coverageCopy.class = coverageCopy.class?.filter((coverageClass) => !isCoverageClass(coverageClass, 'group'));
  }
};

export const mapInsuredInformationToCoverageResource = (
  coverage: Coverage,
  insuredInformation: InsuredInformationModalFormValues
): Coverage => {
  const coverageCopy = structuredClone(coverage) as Coverage;

  // planName
  const planClass = findCoverageClass(coverageCopy.class, 'plan');
  const modifiedPlanClass = updateOrCreateCoveragePlanClass(planClass, insuredInformation.planAndPayor);
  if (planClass) {
    coverageCopy.class = coverageCopy.class!.map((coverageClass) =>
      isCoverageClass(coverageClass, 'plan') ? modifiedPlanClass : coverageClass
    );
  } else {
    coverageCopy.class = [...(coverageCopy.class || []), modifiedPlanClass];
  }

  // organizationId
  coverageCopy.payor = [{ reference: `Organization/${insuredInformation.planAndPayor?.ownedBy?.id || ''}` }];

  // subscriberId
  coverageCopy.subscriberId = insuredInformation.insuredID;

  mapPolicyGroupToCoverageResource(coverageCopy, insuredInformation);

  return coverageCopy;
};

export const mapInsuredInformationToRelatedPersonResource = (
  subscriber: RelatedPerson,
  insuredInformation: InsuredInformationModalFormValues
): RelatedPerson => {
  const subscriberCopy = structuredClone(subscriber) as RelatedPerson;

  mapPersonInformationToResource(subscriberCopy, insuredInformation);

  return subscriberCopy;
};

export const mapAdditionalInsuranceToRelatedPersonResource = (
  subscriber: RelatedPerson,
  insuredInformation: AdditionalInsuranceFormValues
): RelatedPerson => {
  const subscriberCopy = structuredClone(subscriber) as RelatedPerson;

  mapPersonNameToResource(subscriberCopy, insuredInformation);

  return subscriberCopy;
};

export const mapAdditionalInsuranceToCoverageResource = (
  coverage: Coverage,
  insuredInformation: AdditionalInsuranceFormValues
): Coverage => {
  const coverageCopy = structuredClone(coverage) as Coverage;

  mapPolicyGroupToCoverageResource(coverageCopy, insuredInformation);

  return coverageCopy;
};
