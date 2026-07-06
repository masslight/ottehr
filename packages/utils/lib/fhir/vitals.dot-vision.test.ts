import { Observation, ObservationComponent } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { DOT_VISION_SCREENING_LABELS, getDotVisionScreeningLines } from '../helpers/vitals/vitals-vision.helper';
import { VitalFieldNames } from '../types/api/chart-data/chart-data.constants';
import { VitalsDotVisionScreening, VitalsVisionObservationDTO } from '../types/api/chart-data/chart-data.types';
import {
  extractDotVisionScreening,
  fillVitalObservationAttributes,
  getDotVisionDocumentDerivedFrom,
  getDotVisionScreeningComponents,
  makeVitalsObservationDTO,
  VITAL_VISION_DOT_BINOCULAR_OBSERVABLE_CODE,
  VITAL_VISION_DOT_COLOR_ABNORMAL_CODE,
  VITAL_VISION_DOT_COLOR_NORMAL_CODE,
  VITAL_VISION_DOT_COLOR_RECOGNITION_SNOMED_CODE,
  VITAL_VISION_DOT_HORIZONTAL_QUALIFIER_CODE,
  VITAL_VISION_DOT_LEFT_EYE_STRUCTURE_CODE,
  VITAL_VISION_DOT_MONOCULAR_OBSERVABLE_CODE,
  VITAL_VISION_DOT_RECEIVED_DOC_CODE,
  VITAL_VISION_DOT_REFERRAL_SNOMED_CODE,
  VITAL_VISION_DOT_RIGHT_EYE_STRUCTURE_CODE,
  VITAL_VISION_DOT_VISUAL_FIELD_SNOMED_CODE,
} from './vitals';

// Builds a minimal but valid vital-vision Observation skeleton, the way the chart-data save path
// does before fillVitalObservationAttributes() fills in component/derivedFrom.
const makeVisionBaseObservation = (): Observation => ({
  resourceType: 'Observation',
  status: 'final',
  code: { text: 'vision vital' },
  subject: { reference: 'Patient/patient-1' },
  encounter: { reference: 'Encounter/encounter-1' },
  performer: [{ reference: 'Practitioner/practitioner-1' }],
  effectiveDateTime: '2026-06-24T10:00:00.000Z',
  meta: { tag: [{ code: VitalFieldNames.VitalVision }] },
});

// Runs a vision DTO through the real save (fillVitalObservationAttributes) and read
// (makeVitalsObservationDTO) code paths, returning both the FHIR resource and the re-parsed DTO.
const roundTrip = (
  dot?: VitalsDotVisionScreening,
  acuity?: Partial<VitalsVisionObservationDTO>
): { observation: Observation; parsed: VitalsVisionObservationDTO } => {
  const dto: VitalsVisionObservationDTO = {
    field: VitalFieldNames.VitalVision,
    leftEyeVisionText: '',
    rightEyeVisionText: '',
    ...acuity,
    dotVisionScreening: dot,
  };
  const observation = fillVitalObservationAttributes(makeVisionBaseObservation(), dto);
  const parsed = makeVitalsObservationDTO(observation) as VitalsVisionObservationDTO;
  return { observation, parsed };
};

const componentByCode = (observation: Observation, code: string): ObservationComponent | undefined =>
  (observation.component ?? []).find((cmp) => cmp.code?.coding?.some((coding) => coding.code === code));

const componentHasCode = (cmp: ObservationComponent | undefined, code: string): boolean =>
  !!cmp?.code?.coding?.some((coding) => coding.code === code);

describe('DOT vision screening — FHIR encoding round-trip', () => {
  it('preserves a complete DOT exam of a monocular driver referred with documentation', () => {
    // Real use case: examiner records reduced horizontal fields, the driver fails color recognition,
    // has monocular vision, is referred to a specialist, and returns referral documentation.
    const dot: VitalsDotVisionScreening = {
      horizontalFieldLeftDegrees: 95,
      horizontalFieldRightDegrees: 120,
      canRecognizeColors: false,
      hasMonocularVision: true,
      referredToSpecialist: true,
      receivedDocumentation: true,
      document: { documentReferenceId: 'doc-ref-42', url: 'https://z3/upload/file.pdf', title: 'eye-clinic-note.pdf' },
    };

    const { parsed } = roundTrip(dot);

    expect(parsed.dotVisionScreening).toEqual({
      horizontalFieldLeftDegrees: 95,
      horizontalFieldRightDegrees: 120,
      canRecognizeColors: false,
      hasMonocularVision: true,
      referredToSpecialist: true,
      receivedDocumentation: true,
      // url is intentionally NOT persisted — DocumentReference is the source of truth.
      document: { documentReferenceId: 'doc-ref-42', title: 'eye-clinic-note.pdf' },
    });
    // A DOT entry must not masquerade as a Snellen acuity reading.
    expect(parsed.leftEyeVisionText).toBe('');
    expect(parsed.rightEyeVisionText).toBe('');
  });

  it('preserves a normal binocular driver with no referral and no document', () => {
    const dot: VitalsDotVisionScreening = {
      horizontalFieldLeftDegrees: 140,
      horizontalFieldRightDegrees: 140,
      canRecognizeColors: true,
      hasMonocularVision: false,
      referredToSpecialist: false,
      receivedDocumentation: false,
    };

    const { observation, parsed } = roundTrip(dot);

    expect(parsed.dotVisionScreening).toEqual({
      horizontalFieldLeftDegrees: 140,
      horizontalFieldRightDegrees: 140,
      canRecognizeColors: true,
      hasMonocularVision: false,
      referredToSpecialist: false,
      receivedDocumentation: false,
      document: undefined,
    });
    // No document → no derivedFrom link on the Observation.
    expect(observation.derivedFrom).toBeUndefined();
  });

  it('round-trips a partial exam where only the left horizontal field was measured', () => {
    const { parsed } = roundTrip({ horizontalFieldLeftDegrees: 100 });

    expect(parsed.dotVisionScreening).toEqual({
      horizontalFieldLeftDegrees: 100,
      horizontalFieldRightDegrees: undefined,
      canRecognizeColors: undefined,
      hasMonocularVision: undefined,
      referredToSpecialist: undefined,
      receivedDocumentation: undefined,
      document: undefined,
    });
  });

  it('does not attach DOT screening data to a plain Snellen acuity entry', () => {
    const { observation, parsed } = roundTrip(undefined, {
      leftEyeVisionText: '20/20',
      rightEyeVisionText: '20/30',
    });

    expect(parsed.dotVisionScreening).toBeUndefined();
    expect(parsed.leftEyeVisionText).toBe('20/20');
    expect(parsed.rightEyeVisionText).toBe('20/30');
    expect(observation.derivedFrom).toBeUndefined();
  });
});

describe('DOT vision screening — SNOMED coding contract', () => {
  it('encodes the horizontal field of vision as Visual field + Horizontal qualifier + per-eye structure in degrees', () => {
    const { observation } = roundTrip({ horizontalFieldLeftDegrees: 95, horizontalFieldRightDegrees: 120 });

    const leftField = (observation.component ?? []).find(
      (cmp) =>
        componentHasCode(cmp, VITAL_VISION_DOT_VISUAL_FIELD_SNOMED_CODE) &&
        componentHasCode(cmp, VITAL_VISION_DOT_LEFT_EYE_STRUCTURE_CODE)
    );
    expect(leftField).toBeDefined();
    expect(componentHasCode(leftField, VITAL_VISION_DOT_HORIZONTAL_QUALIFIER_CODE)).toBe(true);
    expect(leftField?.valueQuantity).toEqual({
      value: 95,
      unit: 'degrees',
      system: 'http://unitsofmeasure.org',
      code: 'deg',
    });

    const rightField = (observation.component ?? []).find(
      (cmp) =>
        componentHasCode(cmp, VITAL_VISION_DOT_VISUAL_FIELD_SNOMED_CODE) &&
        componentHasCode(cmp, VITAL_VISION_DOT_RIGHT_EYE_STRUCTURE_CODE)
    );
    expect(rightField?.valueQuantity?.value).toBe(120);
  });

  it('encodes color recognition as a normal/abnormal finding coded value', () => {
    const normal = componentByCode(
      roundTrip({ canRecognizeColors: true }).observation,
      VITAL_VISION_DOT_COLOR_RECOGNITION_SNOMED_CODE
    );
    expect(normal?.valueCodeableConcept?.coding?.[0].code).toBe(VITAL_VISION_DOT_COLOR_NORMAL_CODE);
    expect(normal?.valueBoolean).toBeUndefined();

    const abnormal = componentByCode(
      roundTrip({ canRecognizeColors: false }).observation,
      VITAL_VISION_DOT_COLOR_RECOGNITION_SNOMED_CODE
    );
    expect(abnormal?.valueCodeableConcept?.coding?.[0].code).toBe(VITAL_VISION_DOT_COLOR_ABNORMAL_CODE);
  });

  it('encodes monocular vision as monocular/binocular observable coded value', () => {
    const monocular = componentByCode(
      roundTrip({ hasMonocularVision: true }).observation,
      VITAL_VISION_DOT_MONOCULAR_OBSERVABLE_CODE
    );
    expect(monocular?.valueCodeableConcept?.coding?.[0].code).toBe(VITAL_VISION_DOT_MONOCULAR_OBSERVABLE_CODE);

    const binocular = componentByCode(
      roundTrip({ hasMonocularVision: false }).observation,
      VITAL_VISION_DOT_MONOCULAR_OBSERVABLE_CODE
    );
    expect(binocular?.valueCodeableConcept?.coding?.[0].code).toBe(VITAL_VISION_DOT_BINOCULAR_OBSERVABLE_CODE);
  });

  it('encodes specialist referral and received-documentation as booleans', () => {
    const { observation } = roundTrip({ referredToSpecialist: true, receivedDocumentation: false });
    expect(componentByCode(observation, VITAL_VISION_DOT_REFERRAL_SNOMED_CODE)?.valueBoolean).toBe(true);
    expect(componentByCode(observation, VITAL_VISION_DOT_RECEIVED_DOC_CODE)?.valueBoolean).toBe(false);
  });

  it('links the referral document via Observation.derivedFrom, not a component value', () => {
    const { observation } = roundTrip({
      receivedDocumentation: true,
      document: { documentReferenceId: 'doc-ref-42', url: 'https://z3/file.pdf', title: 'eye-clinic-note.pdf' },
    });

    expect(observation.derivedFrom).toEqual([
      { reference: 'DocumentReference/doc-ref-42', display: 'eye-clinic-note.pdf' },
    ]);
    // The document must never be embedded as a component value (FHIR R4 forbids valueReference there,
    // and a JSON blob in valueString would duplicate the DocumentReference).
    const componentValues = (observation.component ?? []).map((cmp) => cmp.valueString).filter(Boolean);
    expect(componentValues.join(' ')).not.toContain('doc-ref-42');
    expect(componentValues.join(' ')).not.toContain('eye-clinic-note.pdf');
  });
});

describe('DOT vision screening — lazy DocumentReference contract', () => {
  it('does not emit derivedFrom while only a session-local file (no DocumentReference id) is attached', () => {
    // Mirrors the UI state after a file is uploaded to Z3 but before "Add" creates the DocumentReference.
    const pendingDoc: VitalsDotVisionScreening = {
      receivedDocumentation: true,
      document: { url: 'https://z3/pending.pdf', title: 'pending.pdf' },
    };

    expect(getDotVisionDocumentDerivedFrom(pendingDoc)).toEqual([]);

    const { observation, parsed } = roundTrip(pendingDoc);
    expect(observation.derivedFrom).toBeUndefined();
    // The yes/no flag is still recorded even though no document was persisted.
    expect(parsed.dotVisionScreening?.receivedDocumentation).toBe(true);
    expect(parsed.dotVisionScreening?.document).toBeUndefined();
  });

  it('ignores derivedFrom references that are not DocumentReferences when extracting', () => {
    const components = getDotVisionScreeningComponents({ canRecognizeColors: true });
    const dot = extractDotVisionScreening(components, [
      { reference: 'Observation/some-other-thing', display: 'noise' },
    ]);
    expect(dot?.document).toBeUndefined();
    expect(dot?.canRecognizeColors).toBe(true);
  });
});

describe('DOT vision screening — display lines (MCSA-5875 layout)', () => {
  it('renders the form fields in order with degrees and Yes/No qualifiers', () => {
    const lines = getDotVisionScreeningLines({
      horizontalFieldLeftDegrees: 95,
      horizontalFieldRightDegrees: 120,
      canRecognizeColors: false,
      hasMonocularVision: true,
      referredToSpecialist: true,
      receivedDocumentation: false,
    });

    expect(lines).toEqual([
      `${DOT_VISION_SCREENING_LABELS.horizontalFieldLeft}: 95 degrees`,
      `${DOT_VISION_SCREENING_LABELS.horizontalFieldRight}: 120 degrees`,
      `${DOT_VISION_SCREENING_LABELS.canRecognizeColors}: No`,
      `${DOT_VISION_SCREENING_LABELS.monocularVision}: Yes`,
      `${DOT_VISION_SCREENING_LABELS.referredToSpecialist}: Yes`,
      `${DOT_VISION_SCREENING_LABELS.receivedDocumentation}: No`,
    ]);
  });

  it('returns no lines for undefined or empty screening data', () => {
    expect(getDotVisionScreeningLines(undefined)).toEqual([]);
    expect(getDotVisionScreeningLines({})).toEqual([]);
  });
});
