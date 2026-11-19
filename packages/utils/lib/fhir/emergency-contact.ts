import { RelatedPerson } from 'fhir/r4b';

export interface EmergencyContactSummary {
  relationship: string;
  fullName: string;
  phone: string;
}

export const isEmergencyContactRelatedPerson = (relatedPerson: RelatedPerson): boolean =>
  Boolean(
    relatedPerson.relationship?.some(
      (rel) =>
        rel.coding?.some(
          (coding) => coding.code === 'EP' && coding.system === 'http://terminology.hl7.org/CodeSystem/v2-0131'
        )
    )
  );

export const getEmergencyContactSummary = (relatedPerson: RelatedPerson): EmergencyContactSummary => {
  const name = relatedPerson.name?.[0];
  return {
    relationship: relatedPerson.relationship?.[0]?.coding?.[0]?.display ?? '',
    fullName: [...(name?.given ?? []), name?.family].filter(Boolean).join(' '),
    phone: relatedPerson.telecom?.find((telecom) => telecom.system === 'phone' && !telecom.period?.end)?.value ?? '',
  };
};
