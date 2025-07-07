import Oystehr from '@oystehr/sdk';
import csvToJson from 'csvtojson';
import { Organization } from 'fhir/r4b';
import * as fs from 'fs';
import path from 'path';
import { getPayerId, ORG_TYPE_CODE_SYSTEM, ORG_TYPE_PAYER_CODE, PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

enum PayersFileColumns {
  payerId = 'Payer ID',
  payerName = 'Payer Name',
  eligibility = 'Eligibility',
  era = 'ERA',
  payerType = 'Payer Type',
}

const CSV_FILE_PATH = path.join(__dirname, 'data', 'insurance-payers.csv');

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
            system: `${ORG_TYPE_CODE_SYSTEM}`,
            code: `${ORG_TYPE_PAYER_CODE}`,
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
          value: `${ORG_TYPE_CODE_SYSTEM}|${ORG_TYPE_PAYER_CODE}`,
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

async function processCsv(filePath: string, oystehr: Oystehr, organizations: Organization[]): Promise<void> {
  const organizationMap = new Map(organizations.map((org) => [getPayerId(org), org]));
  const csvData = await csvToJson().fromFile(filePath);
  const BATCH_SIZE = 20;

  for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
    const batch = csvData.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (data) => {
      try {
        const payerIdKey = data[PayersFileColumns.payerId];

        if (organizationMap.has(payerIdKey)) {
          const existingOrganization = organizationMap.get(payerIdKey);
          if (existingOrganization) {
            /** ---------- not updating not to override existing resource changes -------- */
            // existingOrganization = await updateOrganization(oystehr, existingOrganization, data);
            organizationMap.set(payerIdKey, existingOrganization);
          }
        } else {
          const newOrg = await createOrganization(oystehr, data);
          if (newOrg) {
            organizationMap.set(payerIdKey, newOrg);
          }
        }
      } catch (error) {
        console.error(`Error processing row: ${JSON.stringify(error)}`, data);
        throw error;
      }
    });

    await Promise.allSettled(promises).then((results) => {
      results.forEach((result) => {
        if (result.status === 'rejected') {
          console.error(`Error processing row: ${JSON.stringify(result)}`);
        }
      });
    });
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

  const organizations = await getPayerOrganizations(oystehr);
  await processCsv(CSV_FILE_PATH, oystehr, organizations);
}

main()
  .then(() => console.log('Completed processing CSV file'))
  .catch((error) => {
    console.error(error);
    throw error;
  });
