// A procedure quick-pick asserts far more than the provider said. What gets carried, and what must not.
//
// "I did an incision and drainage" is five words. The practice's quick-pick behind it fills a body site,
// a technique, supplies, complications, the patient's response, and the time spent — and two of those
// are claims a provider could be asked to defend. This is the seam where the template's contribution
// stops being distinguishable from the dictation unless the code keeps them apart, so it is tested
// directly rather than through the page.

import { describe, expect, it } from 'vitest';
import {
  linkQuickPickCodes,
  procedureQuickPickContext,
  templateFilledFields,
} from '../../src/features/easy-chart/executor/procedure-quick-pick';
import { CPTCodeDTO, DiagnosisDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ProcedureQuickPickData } from 'utils/lib/types/api/quick-picks.types';

const NOW = '2026-08-17T15:04:05.000Z';
const TYPE_NAMES = new Map([['incision-and-drainage', 'Incision and Drainage']]);

const quickPick = (overrides: Partial<ProcedureQuickPickData> = {}): ProcedureQuickPickData => ({
  name: 'I&D of abscess',
  procedureType: 'incision-and-drainage',
  ...overrides,
});

describe('what a quick-pick is allowed to assert', () => {
  // The one that matters most. A quick-pick may well store `consentObtained: true` — it is a template,
  // and the admin who wrote it ticked the box. Nothing in a dictation establishes that consent was
  // obtained from THIS patient, and the field is exactly the kind a provider would be asked about.
  it('never carries consentObtained, even when the quick-pick sets it', () => {
    const { dto } = procedureQuickPickContext(quickPick({ consentObtained: true }), TYPE_NAMES, NOW);
    expect(dto.consentObtained).toBeUndefined();
  });

  // Mirrors the regular page, which excludes it from QUICK_PICK_APPLY_KEYS as encounter-specific: who
  // performed the procedure is a fact about this visit, not about the template.
  it('never carries performerType', () => {
    const { dto } = procedureQuickPickContext(quickPick({ performerType: 'Provider' }), TYPE_NAMES, NOW);
    expect(dto.performerType).toBeUndefined();
  });

  it('resolves procedureType to the name the dropdown shows, not the code', () => {
    const { dto } = procedureQuickPickContext(quickPick(), TYPE_NAMES, NOW);
    expect(dto.procedureType).toBe('Incision and Drainage');
  });

  it('falls back to the code when the value set has not loaded', () => {
    // Degraded, not broken: a procedure charted under a kebab-case type is recoverable; one not
    // charted at all loses a billable item.
    const { dto } = procedureQuickPickContext(quickPick(), new Map(), NOW);
    expect(dto.procedureType).toBe('incision-and-drainage');
  });

  it('stamps both timestamps from the clock it is given', () => {
    const { dto } = procedureQuickPickContext(quickPick(), TYPE_NAMES, NOW);
    expect(dto.procedureDateTime).toBe(NOW);
    expect(dto.documentedDateTime).toBe(NOW);
  });
});

describe('the "Other" free-text fields', () => {
  // Multi-select procedure fields are STORED as one comma-joined string that the regular page re-splits
  // on load, and "Other: <text>" has to come last because everything after "Other:" is read back as the
  // free text. A private join here would round-trip a provider's own words as a catalogue option.
  it('serializes a free-text supply last, so it parses back as free text', () => {
    const { dto } = procedureQuickPickContext(
      quickPick({ suppliesUsed: ['Scalpel', 'Gauze'], otherSuppliesUsed: 'iodoform packing' }),
      TYPE_NAMES,
      NOW
    );
    expect(dto.suppliesUsed).toBe('Scalpel, Gauze, Other: iodoform packing');
  });

  it('leaves a multi-select alone when there is no free text', () => {
    const { dto } = procedureQuickPickContext(quickPick({ postInstructions: ['Keep dry', 'Return in 2 days'] }), TYPE_NAMES, NOW);
    expect(dto.postInstructions).toBe('Keep dry, Return in 2 days');
  });

  it('unwraps a single-select "Other" to its free text', () => {
    const { dto } = procedureQuickPickContext(
      quickPick({ complications: 'Other', otherComplications: 'minor bleeding, controlled' }),
      TYPE_NAMES,
      NOW
    );
    expect(dto.complications).toBe('minor bleeding, controlled');
  });

  it('keeps a predefined single-select value as it is', () => {
    const { dto } = procedureQuickPickContext(quickPick({ complications: 'None' }), TYPE_NAMES, NOW);
    expect(dto.complications).toBe('None');
  });
});

describe('which fields need their own confirmation', () => {
  it('lists every field the template filled', () => {
    const { templateFilledFields: fields } = procedureQuickPickContext(
      quickPick({
        bodySite: 'Left forearm',
        technique: ['Simple'],
        complications: 'None',
        patientResponse: 'Tolerated well',
        timeSpent: '15 minutes',
      }),
      TYPE_NAMES,
      NOW
    );
    expect(fields).toEqual(['bodySite', 'technique', 'complications', 'patientResponse', 'timeSpent']);
  });

  // Crying wolf on the dictated part would teach providers to click past the markers that matter.
  it('does not mark the procedure’s own identity as a template default', () => {
    const { templateFilledFields: fields } = procedureQuickPickContext(quickPick(), TYPE_NAMES, NOW);
    expect(fields).toEqual([]);
    expect(fields).not.toContain('procedureType');
  });

  it('ignores an empty or blank value', () => {
    expect(templateFilledFields({ bodySite: '', technique: [], procedureDetails: '   ' })).toEqual([]);
  });

  // A false boolean is a STATED "no", not an absent value, so it is an assertion like any other.
  it('counts a false boolean as filled', () => {
    expect(templateFilledFields({ specimenSent: false })).toEqual(['specimenSent']);
  });
});

describe('linking the quick-pick’s codes without duplicating them', () => {
  const charted: DiagnosisDTO[] = [{ resourceId: 'dx-existing', code: 'L02.419', display: 'Abscess of limb', isPrimary: true }];

  // THE regression: the plan charts "abscess of limb" from the dictation, then the I&D quick-pick
  // carries the same code. Saving it again left the note with the diagnosis twice.
  it('reuses a code already on the chart instead of creating a second row', () => {
    const { toCreate, existing } = linkQuickPickCodes(
      [{ code: 'L02.419', display: 'Abscess of limb', isPrimary: false }],
      charted
    );
    expect(toCreate).toEqual([]);
    expect(existing).toEqual([charted[0]]);
  });

  it('creates a code the chart does not have yet', () => {
    const wanted: CPTCodeDTO[] = [{ code: '10060', display: 'I&D of abscess, simple' }];
    const { toCreate, existing } = linkQuickPickCodes(wanted, []);
    expect(toCreate).toEqual(wanted);
    expect(existing).toEqual([]);
  });

  it('splits a mixed set both ways', () => {
    const { toCreate, existing } = linkQuickPickCodes(
      [
        { code: 'L02.419', display: 'Abscess of limb', isPrimary: false },
        { code: 'R50.9', display: 'Fever, unspecified', isPrimary: false },
      ],
      charted
    );
    expect(toCreate.map((row) => row.code)).toEqual(['R50.9']);
    expect(existing.map((row) => row.resourceId)).toEqual(['dx-existing']);
  });

  // A procedure's linked diagnoses are SUPPORTING dx. Promoting one to primary would silently override
  // the provider's own call about what this visit was for.
  it('never marks a linked diagnosis primary', () => {
    const { diagnoses } = procedureQuickPickContext(
      quickPick({ diagnoses: [{ code: 'L02.419', display: 'Abscess of limb' }] }),
      TYPE_NAMES,
      NOW
    );
    expect(diagnoses).toEqual([{ code: 'L02.419', display: 'Abscess of limb', isPrimary: false }]);
  });
});
