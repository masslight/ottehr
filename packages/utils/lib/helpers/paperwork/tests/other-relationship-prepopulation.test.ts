import { Coverage, Patient, QuestionnaireResponseItem, RelatedPerson } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { getSubscriberRelationshipCodeableConcept } from '../../../fhir/helpers';
import { PATIENT_RECORD_QUESTIONNAIRE } from '../../../ottehr-config/patient-record';
import { makePrepopulatedItemsFromPatientRecord } from '../prePopulation';

const patient: Patient = { resourceType: 'Patient', id: 'test-patient' };

const makeCoverage = (relationship: string, otherRelationship?: string): Coverage => ({
  resourceType: 'Coverage',
  status: 'active',
  beneficiary: { reference: `Patient/${patient.id}` },
  payor: [{ reference: 'Organization/test-payer' }],
  relationship: getSubscriberRelationshipCodeableConcept(relationship, otherRelationship),
});

const makeGuarantor = (relationship: string, otherRelationship?: string): RelatedPerson => ({
  resourceType: 'RelatedPerson',
  patient: { reference: `Patient/${patient.id}` },
  relationship: [{ coding: [{ code: relationship.toLowerCase(), display: relationship }], text: otherRelationship }],
});

const prePopulate = (input: {
  primary?: Coverage;
  secondary?: Coverage;
  guarantorResource?: RelatedPerson;
}): QuestionnaireResponseItem[] =>
  makePrepopulatedItemsFromPatientRecord({
    patient,
    questionnaire: PATIENT_RECORD_QUESTIONNAIRE(),
    coverages: { primary: input.primary, secondary: input.secondary },
    guarantorResource: input.guarantorResource,
    insuranceOrgs: [],
    coverageChecks: [],
  }).flatMap((section) => section.item ?? []);

const findAnswer = (items: QuestionnaireResponseItem[], linkId: string): string | undefined =>
  items.find((item) => item.linkId === linkId)?.answer?.[0]?.valueString;

describe('other relationship prepopulation', () => {
  it('pre-populates the other relationship to insured for primary and secondary coverages', () => {
    const items = prePopulate({
      primary: makeCoverage('Other', 'Grandchild'),
      secondary: makeCoverage('Other', 'Ward'),
    });

    expect(findAnswer(items, 'patient-relationship-to-insured')).toBe('Other');
    expect(findAnswer(items, 'patient-relationship-to-insured-other')).toBe('Grandchild');
    expect(findAnswer(items, 'patient-relationship-to-insured-2')).toBe('Other');
    expect(findAnswer(items, 'patient-relationship-to-insured-other-2')).toBe('Ward');
  });

  it('leaves the other relationship to insured empty when the coverage has no relationship text', () => {
    const items = prePopulate({ primary: makeCoverage('Child') });

    expect(findAnswer(items, 'patient-relationship-to-insured')).toBe('Child');
    expect(findAnswer(items, 'patient-relationship-to-insured-other')).toBeUndefined();
  });

  it('pre-populates the responsible party other relationship', () => {
    const items = prePopulate({ guarantorResource: makeGuarantor('Other', 'Grandparent') });

    expect(findAnswer(items, 'responsible-party-relationship')).toBe('Other');
    expect(findAnswer(items, 'responsible-party-relationship-other')).toBe('Grandparent');
  });

  it('leaves the responsible party other relationship empty when the guarantor has no relationship text', () => {
    const items = prePopulate({ guarantorResource: makeGuarantor('Parent') });

    expect(findAnswer(items, 'responsible-party-relationship')).toBe('Parent');
    expect(findAnswer(items, 'responsible-party-relationship-other')).toBeUndefined();
  });
});
