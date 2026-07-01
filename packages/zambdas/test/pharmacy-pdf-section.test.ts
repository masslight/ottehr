import { Organization } from 'fhir/r4b';
import { PHONE_NOT_ON_FILE } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { composePharmacyData, createPharmacyFormsSection } from '../src/shared/pdf/sections/pharmacyInfo';
import { PdfAssets, PdfClient, PdfStyles, pharmacyInfo } from '../src/shared/pdf/types';

const pharmacy: Organization = {
  resourceType: 'Organization',
  id: 'pharmacy',
  name: 'Walgreens',
  address: [
    {
      text: '123 Pineapple St, Brooklyn, NY 11201',
    },
  ],
  telecom: [
    {
      system: 'phone',
      value: '(555) 867-5309',
    },
  ],
};

describe('composePharmacyData', () => {
  it('composes name, address and phone from the pharmacy Organization', () => {
    expect(composePharmacyData(pharmacy)).toEqual({
      name: 'Walgreens',
      address: '123 Pineapple St, Brooklyn, NY 11201',
      phone: '(555) 867-5309',
    });
  });

  it('composes an empty address when the pharmacy has none', () => {
    const noAddress: Organization = {
      ...pharmacy,
      address: undefined,
    };
    expect(composePharmacyData(noAddress).address).toBe('');
  });

  it('composes an empty phone when the pharmacy has no phone telecom', () => {
    const noPhone: Organization = {
      ...pharmacy,
      telecom: [
        {
          system: 'fax',
          value: '(555) 999-8888',
        },
      ],
    };
    expect(composePharmacyData(noPhone).phone).toBe('');
  });

  it('composes empty fields when there is no pharmacy', () => {
    expect(composePharmacyData(undefined)).toEqual({
      name: '',
      address: '',
      phone: '',
    });
  });
});

describe('createPharmacyFormsSection', () => {
  const section = createPharmacyFormsSection<{ pharmacy?: pharmacyInfo }>();

  const renderSection = (data: pharmacyInfo): ReturnType<typeof vi.fn> => {
    const drawLabelValueRow = vi.fn();
    const client = { drawLabelValueRow } as unknown as PdfClient;
    const styles = { textStyles: { regular: {} } } as unknown as PdfStyles;
    section.render(client, data, styles, {} as PdfAssets);
    return drawLabelValueRow;
  };

  it('titles the section and selects the pharmacy off the pdf data', () => {
    expect(section.title).toBe('Preferred pharmacy');
    const data = composePharmacyData(pharmacy);
    expect(section.dataSelector({ pharmacy: data })).toBe(data);
    expect(section.dataSelector({})).toBeUndefined();
  });

  it('is not statically skipped by the patient record config', () => {
    expect(section.skip).toBe(false);
  });

  it('draws name, address and phone rows in order', () => {
    const drawLabelValueRow = renderSection(composePharmacyData(pharmacy));

    const labelsAndValues = drawLabelValueRow.mock.calls.map((call) => [call[0], call[1]]);
    expect(labelsAndValues).toEqual([
      ['Pharmacy name', 'Walgreens'],
      ['Pharmacy address', '123 Pineapple St, Brooklyn, NY 11201'],
      ['Pharmacy phone', '(555) 867-5309'],
    ]);
  });

  it('draws a divider after name and address and closes the section after the phone row', () => {
    const drawLabelValueRow = renderSection(composePharmacyData(pharmacy));

    const [, , , , nameOptions] = drawLabelValueRow.mock.calls[0];
    const [, , , , addressOptions] = drawLabelValueRow.mock.calls[1];
    const [, , , , phoneOptions] = drawLabelValueRow.mock.calls[2];
    expect(nameOptions).toEqual({
      drawDivider: true,
      dividerMargin: 8,
    });
    expect(addressOptions).toEqual({
      drawDivider: true,
      dividerMargin: 8,
    });
    expect(phoneOptions).toEqual({
      defaultValue: PHONE_NOT_ON_FILE,
      spacing: 16,
    });
  });

  it('falls back to the not-on-file default when the phone is empty', () => {
    const drawLabelValueRow = renderSection(composePharmacyData(undefined));

    const [label, value, , , options] = drawLabelValueRow.mock.calls[2];
    expect(label).toBe('Pharmacy phone');
    expect(value).toBe('');
    expect(options.defaultValue).toBe(PHONE_NOT_ON_FILE);
  });
});
