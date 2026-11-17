import { Page } from '@playwright/test';
import { RELATIONSHIP_OPTIONS } from 'utils/lib/fhir/patientMasterRecord';
import { INSURANCE_PAY_OPTION } from 'utils/lib/ottehr-config/value-sets';
import { describe, expect, it, vi } from 'vitest';
import { PagedQuestionnaireFlowHelper } from '../utils/paperwork/PagedQuestionnaireFlowHelper';

vi.mock('../utils/locators', () => ({ Locators: class {} }));
vi.mock('../utils/UploadDocs', () => ({ UploadDocs: class {} }));

const createHelper = (): { helper: PagedQuestionnaireFlowHelper; fill: ReturnType<typeof vi.spyOn> } => {
  const page = {
    locator: () => ({ first: () => ({ count: async () => 0 }) }),
  } as unknown as Page;
  const helper = new PagedQuestionnaireFlowHelper(page);
  const fill = vi.spyOn(helper, 'fillField').mockResolvedValue();
  return { helper, fill };
};

describe('paperwork conditional trigger fields', () => {
  it('skips the relationship trigger while its payment option is absent', async () => {
    const { helper, fill } = createHelper();

    await helper.fillPage({ 'patient-relationship-to-insured': RELATIONSHIP_OPTIONS.Self });

    expect(fill).not.toHaveBeenCalled();
  });

  it('fills the enabled relationship trigger before its Other text field', async () => {
    const { helper, fill } = createHelper();
    const values = {
      'payment-option': INSURANCE_PAY_OPTION,
      'patient-relationship-to-insured': RELATIONSHIP_OPTIONS.Other,
      'patient-relationship-to-insured-other': 'Grandchild',
    };

    await helper.fillPage(values);

    expect(fill.mock.calls).toEqual(Object.entries(values));
  });

  it('skips leftover Other text when a different relationship is selected', async () => {
    const { helper, fill } = createHelper();

    await helper.fillPage({
      'payment-option': INSURANCE_PAY_OPTION,
      'patient-relationship-to-insured': RELATIONSHIP_OPTIONS.Self,
      'patient-relationship-to-insured-other': 'Grandchild',
    });

    expect(fill.mock.calls).toEqual([
      ['payment-option', INSURANCE_PAY_OPTION],
      ['patient-relationship-to-insured', RELATIONSHIP_OPTIONS.Self],
    ]);
  });
});
