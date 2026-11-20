import { describe, expect, it } from 'vitest';
import { getSpecialtyTransferSelectOptions, OTHER_SPECIALTY_TRANSFER_OPTION } from './disposition';

describe('getSpecialtyTransferSelectOptions', () => {
  it('sorts the configured specialties and offers Other last', () => {
    expect(getSpecialtyTransferSelectOptions(['Urology', 'Cardiologist', 'ENT'])).toEqual([
      'Cardiologist',
      'ENT',
      'Urology',
      OTHER_SPECIALTY_TRANSFER_OPTION,
    ]);
  });

  it('keeps a selected specialty that is no longer configured, in sorted position', () => {
    expect(getSpecialtyTransferSelectOptions(['Urology', 'Cardiologist'], 'Neurology')).toEqual([
      'Cardiologist',
      'Neurology',
      'Urology',
      OTHER_SPECIALTY_TRANSFER_OPTION,
    ]);
  });

  it('does not repeat a selected specialty that is configured', () => {
    expect(getSpecialtyTransferSelectOptions(['Urology', 'Cardiologist'], 'Urology')).toEqual([
      'Cardiologist',
      'Urology',
      OTHER_SPECIALTY_TRANSFER_OPTION,
    ]);
  });

  it.each(['', OTHER_SPECIALTY_TRANSFER_OPTION, undefined])('adds nothing for the selection %j', (current) => {
    expect(getSpecialtyTransferSelectOptions(['Urology'], current)).toEqual([
      'Urology',
      OTHER_SPECIALTY_TRANSFER_OPTION,
    ]);
  });
});
