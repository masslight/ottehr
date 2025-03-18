import Oystehr from '@oystehr/sdk';
import csvToJson from 'csvtojson';
import { InsurancePlan, Organization } from 'fhir/r4b';
import * as fs from 'fs';
import {
  FHIR_EXTENSION,
  INSURANCE_PLAN_PAYER_META_TAG_CODE,
  INSURANCE_SETTINGS_DEFAULTS,
  INSURANCE_SETTINGS_MAP,
  PRIVATE_EXTENSION_BASE_URL,
} from 'utils';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

enum PayersFileColumns {
  payerId = 'Payer ID',
  payerName = 'Payer Name',
  eligibility = 'Eligibility',
  era = 'ERA',
  payerType = 'Payer Type',
}

const CSV_FILE_PATH = 'scripts/data/insurance-payers.csv';

const PAYER_ID_SYSTEM = 'payer-id';

function getOrganizationResourceFromDataRow(
  data: Record<PayersFileColumns, string>,
  organization?: Organization
): Organization {
  const payerIdKey = data[PayersFileColumns.payerId];
  const payerName = data[PayersFileColumns.payerName];
  const eligibilityPayerId = data[PayersFileColumns.payerId];

  const newOrganization: Organization = {
    resourceType: 'Organization',
    active: true,
    name: payerName,
    type: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/organization-type',
            code: 'pay',
          },
        ],
      },
    ],
    identifier: [
      {
        type: {
          coding: [{ system: PAYER_ID_SYSTEM, code: payerIdKey }],
        },
      },
      {
        type: {
          coding: [{ code: 'XX', system: 'http://terminology.hl7.org/CodeSystem/v2-0203' }],
        },
        value: eligibilityPayerId,
      },
    ],
    extension: organization?.extension,
  };

  const extensionsToUpdate = [
    {
      url: `${PRIVATE_EXTENSION_BASE_URL}/eligibility`,
      valueString: data[PayersFileColumns.eligibility],
    },
    { url: `${PRIVATE_EXTENSION_BASE_URL}/era`, valueString: data[PayersFileColumns.era] },
    {
      url: `${PRIVATE_EXTENSION_BASE_URL}/payer-type`,
      valueString: data[PayersFileColumns.payerType],
    },
  ];

  extensionsToUpdate.forEach((currentExtension) => {
    if (!newOrganization.extension) {
      newOrganization.extension = [];
    }
    const existingExtIndex = newOrganization.extension.findIndex((ext) => ext.url === currentExtension.url);
    if (existingExtIndex >= 0) {
      if (!currentExtension.valueString) {
        newOrganization.extension = newOrganization.extension.splice(existingExtIndex, 1);
      } else newOrganization.extension[existingExtIndex] = currentExtension;
    } else if (currentExtension.valueString) {
      newOrganization.extension.push(currentExtension);
    }
  });

  return newOrganization;
}

async function createOrganization(oystehr: Oystehr, data: any): Promise<Organization> {
  const organization = await oystehr.fhir.create<Organization>(getOrganizationResourceFromDataRow(data));

  console.log(`Created organization: ${organization.id}.`);
  return organization;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function updateOrganization(oystehr: Oystehr, organization: Organization, data: any): Promise<Organization> {
  const updatedOrg = await oystehr.fhir.update<Organization>({
    ...getOrganizationResourceFromDataRow(data),
    resourceType: 'Organization',
    id: organization.id,
  });

  console.log(`Updated organization: ${organization.id}.`);

  return updatedOrg;
}

async function getPayerOrganizations(oystehr: Oystehr): Promise<Organization[]> {
  let currentIndex = 0;
  let total = 1;
  const result: Organization[] = [];
  while (currentIndex < total) {
    const bundledResponse = await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [
        {
          name: 'type',
          value: 'http://terminology.hl7.org/CodeSystem/organization-type|pay',
        },
        {
          name: '_offset',
          value: currentIndex,
        },
        {
          name: '_count',
          value: 1000,
        },
        {
          name: '_total',
          value: 'accurate',
        },
      ],
    });
    total = bundledResponse.total || 0;
    const unbundled = bundledResponse.unbundle();
    result.push(...unbundled);
    currentIndex += unbundled.length;
  }

  console.log('Found', result.length, 'organizations');
  return result;
}

async function getInsurancePlans(oystehr: Oystehr): Promise<InsurancePlan[]> {
  let currentIndex = 0;
  let total = 1;
  const result: InsurancePlan[] = [];
  while (currentIndex < total) {
    const bundledResponse = await oystehr.fhir.search<InsurancePlan>({
      resourceType: 'InsurancePlan',
      params: [
        {
          name: '_tag',
          value: INSURANCE_PLAN_PAYER_META_TAG_CODE,
        },
        {
          name: '_offset',
          value: currentIndex,
        },
        {
          name: '_count',
          value: 1000,
        },
        {
          name: '_total',
          value: 'accurate',
        },
      ],
    });
    total = bundledResponse.total || 0;
    const unbundled = bundledResponse.unbundle();
    result.push(...unbundled);
    currentIndex += unbundled.length;
  }

  console.log('Found', result.length, 'insurance plans');
  return result;
}

async function createOrUpdateInsurancePlan(
  oystehr: Oystehr,
  data: any,
  organizationId: string,
  existingPlansMap: Map<string, InsurancePlan>
): Promise<InsurancePlan> {
  const insurancePlanName = data[PayersFileColumns.payerName];

  let insurancePlan: InsurancePlan | undefined = existingPlansMap.get(insurancePlanName);

  if (!insurancePlan) {
    // Create new InsurancePlan
    insurancePlan = await oystehr.fhir.create<InsurancePlan>({
      resourceType: 'InsurancePlan',
      name: insurancePlanName,
      meta: {
        tag: [
          {
            code: INSURANCE_PLAN_PAYER_META_TAG_CODE,
          },
        ],
      },
      ownedBy: {
        reference: `Organization/${organizationId}`,
      },
      status: 'active',
      extension: [
        {
          url: FHIR_EXTENSION.InsurancePlan.insuranceRequirements.url,
          extension: Object.keys(INSURANCE_SETTINGS_DEFAULTS).map((key) => ({
            url: key,
            valueBoolean: INSURANCE_SETTINGS_DEFAULTS[key as keyof typeof INSURANCE_SETTINGS_MAP],
          })),
        },
      ],
    });

    console.log(`Created InsurancePlan: ${insurancePlan.id}`);
    return insurancePlan;
  } else {
    /** ---------- not updating not to override existing resource changes -------- */

    // Update existing InsurancePlan
    // insurancePlan.status = 'active';
    // insurancePlan.ownedBy = { reference: `Organization/${organizationId}` };

    // const resourceExtensions = insurancePlan?.extension || [];
    // const requirementSettingsExistingExtensions = resourceExtensions.find(
    //   (ext) => ext.url === FHIR_EXTENSION.InsurancePlan.insuranceRequirements.url
    // )?.extension;
    // const requirementSettingsNewExtensions = requirementSettingsExistingExtensions || [];

    // Object.keys(INSURANCE_SETTINGS_MAP).map((setting) => {
    //   const defaultValue = INSURANCE_SETTINGS_DEFAULTS[setting as keyof typeof INSURANCE_SETTINGS_MAP] || false;
    //   const currentSettingExt: Extension = {
    //     url: setting,
    //     valueBoolean: defaultValue,
    //   };

    //   const existingExtIndex = requirementSettingsNewExtensions.findIndex((ext) => ext.url === currentSettingExt.url);
    //   if (existingExtIndex >= 0) {
    //     if (defaultValue === true) {
    //       requirementSettingsNewExtensions[existingExtIndex] = currentSettingExt;
    //     }
    //   } else {
    //     requirementSettingsNewExtensions.push(currentSettingExt);
    //   }
    // });

    // if (!requirementSettingsExistingExtensions) {
    //   resourceExtensions?.push({
    //     url: FHIR_EXTENSION.InsurancePlan.insuranceRequirements.url,
    //     extension: requirementSettingsNewExtensions,
    //   });
    // }
    // insurancePlan.extension = resourceExtensions;

    // const updated = await oystehr.fhir.update(insurancePlan);

    // console.log(`Updated InsurancePlan: ${insurancePlan.id}`);
    // return updated;
    return insurancePlan;
  }
}
async function processCsv(
  filePath: string,
  oystehr: Oystehr,
  organizations: Organization[],
  existingPlansMap: Map<string, InsurancePlan>
): Promise<void> {
  const organizationMap = new Map(
    organizations.map((org) => [
      org.identifier?.find((id) => id.type?.coding?.[0]?.system === PAYER_ID_SYSTEM)?.type?.coding?.[0]?.code,
      org,
    ])
  );
  const csvData = await csvToJson().fromFile(filePath);
  const BATCH_SIZE = 20;

  for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
    const batch = csvData.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (data) => {
      try {
        const payerIdKey = data[PayersFileColumns.payerId];

        let organizationId = '';
        if (organizationMap.has(payerIdKey)) {
          const existingOrganization = organizationMap.get(payerIdKey);
          if (existingOrganization) {
            /** ---------- not updating not to override existing resource changes -------- */
            // existingOrganization = await updateOrganization(oystehr, existingOrganization, data);
            organizationMap.set(payerIdKey, existingOrganization);
            organizationId = existingOrganization.id!;
          }
        } else {
          const newOrg = await createOrganization(oystehr, data);
          if (newOrg) {
            organizationMap.set(payerIdKey, newOrg);
            organizationId = newOrg.id!;
          }
        }

        const newInsPlan = await createOrUpdateInsurancePlan(oystehr, data, organizationId, existingPlansMap);
        existingPlansMap.set(newInsPlan.name!, newInsPlan);
      } catch (error) {
        console.error(`Error processing row: ${JSON.stringify(error)}`, data);
      }
    });

    await Promise.allSettled(promises);
  }
  console.log('CSV file successfully processed');
}

async function main(): Promise<void> {
  const env = process.argv[2];
  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  const token = await getAuth0Token(secrets);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  const [organizations, insurancePlans] = await Promise.all([
    getPayerOrganizations(oystehr),
    getInsurancePlans(oystehr),
  ]);

  const existingPlansMap = new Map(
    insurancePlans.filter((plan) => Boolean(plan.name)).map((plan) => [plan.name!, plan])
  );

  await processCsv(CSV_FILE_PATH, oystehr, organizations, existingPlansMap);
}

main()
  .then(() => console.log('Completed processing CSV file'))
  .catch((error) => {
    console.error(error);
    throw error;
  });
