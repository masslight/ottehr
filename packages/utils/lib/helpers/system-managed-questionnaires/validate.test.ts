import { Questionnaire } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from '../../fhir/constants';
import { validateSystemManagedImport } from './validate';

const DATA_TYPE_URL = OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.dataType;

const URL = 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson';

// current active version: one harvest page (contact-information-page is a real pageHarvestStrategy key)
// and one plain page for isolated engine-level assertions.
const current: Questionnaire = {
  resourceType: 'Questionnaire',
  id: 'current-id',
  url: URL,
  version: '1.0.0',
  status: 'active',
  name: 'in-person',
  title: 'In person',
  item: [
    {
      linkId: 'contact-information-page',
      type: 'group',
      text: 'Contact',
      item: [
        { linkId: 'patient-street-address', type: 'string', text: 'Street' },
        { linkId: 'insurance-carrier', type: 'string', text: 'Carrier' },
      ],
    },
    {
      linkId: 'custom-page',
      type: 'group',
      text: 'Custom',
      item: [{ linkId: 'custom-field', type: 'string', text: 'Custom' }],
    },
  ],
};

// a clean, valid next-version draft
const makeDraft = (): any => {
  const draft: any = structuredClone(current);
  delete draft.id;
  draft.status = 'draft';
  draft.version = '1.0.1';
  return draft;
};

const errorsOf = (imported: unknown): string[] => {
  const result = validateSystemManagedImport({ imported, current });
  return result.ok ? [] : result.errors;
};

describe('validateSystemManagedImport — happy path', () => {
  it('accepts a clean patch-bumped draft', () => {
    const result = validateSystemManagedImport({ imported: makeDraft(), current });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bump).toBe('patch');
  });

  it('accepts a draft that carries the matching id', () => {
    const draft = makeDraft();
    draft.id = 'current-id';
    expect(validateSystemManagedImport({ imported: draft, current }).ok).toBe(true);
  });

  it('classifies minor and major bumps', () => {
    const minor = makeDraft();
    minor.version = '1.1.0';
    const minorResult = validateSystemManagedImport({ imported: minor, current });
    expect(minorResult.ok && minorResult.bump).toBe('minor');

    const major = makeDraft();
    major.version = '2.0.0';
    const majorResult = validateSystemManagedImport({ imported: major, current });
    expect(majorResult.ok && majorResult.bump).toBe('major');
  });
});

describe('validateSystemManagedImport — basic identity/versioning', () => {
  it('blocks wrong resourceType', () => {
    const draft = makeDraft();
    draft.resourceType = 'ValueSet';
    expect(errorsOf(draft).some((e) => e.includes('resourceType'))).toBe(true);
  });

  it('blocks non-draft status', () => {
    const draft = makeDraft();
    draft.status = 'active';
    expect(errorsOf(draft).some((e) => e.includes('status'))).toBe(true);
  });

  it('blocks url mismatch', () => {
    const draft = makeDraft();
    draft.url = 'https://ottehr.com/FHIR/Questionnaire/something-else';
    expect(errorsOf(draft).some((e) => e.includes('url'))).toBe(true);
  });

  it('blocks a present but mismatched id', () => {
    const draft = makeDraft();
    draft.id = 'different-id';
    expect(errorsOf(draft).some((e) => e.includes('id'))).toBe(true);
  });

  it('blocks a non-bumped version', () => {
    const draft = makeDraft();
    draft.version = '1.0.0';
    expect(errorsOf(draft).some((e) => e.includes('semver increase'))).toBe(true);
  });

  it('blocks a non-semver version', () => {
    const draft = makeDraft();
    draft.version = '1.0';
    expect(errorsOf(draft).some((e) => e.includes('semver'))).toBe(true);
  });
});

describe('validateSystemManagedImport — engine renderability', () => {
  it('blocks an unsupported item type', () => {
    const draft = makeDraft();
    draft.item[1].item[0].type = 'integer';
    expect(errorsOf(draft).some((e) => e.includes('unsupported type'))).toBe(true);
  });

  it('blocks a choice item with no options', () => {
    const draft = makeDraft();
    draft.item[1].item[0].type = 'choice'; // custom-field -> choice with no answerOption
    expect(errorsOf(draft).some((e) => e.includes('no options'))).toBe(true);
  });

  it('blocks duplicate linkIds', () => {
    const draft = makeDraft();
    draft.item[1].item[0].linkId = 'patient-street-address';
    expect(errorsOf(draft).some((e) => e.includes('Duplicate linkId'))).toBe(true);
  });

  it('blocks a non-group top-level item', () => {
    const draft = makeDraft();
    draft.item[1].type = 'string';
    expect(errorsOf(draft).some((e) => e.includes('must be a group'))).toBe(true);
  });

  it('blocks an enableWhen referencing an unknown question', () => {
    const draft = makeDraft();
    draft.item[1].item[0].enableWhen = [{ question: 'does-not-exist', operator: '=', answerString: 'x' }];
    expect(errorsOf(draft).some((e) => e.includes('unknown question'))).toBe(true);
  });

  it('allows an enableWhen referencing $status', () => {
    const draft = makeDraft();
    draft.item[1].item[0].enableWhen = [{ question: '$status', operator: '!=', answerString: 'completed' }];
    expect(errorsOf(draft).some((e) => e.includes('unknown question'))).toBe(false);
  });

  it('blocks an invalid enumerated extension value', () => {
    const draft = makeDraft();
    draft.item[1].item[0].extension = [{ url: DATA_TYPE_URL, valueString: 'Nonsense' }];
    expect(errorsOf(draft).some((e) => e.includes('invalid value'))).toBe(true);
  });
});

describe('validateSystemManagedImport — harvest regression', () => {
  it('blocks removing a harvest field', () => {
    const draft = makeDraft();
    draft.item[0].item = draft.item[0].item.filter((i: any) => i.linkId !== 'insurance-carrier');
    expect(errorsOf(draft).some((e) => e.includes('insurance-carrier') && e.includes('removed'))).toBe(true);
  });

  it('blocks changing a harvest field type', () => {
    const draft = makeDraft();
    draft.item[0].item[1].type = 'boolean'; // insurance-carrier string -> boolean
    expect(errorsOf(draft).some((e) => e.includes('insurance-carrier') && e.includes('changed type'))).toBe(true);
  });

  it('blocks removing a harvest page', () => {
    const draft = makeDraft();
    draft.item[0] = {
      linkId: 'unrelated-page',
      type: 'group',
      text: 'Unrelated',
      item: [{ linkId: 'unrelated-field', type: 'string', text: 'x' }],
    };
    expect(errorsOf(draft).some((e) => e.includes('contact-information-page') && e.includes('missing'))).toBe(true);
  });

  it('does not flag harvest changes when the form has no harvest pages', () => {
    const noHarvestCurrent: Questionnaire = {
      ...current,
      item: [current.item![1]],
    };
    const draft: any = structuredClone(noHarvestCurrent);
    delete draft.id;
    draft.status = 'draft';
    draft.version = '1.0.1';
    draft.item[0].item = []; // would be a harvest problem if this were a harvest page
    // engine will still complain the page is empty, but there should be no harvest error
    const result = validateSystemManagedImport({ imported: draft, current: noHarvestCurrent });
    const errors = result.ok ? [] : result.errors;
    expect(errors.some((e) => e.toLowerCase().includes('harvest'))).toBe(false);
  });
});
