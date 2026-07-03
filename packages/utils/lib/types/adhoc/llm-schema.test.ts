import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AdHocEncountersInputSchema,
  AdHocEncountersOutputSchema,
  AdHocLayerMap,
  BILLING_DOMAIN_FIELDS,
  BILLING_INTERNAL_FIELDS,
  BILLING_LAYERS,
  BillingBaseRowSchema,
  ENCOUNTER_DOMAIN_FIELDS,
  ENCOUNTER_INTERNAL_FIELDS,
  ENCOUNTER_LAYERS,
  EncounterBaseRowSchema,
  layerIncludeFlags,
  layerOptions,
  layerSchemas,
  llmFieldsForLayers,
  llmFieldsFromZodObject,
  MAX_DOMAIN_VALUE_LENGTH,
  MAX_DOMAIN_VALUES,
  PATIENT_DOMAIN_FIELDS,
  PATIENT_INTERNAL_FIELDS,
  PATIENT_LAYERS,
  PatientBaseRowSchema,
  sampleDomains,
  unloadedLayers,
} from './index';

// The Zod layer map is the single source; the LLM serializer takes id → schema.
const ENCOUNTER_LAYER_SCHEMAS = layerSchemas(ENCOUNTER_LAYERS);

describe('llm-schema serialization (Zod → prompt)', () => {
  it('serializes name/type/description and nullability from the Zod row schema', () => {
    const fields = llmFieldsFromZodObject(EncounterBaseRowSchema);
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));

    expect(byName.appointmentId).toMatchObject({ type: 'string' });
    expect(byName.appointmentId.description).toContain('/in-person/');
    expect(byName.date).toMatchObject({ type: 'string', nullable: true });
    expect(byName.scheduledSlotMinutes).toMatchObject({ type: 'number', nullable: true });
  });

  it('exposes closed vocabularies (z.enum) as "values" — the only value sets the model sees', () => {
    const fields = llmFieldsFromZodObject(EncounterBaseRowSchema);
    const visitType = fields.find((f) => f.name === 'visitType');
    expect(visitType?.values).toEqual(['In-Person', 'Telemed', 'Unknown']);
    // Free-text fields carry NO values — nothing sampled from data may reach the prompt.
    const location = fields.find((f) => f.name === 'location');
    expect(location?.values).toBeUndefined();
  });

  it('excludes internal row-only ids from the prompt schema', () => {
    const fields = llmFieldsForLayers(EncounterBaseRowSchema, ENCOUNTER_LAYER_SCHEMAS, {}, ENCOUNTER_INTERNAL_FIELDS);
    const names = fields.map((f) => f.name);
    for (const internal of ENCOUNTER_INTERNAL_FIELDS) {
      expect(names).not.toContain(internal);
    }
    expect(names).toContain('appointmentId');
  });

  it('includes a layer’s fields only when the layer is selected', () => {
    const without = llmFieldsForLayers(EncounterBaseRowSchema, ENCOUNTER_LAYER_SCHEMAS, {}, ENCOUNTER_INTERNAL_FIELDS);
    expect(without.map((f) => f.name)).not.toContain('icdCodes');

    const withCodes = llmFieldsForLayers(
      EncounterBaseRowSchema,
      ENCOUNTER_LAYER_SCHEMAS,
      { codes: true },
      ENCOUNTER_INTERNAL_FIELDS
    );
    const icd = withCodes.find((f) => f.name === 'icdCodes');
    expect(icd).toMatchObject({ type: 'string[]' });
  });

  it('emits only static schema metadata — no row values can leak into the prompt', () => {
    const fields = llmFieldsForLayers(
      EncounterBaseRowSchema,
      ENCOUNTER_LAYER_SCHEMAS,
      Object.fromEntries(Object.keys(ENCOUNTER_LAYER_SCHEMAS).map((id) => [id, true])),
      ENCOUNTER_INTERNAL_FIELDS
    );
    const allowedKeys = new Set(['name', 'type', 'description', 'nullable', 'values']);
    for (const field of fields) {
      for (const key of Object.keys(field)) {
        expect(allowedKeys.has(key)).toBe(true);
      }
    }
  });

  it('the response schema accepts rows shaped like what the LLM was told (validation contract)', () => {
    const row = {
      appointmentId: 'a1',
      encounterId: 'e1',
      date: '2026-07-01',
      startTime: '2026-07-01T14:00:00Z',
      visitType: 'In-Person',
      appointmentType: 'walk-in',
      serviceCategory: 'Urgent Care',
      visitStatus: 'completed',
      encounterType: 'main',
      reason: 'cough',
      scheduledSlotMinutes: null,
      patientId: 'p1',
      firstName: 'A',
      lastName: 'B',
      patientName: 'A B',
      dateOfBirth: '2010-01-01',
      sex: 'female',
      city: 'NYC',
      state: 'NY',
      zip: '10001',
      phone: '',
      email: '',
      source: '',
      location: 'Midtown',
      locationId: 'l1',
      region: 'NY',
      clinicOpenHours: null,
      attendingProvider: 'Dr. C',
      attendingProviderId: 'pr1',
      registrationChannel: 'Staff',
      registeredBy: 'x@y.z',
      registeredByName: 'X Y',
      // layer fields present only when the layer was requested:
      icdCodes: ['H66.90'],
    };
    expect(() => AdHocEncountersOutputSchema.parse({ encounters: [row] })).not.toThrow();
    // A row violating the declared type must fail validation.
    expect(AdHocEncountersOutputSchema.safeParse({ encounters: [{ ...row, visitType: 'telemedicine' }] }).success).toBe(
      false
    );
  });

  it('rejects unsupported zod shapes loudly instead of describing them wrong', () => {
    expect(() => llmFieldsFromZodObject(z.object({ bad: z.record(z.string(), z.number()) }))).toThrow(
      /unsupported zod type/
    );
  });
});

// The layer map is the single source: UI options, endpoint include-flags, the input schema's keys,
// and the availableLayers pointer are all DERIVED from it — no layer id is written twice.
describe('layer derivation from the single Zod layer map', () => {
  it('derives UI options (id/label/description) from the layer map', () => {
    const options = layerOptions(ENCOUNTER_LAYERS);
    expect(options.map((o) => o.id)).toEqual(Object.keys(ENCOUNTER_LAYERS));
    const codes = options.find((o) => o.id === 'codes');
    expect(codes?.label).toBe('Clinical codes (ICD / CPT / E&M)');
    expect(codes?.default).toBe(false);
  });

  it('derives include<Layer> flags and the input schema keys from the same map', () => {
    const flags = layerIncludeFlags(ENCOUNTER_LAYERS, { codes: true, timing: false });
    expect(flags.includeCodes).toBe(true);
    expect(flags.includeTiming).toBe(false);
    // The input schema accepts exactly those derived flags.
    expect(
      AdHocEncountersInputSchema.safeParse({ dateRange: { start: 'a', end: 'b' }, includeCodes: true }).success
    ).toBe(true);
    // Every layer id has a matching include flag key — the enumeration is never re-listed.
    for (const id of Object.keys(ENCOUNTER_LAYERS)) {
      const key = `include${id.charAt(0).toUpperCase()}${id.slice(1)}`;
      expect(key in flags).toBe(true);
    }
  });

  it('availableLayers = the unselected layers, straight from the map', () => {
    const available = unloadedLayers(ENCOUNTER_LAYERS, { codes: true });
    expect(available.map((l) => l.id)).not.toContain('codes');
    expect(available.find((l) => l.id === 'timing')?.label).toBe('KPI timing');
  });
});

// The per-field opt-in value domain is the ONE path by which real values reach the LLM. It is gated
// by the whitelist, samples distinct present values (codes + code labels), and is capped.
describe('per-field value domain (sampleDomains + whitelist gating)', () => {
  const rows = [
    { primaryIcd: 'H66.9', primaryIcdDisplay: 'Otitis media', patientName: 'Jane Doe', reason: 'ear pain' },
    { primaryIcd: 'J06.9', primaryIcdDisplay: 'Acute URI', patientName: 'John Roe', reason: 'cough' },
    { primaryIcd: 'H66.9', primaryIcdDisplay: 'Otitis media', patientName: 'Sam Poe', reason: 'ear pain' },
  ];

  it('samples distinct present values for whitelisted fields only, sorted', () => {
    const domains = sampleDomains(rows, ['primaryIcd', 'primaryIcdDisplay']);
    expect(domains.primaryIcd).toEqual(['H66.9', 'J06.9']);
    expect(domains.primaryIcdDisplay).toEqual(['Acute URI', 'Otitis media']);
    // A field NOT whitelisted is never sampled — no patient names / free text can leak.
    expect(domains.patientName).toBeUndefined();
    expect(domains.reason).toBeUndefined();
  });

  it('flattens array-valued code fields and skips empty/null', () => {
    const codeRows = [{ cptCodes: ['99213', '90686'] }, { cptCodes: ['99213'] }, { cptCodes: [] }, { cptCodes: null }];
    expect(sampleDomains(codeRows as Array<Record<string, unknown>>, ['cptCodes']).cptCodes).toEqual([
      '90686',
      '99213',
    ]);
  });

  it('omits a field whose distinct count exceeds the cap (too high-cardinality to disclose)', () => {
    const many = Array.from({ length: MAX_DOMAIN_VALUES + 5 }, (_, i) => ({ code: `C${i}` }));
    expect(sampleDomains(many, ['code']).code).toBeUndefined();
  });

  it('omits a field carrying narrative text — a clinician-typed value must never reach the prompt', () => {
    const narrative = `Discharged home with mother. ${'Wound care instructions reviewed. '.repeat(8)}`;
    const notes = [{ note: 'Please see your Primary Care Physician as discussed.' }, { note: narrative }];
    expect(narrative.length).toBeGreaterThan(MAX_DOMAIN_VALUE_LENGTH);
    // Fail closed: the whole field drops out, not just the long value.
    expect(sampleDomains(notes, ['note']).note).toBeUndefined();
  });

  it('attaches the sampled domain as "values" on the serialized field', () => {
    const [field] = llmFieldsFromZodObject(EncounterBaseRowSchema, [], { patientName: ['a', 'b'] }).filter(
      (f) => f.name === 'patientName'
    );
    // (patientName is used here only to prove the plumbing; the real whitelist never includes it.)
    expect(field.values).toEqual(['a', 'b']);
  });
});

// The leak boundary, checked against the REAL Zod schema of every dataset: build the LLM schema the
// exact way buildLlmDatasetSchema does — over rows where EVERY field is populated (so any field
// COULD leak if it were sampled) — and prove that the only field values drawn from the data are the
// whitelisted domain fields. Everything else carries no data-derived values; a z.enum's members are
// allowed (they are constants declared in code, not sampled from rows).
describe('data leak boundary — only whitelisted domain fields emit sampled values', () => {
  type LayerMap = AdHocLayerMap;

  const unwrap = (schema: z.ZodTypeAny): z.ZodTypeAny => {
    let s = schema;
    for (;;) {
      if (s instanceof z.ZodNullable || s instanceof z.ZodOptional) s = s.unwrap();
      else if (s instanceof z.ZodDefault) s = s._def.innerType;
      else break;
    }
    return s;
  };

  const fullShape = (base: z.ZodObject<z.ZodRawShape>, layers: LayerMap): Record<string, z.ZodTypeAny> => {
    const shape: Record<string, z.ZodTypeAny> = { ...base.shape };
    for (const def of Object.values(layers)) Object.assign(shape, def.schema.shape);
    return shape;
  };

  const valueFor = (inner: z.ZodTypeAny, name: string, salt: string): unknown => {
    if (inner instanceof z.ZodNumber) return 1;
    if (inner instanceof z.ZodBoolean) return true;
    if (inner instanceof z.ZodEnum) return (inner._def.values as string[])[0];
    return `${name}-${salt}`;
  };

  // A row with a present value for EVERY field of the schema — so a field's absence from the emitted
  // domains proves the WHITELIST gated it, not that the data happened to be empty.
  const fullRow = (shape: Record<string, z.ZodTypeAny>, salt: string): Record<string, unknown> => {
    const row: Record<string, unknown> = {};
    for (const [name, schema] of Object.entries(shape)) {
      const inner = unwrap(schema);
      if (inner instanceof z.ZodArray) row[name] = [valueFor(unwrap(inner.element as z.ZodTypeAny), name, salt)];
      else row[name] = valueFor(inner, name, salt);
    }
    return row;
  };

  const enumFieldNames = (shape: Record<string, z.ZodTypeAny>): Set<string> => {
    const set = new Set<string>();
    for (const [name, schema] of Object.entries(shape)) {
      let inner = unwrap(schema);
      if (inner instanceof z.ZodArray) inner = unwrap(inner.element as z.ZodTypeAny);
      if (inner instanceof z.ZodEnum) set.add(name);
    }
    return set;
  };

  const cases: Array<{
    name: string;
    base: z.ZodObject<z.ZodRawShape>;
    layers: LayerMap;
    internal: readonly string[];
    domain: readonly string[];
  }> = [
    {
      name: 'encounters',
      base: EncounterBaseRowSchema,
      layers: ENCOUNTER_LAYERS,
      internal: ENCOUNTER_INTERNAL_FIELDS,
      domain: ENCOUNTER_DOMAIN_FIELDS,
    },
    {
      name: 'billing',
      base: BillingBaseRowSchema,
      layers: BILLING_LAYERS,
      internal: BILLING_INTERNAL_FIELDS,
      domain: BILLING_DOMAIN_FIELDS,
    },
    {
      name: 'patients',
      base: PatientBaseRowSchema,
      layers: PATIENT_LAYERS,
      internal: PATIENT_INTERNAL_FIELDS,
      domain: PATIENT_DOMAIN_FIELDS,
    },
  ];

  it.each(cases)('$name: sampleDomains returns EXACTLY the whitelist over fully-populated rows', (c) => {
    const shape = fullShape(c.base, c.layers);
    const rows = [fullRow(shape, 'a'), fullRow(shape, 'b')];
    const domains = sampleDomains(rows, c.domain);
    // Not one field more, not one less — the whitelist is the precise set that leaves as data.
    expect(Object.keys(domains).sort()).toEqual([...c.domain].sort());
  });

  it.each(cases)('$name: in the serialized schema, only whitelist (or z.enum) fields carry values', (c) => {
    const shape = fullShape(c.base, c.layers);
    const rows = [fullRow(shape, 'a'), fullRow(shape, 'b')];
    const allSelected = Object.fromEntries(Object.keys(c.layers).map((id) => [id, true]));
    const domains = sampleDomains(rows, c.domain);
    const fields = llmFieldsForLayers(c.base, layerSchemas(c.layers), allSelected, c.internal, domains);

    const enums = enumFieldNames(shape);
    const allowedToHaveValues = new Set<string>([...c.domain, ...enums]);

    for (const field of fields) {
      if (field.values !== undefined) {
        // A field only carries values if it is a whitelisted domain field or a closed-vocab enum.
        expect(allowedToHaveValues.has(field.name)).toBe(true);
      }
    }
    // And every whitelisted field actually surfaced its sampled values (nothing silently dropped).
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
    for (const f of c.domain) expect(byName[f]?.values && byName[f].values!.length > 0).toBeTruthy();

    // Explicit spot check: a non-whitelisted identifier never carries data values.
    if (byName.patientName) expect(byName.patientName.values).toBeUndefined();
  });
});
