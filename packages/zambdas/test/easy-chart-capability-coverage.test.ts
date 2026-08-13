// Keeps the capability registry, the three response schemas, and the three PROMPTS describing them
// in agreement.
//
// The schemas are generated from the registry, so those can't drift. The prompts can: their prose is
// hand-tuned against eval runs and deliberately NOT generated, which means a capability can be added
// to the vocabulary — schema updated, client handler written, everything type-checking — while no
// prompt ever tells the model the action exists. The model then never emits it and the feature looks
// like it "doesn't work" with nothing failing anywhere. These tests are what turn that into a red
// build: offer a capability on a surface, and that surface's prompt has to mention it.
import { EASY_CHART_INTENT_KINDS } from 'utils';
import {
  EASY_CHART_CAPABILITIES,
  EASY_CHART_INTENT_FIELD_SCHEMAS,
  EASY_CHART_NON_CHART_DATA_TARGETS,
  EASY_CHART_SURFACE_FIELDS,
  EASY_CHART_SURFACES,
  easyChartFieldForKind,
  easyChartIntentHasRequiredFields,
  easyChartKindsForSurface,
  type EasyChartSurface,
} from 'utils/lib/helpers/easy-chart-capabilities';
import { describe, expect, it } from 'vitest';
import { buildPrompt as buildAgentPrompt, RESPONSE_SCHEMA as AGENT_SCHEMA } from '../src/ehr/easy-chart-agent/index';
import { buildPrompt as buildPlannerPrompt } from '../src/ehr/easy-chart-planner/index';
import { buildPrompt as buildReviewPrompt, RESPONSE_SCHEMA as REVIEW_SCHEMA } from '../src/ehr/easy-chart-review/index';
import { RESPONSE_SCHEMA as PLANNER_SCHEMA } from '../src/shared/easy-chart/planner-core';

// Every kind that isn't itself a charting ACTION — these need no prompt documentation of an action
// shape (the prompts describe them, but under their own headings, not as an action to emit).
const NON_ACTION_KINDS = new Set(['unknown']);

const PROMPTS: Record<EasyChartSurface, string> = {
  agent: buildAgentPrompt('test message'),
  planner: buildPlannerPrompt('test narrative'),
  review: buildReviewPrompt('test narrative'),
};

const SCHEMA_PROPERTIES: Record<EasyChartSurface, Record<string, unknown>> = {
  agent: (AGENT_SCHEMA.properties.intent as { properties: Record<string, unknown> }).properties,
  planner: (
    (PLANNER_SCHEMA.properties.steps as { items: { properties: Record<string, unknown> } }).items as {
      properties: Record<string, unknown>;
    }
  ).properties,
  review: (
    (
      (REVIEW_SCHEMA.properties.suggestions as { items: { properties: Record<string, unknown> } }).items as {
        properties: { actions: { items: { properties: Record<string, unknown> } } };
      }
    ).properties.actions.items as { properties: Record<string, unknown> }
  ).properties,
};

describe('easy-chart capability registry', () => {
  it('covers every intent kind', () => {
    for (const kind of EASY_CHART_INTENT_KINDS) {
      expect(EASY_CHART_CAPABILITIES[kind], `no capability entry for "${kind}"`).toBeDefined();
    }
    // And nothing extra: an entry for a kind that no longer exists is dead configuration.
    const known = new Set<string>(EASY_CHART_INTENT_KINDS);
    for (const kind of Object.keys(EASY_CHART_CAPABILITIES)) {
      expect(known.has(kind), `capability "${kind}" is not in EASY_CHART_INTENT_KINDS`).toBe(true);
    }
  });

  it('declares at least one surface per capability', () => {
    for (const [kind, capability] of Object.entries(EASY_CHART_CAPABILITIES)) {
      expect(capability.surfaces.length, `"${kind}" is offered on no surface, so nothing can emit it`).toBeGreaterThan(
        0
      );
    }
  });

  it('only requires fields the surfaces it runs on actually declare', () => {
    for (const [kind, capability] of Object.entries(EASY_CHART_CAPABILITIES)) {
      for (const surface of capability.surfaces) {
        for (const field of capability.required) {
          expect(
            EASY_CHART_SURFACE_FIELDS[surface].includes(field),
            `"${kind}" requires "${field}" on the ${surface} surface, but that surface's schema has no such field — ` +
              'the model could never satisfy it and every one of these would be rejected'
          ).toBe(true);
        }
      }
    }
  });

  // Ties the assistant's vocabulary to the ZAMBDA contract it writes through. Every kind either names
  // the chart-data property it writes (typed keyof AllChartValues, so a renamed DTO property is a
  // build error) or records which other zambda it goes through. Neither → someone added a capability
  // without saying where its data lands.
  it('every kind names its write target', () => {
    const unaccounted = EASY_CHART_INTENT_KINDS.filter(
      (kind) => !easyChartFieldForKind(kind) && !EASY_CHART_NON_CHART_DATA_TARGETS[kind]
    );
    expect(
      unaccounted,
      `No write target recorded for: ${unaccounted.join(', ')}. Give each a chartField (when it lands ` +
        'in save-chart-data) or an EASY_CHART_NON_CHART_DATA_TARGETS entry naming the zambda it uses.'
    ).toEqual([]);
  });

  it('never records both a chart field and a non-chart-data target', () => {
    for (const kind of EASY_CHART_INTENT_KINDS) {
      const both = !!easyChartFieldForKind(kind) && !!EASY_CHART_NON_CHART_DATA_TARGETS[kind];
      expect(both, `"${kind}" claims both a chartField and a non-chart-data target`).toBe(false);
    }
  });

  it('every surface field has a schema fragment', () => {
    for (const surface of EASY_CHART_SURFACES) {
      for (const field of EASY_CHART_SURFACE_FIELDS[surface]) {
        expect(EASY_CHART_INTENT_FIELD_SCHEMAS[field], `no schema for field "${field}"`).toBeDefined();
      }
    }
  });
});

describe('generated schemas match the registry', () => {
  for (const surface of EASY_CHART_SURFACES) {
    it(`${surface}: kind enum is exactly the capabilities offered on it`, () => {
      const enumValues = (SCHEMA_PROPERTIES[surface].kind as { enum: string[] }).enum;
      expect([...enumValues].sort()).toEqual([...easyChartKindsForSurface(surface)].sort());
    });

    it(`${surface}: declares every field the registry lists for it, and no others`, () => {
      const declared = Object.keys(SCHEMA_PROPERTIES[surface]).filter((k) => k !== 'kind');
      expect(declared).toEqual([...EASY_CHART_SURFACE_FIELDS[surface]]);
    });

    // The digit-loop guard, re-asserted through the registry: a raw JSON number has no closing token
    // under Vertex constrained decoding, so one stray numeric field can run to the token cap.
    it(`${surface}: has no raw number fields`, () => {
      for (const [field, schema] of Object.entries(SCHEMA_PROPERTIES[surface])) {
        expect((schema as { type?: string }).type, `${field} must not be type "number"`).not.toBe('number');
      }
    });
  }
});

describe('prompts document every capability they offer', () => {
  for (const surface of EASY_CHART_SURFACES) {
    it(`${surface} prompt names each of its action kinds`, () => {
      const prompt = PROMPTS[surface];
      const undocumented = easyChartKindsForSurface(surface)
        .filter((kind) => !NON_ACTION_KINDS.has(kind))
        .filter((kind) => !prompt.includes(kind));
      expect(
        undocumented,
        `The ${surface} prompt never mentions: ${undocumented.join(', ')}. ` +
          'A capability the prompt does not describe can never be emitted — document it in that ' +
          "surface's buildPrompt, or drop the surface from its registry entry."
      ).toEqual([]);
    });
  }
});

describe('required-field gate', () => {
  it('rejects an intent missing its required field', () => {
    expect(easyChartIntentHasRequiredFields('add-diagnosis', { display: 'Otitis media' })).toBe(true);
    expect(easyChartIntentHasRequiredFields('add-diagnosis', {})).toBe(false);
    expect(easyChartIntentHasRequiredFields('add-diagnosis', { display: '   ' })).toBe(false);
  });

  it('rejects an unknown kind outright', () => {
    expect(easyChartIntentHasRequiredFields('add-imaginary-thing', { display: 'x' })).toBe(false);
  });

  it('accepts kinds that require nothing', () => {
    expect(easyChartIntentHasRequiredFields('remove-em-code', {})).toBe(true);
  });

  it('treats an empty array as missing', () => {
    expect(easyChartIntentHasRequiredFields('update-procedure', { updates: [] })).toBe(false);
    expect(
      easyChartIntentHasRequiredFields('update-procedure', { updates: [{ field: 'bodySite', value: 'arm' }] })
    ).toBe(true);
  });
});
