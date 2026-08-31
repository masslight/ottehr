import { Encounter, Procedure } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
  CANDID_NON_INSURANCE_PAYER_ID_IDENTIFIER_SYSTEM,
  CANDID_PATIENT_ID_IDENTIFIER_SYSTEM,
  CANDID_PAYMENT_ID_SYSTEM,
  CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM,
  getCandidEncounterIdFromEncounter,
  getCptModifierCodeFromProcedure,
  makeBusinessIdentifierForCandidPayment,
  makeCptModifierExtension,
} from '../../src/shared/candid';

// ── Constants ──────────────────────────────────────────────────────────────────

describe('Candid identifier system constants', () => {
  it('CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM is a valid Candid API URL', () => {
    expect(CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM).toBe(
      'https://api.joincandidhealth.com/api/encounters/v4/response/encounter_id'
    );
  });

  it('CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM is a valid Candid pre-encounter URL', () => {
    expect(CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM).toBe(
      'https://pre-api.joincandidhealth.com/appointments/v1/response/appointment_id'
    );
  });

  it('CANDID_PATIENT_ID_IDENTIFIER_SYSTEM is a valid Candid API URL', () => {
    expect(CANDID_PATIENT_ID_IDENTIFIER_SYSTEM).toBe(
      'https://api.joincandidhealth.com/api/patients/v4/response/patient_id'
    );
  });

  it('CANDID_NON_INSURANCE_PAYER_ID_IDENTIFIER_SYSTEM is a valid Candid API URL', () => {
    expect(CANDID_NON_INSURANCE_PAYER_ID_IDENTIFIER_SYSTEM).toBe(
      'https://api.joincandidhealth.com/api/non-insurance-payers/v1/response/non_insurance_payer_id'
    );
  });

  it('CANDID_PAYMENT_ID_SYSTEM is a valid Oystehr payment system URL', () => {
    expect(CANDID_PAYMENT_ID_SYSTEM).toBe('https://fhir.oystehr.com/PaymentIdSystem/candid');
  });
});

// ── getCandidEncounterIdFromEncounter ──────────────────────────────────────────

describe('getCandidEncounterIdFromEncounter', () => {
  it('returns the Candid encounter ID when identifier exists', () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      status: 'finished',
      class: { code: 'AMB' },
      identifier: [
        { system: 'http://other-system', value: 'other-id' },
        { system: CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM, value: 'candid-enc-123' },
      ],
    };
    expect(getCandidEncounterIdFromEncounter(encounter)).toBe('candid-enc-123');
  });

  it('returns undefined when Candid identifier is not present', () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      status: 'finished',
      class: { code: 'AMB' },
      identifier: [{ system: 'http://other-system', value: 'other-id' }],
    };
    expect(getCandidEncounterIdFromEncounter(encounter)).toBeUndefined();
  });

  it('returns undefined when encounter has no identifiers', () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      status: 'finished',
      class: { code: 'AMB' },
    };
    expect(getCandidEncounterIdFromEncounter(encounter)).toBeUndefined();
  });

  it('returns undefined when identifiers array is empty', () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      status: 'finished',
      class: { code: 'AMB' },
      identifier: [],
    };
    expect(getCandidEncounterIdFromEncounter(encounter)).toBeUndefined();
  });

  it('returns first match when multiple Candid identifiers exist', () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      status: 'finished',
      class: { code: 'AMB' },
      identifier: [
        { system: CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM, value: 'first-candid-id' },
        { system: CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM, value: 'second-candid-id' },
      ],
    };
    expect(getCandidEncounterIdFromEncounter(encounter)).toBe('first-candid-id');
  });
});

// ── makeBusinessIdentifierForCandidPayment ─────────────────────────────────────

describe('makeBusinessIdentifierForCandidPayment', () => {
  it('returns an Identifier with the Candid payment system and given value', () => {
    const result = makeBusinessIdentifierForCandidPayment('pay-abc-123');
    expect(result).toEqual({
      system: CANDID_PAYMENT_ID_SYSTEM,
      value: 'pay-abc-123',
    });
  });

  it('uses the correct Candid payment system URL', () => {
    const result = makeBusinessIdentifierForCandidPayment('test');
    expect(result.system).toBe('https://fhir.oystehr.com/PaymentIdSystem/candid');
  });

  it('preserves the exact payment ID string', () => {
    const paymentId = 'pmt_12345-abcde';
    const result = makeBusinessIdentifierForCandidPayment(paymentId);
    expect(result.value).toBe(paymentId);
  });
});

// ── makeCptModifierExtension ───────────────────────────────────────────────────

const EXTENSION_URL_CPT_MODIFIER = 'https://fhir.ottehr.com/Extension/cpt-code-modifier';
const CODE_SYSTEM_CPT_MODIFIER = 'https://fhir.ottehr.com/CodeSystem/cpt-code-modifier';

describe('makeCptModifierExtension', () => {
  it('creates an Extension with a single modifier code', () => {
    const result = makeCptModifierExtension([{ code: '25', display: 'Significant, Separately Identifiable E/M' }]);
    expect(result).toEqual({
      url: EXTENSION_URL_CPT_MODIFIER,
      valueCodeableConcept: {
        coding: [
          {
            system: CODE_SYSTEM_CPT_MODIFIER,
            code: '25',
            display: 'Significant, Separately Identifiable E/M',
          },
        ],
      },
    });
  });

  it('creates an Extension with multiple modifier codes', () => {
    const modifiers = [
      { code: '25', display: 'Significant E/M' },
      { code: '59', display: 'Distinct Procedural Service' },
      { code: '95', display: 'Synchronous Telemedicine Service' },
    ];
    const result = makeCptModifierExtension(modifiers);
    expect(result.valueCodeableConcept?.coding).toHaveLength(3);
    expect(result.valueCodeableConcept?.coding?.[0].code).toBe('25');
    expect(result.valueCodeableConcept?.coding?.[1].code).toBe('59');
    expect(result.valueCodeableConcept?.coding?.[2].code).toBe('95');
  });

  it('creates an Extension with empty modifiers array', () => {
    const result = makeCptModifierExtension([]);
    expect(result.url).toBe(EXTENSION_URL_CPT_MODIFIER);
    expect(result.valueCodeableConcept?.coding).toEqual([]);
  });

  it('uses the correct CPT modifier extension URL', () => {
    const result = makeCptModifierExtension([{ code: '25', display: 'test' }]);
    expect(result.url).toBe(EXTENSION_URL_CPT_MODIFIER);
  });

  it('uses the correct CPT modifier code system', () => {
    const result = makeCptModifierExtension([{ code: '25', display: 'test' }]);
    expect(result.valueCodeableConcept?.coding?.[0].system).toBe(CODE_SYSTEM_CPT_MODIFIER);
  });
});

// ── getCptModifierCodeFromProcedure ────────────────────────────────────────────

describe('getCptModifierCodeFromProcedure', () => {
  const CODE_SYSTEM_CPT = 'http://www.ama-assn.org/go/cpt';

  it('returns modifier codes from a procedure with CPT coding and modifier extension', () => {
    const procedure: Procedure = {
      resourceType: 'Procedure',
      status: 'completed',
      subject: { reference: 'Patient/123' },
      code: {
        coding: [
          {
            system: CODE_SYSTEM_CPT,
            code: '99213',
            extension: [
              {
                url: EXTENSION_URL_CPT_MODIFIER,
                valueCodeableConcept: {
                  coding: [
                    { system: CODE_SYSTEM_CPT_MODIFIER, code: '25', display: 'Significant E/M' },
                    { system: CODE_SYSTEM_CPT_MODIFIER, code: '59', display: 'Distinct Service' },
                  ],
                },
              },
            ],
          },
        ],
      },
    };

    const result = getCptModifierCodeFromProcedure(procedure);
    expect(result).toEqual([
      { code: '25', display: 'Significant E/M' },
      { code: '59', display: 'Distinct Service' },
    ]);
  });

  it('returns undefined when procedure has no CPT coding', () => {
    const procedure: Procedure = {
      resourceType: 'Procedure',
      status: 'completed',
      subject: { reference: 'Patient/123' },
      code: {
        coding: [{ system: 'http://other-system', code: '12345' }],
      },
    };

    expect(getCptModifierCodeFromProcedure(procedure)).toBeUndefined();
  });

  it('returns undefined when procedure has no code at all', () => {
    const procedure: Procedure = {
      resourceType: 'Procedure',
      status: 'completed',
      subject: { reference: 'Patient/123' },
    };

    expect(getCptModifierCodeFromProcedure(procedure)).toBeUndefined();
  });

  it('returns undefined when CPT coding has no modifier extension', () => {
    const procedure: Procedure = {
      resourceType: 'Procedure',
      status: 'completed',
      subject: { reference: 'Patient/123' },
      code: {
        coding: [
          {
            system: CODE_SYSTEM_CPT,
            code: '99213',
            // no extension
          },
        ],
      },
    };

    expect(getCptModifierCodeFromProcedure(procedure)).toBeUndefined();
  });

  it('returns undefined when modifier extension has wrong URL', () => {
    const procedure: Procedure = {
      resourceType: 'Procedure',
      status: 'completed',
      subject: { reference: 'Patient/123' },
      code: {
        coding: [
          {
            system: CODE_SYSTEM_CPT,
            code: '99213',
            extension: [
              {
                url: 'http://wrong-url',
                valueCodeableConcept: {
                  coding: [{ system: CODE_SYSTEM_CPT_MODIFIER, code: '25', display: 'test' }],
                },
              },
            ],
          },
        ],
      },
    };

    expect(getCptModifierCodeFromProcedure(procedure)).toBeUndefined();
  });

  it('filters out modifier codings from wrong code system', () => {
    const procedure: Procedure = {
      resourceType: 'Procedure',
      status: 'completed',
      subject: { reference: 'Patient/123' },
      code: {
        coding: [
          {
            system: CODE_SYSTEM_CPT,
            code: '99213',
            extension: [
              {
                url: EXTENSION_URL_CPT_MODIFIER,
                valueCodeableConcept: {
                  coding: [
                    { system: CODE_SYSTEM_CPT_MODIFIER, code: '25', display: 'Valid Modifier' },
                    { system: 'http://wrong-system', code: 'XX', display: 'Invalid Modifier' },
                  ],
                },
              },
            ],
          },
        ],
      },
    };

    const result = getCptModifierCodeFromProcedure(procedure);
    expect(result).toEqual([{ code: '25', display: 'Valid Modifier' }]);
  });

  it('uses empty string for display when display is missing', () => {
    const procedure: Procedure = {
      resourceType: 'Procedure',
      status: 'completed',
      subject: { reference: 'Patient/123' },
      code: {
        coding: [
          {
            system: CODE_SYSTEM_CPT,
            code: '99213',
            extension: [
              {
                url: EXTENSION_URL_CPT_MODIFIER,
                valueCodeableConcept: {
                  coding: [{ system: CODE_SYSTEM_CPT_MODIFIER, code: '25' }],
                },
              },
            ],
          },
        ],
      },
    };

    const result = getCptModifierCodeFromProcedure(procedure);
    expect(result).toEqual([{ code: '25', display: '' }]);
  });

  it('filters out codings with no code', () => {
    const procedure: Procedure = {
      resourceType: 'Procedure',
      status: 'completed',
      subject: { reference: 'Patient/123' },
      code: {
        coding: [
          {
            system: CODE_SYSTEM_CPT,
            code: '99213',
            extension: [
              {
                url: EXTENSION_URL_CPT_MODIFIER,
                valueCodeableConcept: {
                  coding: [
                    { system: CODE_SYSTEM_CPT_MODIFIER, display: 'No Code Here' },
                    { system: CODE_SYSTEM_CPT_MODIFIER, code: '59', display: 'Has Code' },
                  ],
                },
              },
            ],
          },
        ],
      },
    };

    const result = getCptModifierCodeFromProcedure(procedure);
    expect(result).toEqual([{ code: '59', display: 'Has Code' }]);
  });
});
