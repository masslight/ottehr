import { describe, expect, it } from 'vitest';
import { getCvxVaccine, getMvxManufacturer } from './vaccine-lookup';

describe('getCvxVaccine', () => {
  it('finds a vaccine of the list by its CVX code', () => {
    expect(getCvxVaccine('115')).toMatchObject({ cvx: '115', name: 'Tdap' });
  });

  it('finds nothing for a code the list does not have, or for no code', () => {
    expect(getCvxVaccine('a3f1c2d4-0000-4000-8000-000000000001')).toBeUndefined();
    expect(getCvxVaccine('')).toBeUndefined();
    expect(getCvxVaccine(undefined)).toBeUndefined();
  });
});

describe('getMvxManufacturer', () => {
  it('finds a manufacturer of the list by its MVX code', () => {
    expect(getMvxManufacturer('MSD')).toEqual({ mvx: 'MSD', name: 'Merck and Co., Inc.' });
  });

  it('finds nothing for a code the list does not have, or for no code', () => {
    expect(getMvxManufacturer('1111fff')).toBeUndefined();
    // codes are matched as the list writes them
    expect(getMvxManufacturer('msd')).toBeUndefined();
    expect(getMvxManufacturer('')).toBeUndefined();
    expect(getMvxManufacturer(undefined)).toBeUndefined();
  });
});
