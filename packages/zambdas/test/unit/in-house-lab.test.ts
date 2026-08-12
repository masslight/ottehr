import { ActivityDefinition } from 'fhir/r4b';
import { AdminInHouseLabItemDefinition } from 'utils';
import {
  convertAdminInHouseLabItemDefinitionToActivityDefinition,
  getInHouseLabTestUrlAndVersion,
  parseActivityDefinitionToAdminInHouseLabItemDef,
  sanitizeForId,
} from '../../src/ehr/lab/shared/in-house-labs';
import activityDefinitions from '../data/in-house-lab-activity-definitions.json';
import { adminTestItemConfigs } from '../data/in-house-lab-admin-test-config';

type ActivityDefToAdminItemConfig = {
  [K in keyof typeof adminTestItemConfigs]: {
    activityDef: ActivityDefinition;
    adminTestItem: AdminInHouseLabItemDefinition;
  };
};

const ACTIVITY_DEF_TO_ADMIN_ITEM_CONFIG: ActivityDefToAdminItemConfig = {
  // tests free text component and free text validation
  snellen: {
    activityDef: activityDefinitions.snellen.resource as ActivityDefinition,
    adminTestItem: adminTestItemConfigs.snellen,
  },
  // tests a whole bunch of component types and size
  urinalysis: {
    activityDef: activityDefinitions.urinalysis.resource as ActivityDefinition,
    adminTestItem: adminTestItemConfigs.urinalysis,
  },
  // tests a radio display component
  'covid19-antigen': {
    activityDef: activityDefinitions['covid19-antigen'].resource as ActivityDefinition,
    adminTestItem: adminTestItemConfigs['covid19-antigen'],
  },
  // the two alcohol tests handle reflex logic both from a parent and child test perspective
  'alcohol-test': {
    activityDef: activityDefinitions['alcohol-test'].resource as ActivityDefinition,
    adminTestItem: adminTestItemConfigs['alcohol-test'],
  },
  'alcohol-confirmation': {
    activityDef: activityDefinitions['alcohol-confirmation'].resource as ActivityDefinition,
    adminTestItem: adminTestItemConfigs['alcohol-confirmation'],
  },
  // tests commas in the item's name, and also all result values being non-abnormal
  'hcg-comma': {
    activityDef: activityDefinitions['hcg-comma'].resource as ActivityDefinition,
    adminTestItem: adminTestItemConfigs['hcg-comma'],
  },
};

describe('In-house admin tests', () => {
  describe('Admin test item configs convert to ActivityDefinitions properly', () => {
    Object.keys(ACTIVITY_DEF_TO_ADMIN_ITEM_CONFIG).forEach((key) => {
      const { activityDef, adminTestItem } = ACTIVITY_DEF_TO_ADMIN_ITEM_CONFIG[key];

      it(`${key} admin -> activityDef`, () => {
        const result = convertAdminInHouseLabItemDefinitionToActivityDefinition(adminTestItem);
        console.log('>>>this is the admin result', result);
        expect(result).toEqual(activityDef);
        expect(result.url).not.toContain(',');
      });
    });
  });

  describe('ActivityDefinitions convert to admin test item configs properly', () => {
    Object.keys(ACTIVITY_DEF_TO_ADMIN_ITEM_CONFIG).forEach((key) => {
      const { activityDef, adminTestItem } = ACTIVITY_DEF_TO_ADMIN_ITEM_CONFIG[key];

      it(`${key} activityDef -> admin`, () => {
        const result = parseActivityDefinitionToAdminInHouseLabItemDef(activityDef);

        expect(result).toEqual(adminTestItem);
      });
    });
  });
});

describe('sanitizeForId', () => {
  it('passes through a clean alphanumeric string unchanged', () => {
    expect(sanitizeForId('CBC')).toBe('CBC');
  });

  it('converts commas to hyphens', () => {
    expect(sanitizeForId('a,b')).toBe('a-b');
  });

  it('preserves existing hyphens', () => {
    expect(sanitizeForId('a-b')).toBe('a-b');
  });

  it('strips spaces', () => {
    expect(sanitizeForId('Complete Blood Count')).toBe('CompleteBloodCount');
  });

  it('strips parentheses', () => {
    expect(sanitizeForId('CO2 (Total)')).toBe('CO2Total');
  });

  it('converts dots to hyphens', () => {
    expect(sanitizeForId('v1.2.3')).toBe('v1-2-3');
  });

  it('strips percent signs', () => {
    expect(sanitizeForId('50%')).toBe('50');
  });

  it('strips ampersands', () => {
    expect(sanitizeForId('A&B')).toBe('AB');
  });

  it('strips forward slashes', () => {
    expect(sanitizeForId('mL/dL')).toBe('mLdL');
  });

  it('handles a realistic lab test name with commas, spaces, and parens', () => {
    expect(sanitizeForId('Hepatitis B (surface Ag), IgM')).toBe('HepatitisBsurfaceAg-IgM');
  });

  it('returns an empty string when the entire input is non-alphanumeric non-structure characters', () => {
    expect(sanitizeForId('%%%')).toBe('');
  });

  it('converts dots to hyphens rather than stripping them', () => {
    expect(sanitizeForId('...')).toBe('---');
  });
});

describe('getInHouseLabTestUrlAndVersion — URL segment generation', () => {
  const makeItem = (name: string): AdminInHouseLabItemDefinition =>
    ({ name }) as unknown as AdminInHouseLabItemDefinition;

  it('removes spaces from the URL segment', () => {
    const { url } = getInHouseLabTestUrlAndVersion(makeItem('Complete Blood Count'), {});
    expect(url).toContain('/CompleteBloodCount');
  });

  it('converts commas to hyphens in the URL segment', () => {
    const { url } = getInHouseLabTestUrlAndVersion(makeItem('HCG, Urine'), {});
    expect(url).toContain('/HCG-Urine');
  });

  it('preserves parentheses in the URL segment for backward compatibility', () => {
    const { url } = getInHouseLabTestUrlAndVersion(makeItem('Urinalysis (UA)'), {});
    expect(url).toContain('/Urinalysis(UA)');
  });

  it('preserves dots in the URL segment', () => {
    const { url } = getInHouseLabTestUrlAndVersion(makeItem('Test v1.2'), {});
    expect(url).toContain('/Testv1.2');
  });
});
