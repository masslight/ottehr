import { ActivityDefinition } from 'fhir/r4b';
import { AdminInHouseLabItemDefinition } from 'utils';
import {
  convertAdminInHouseLabItemDefinitionToActivityDefinition,
  parseActivityDefinitionToAdminInHouseLabItemDef,
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
  // tests commas in teh item's name, and also all result values being non-abnormal
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
