// import { fhirApiUrlFromAuth0Audience } from './helpers';
import Oystehr from '@oystehr/sdk';
import { InsurancePlan, Organization } from 'fhir/r4b';
import fs from 'fs';
import { INSURANCE_PLAN_PAYER_META_TAG_CODE, ORG_TYPE_CODE_SYSTEM, ORG_TYPE_PAYER_CODE } from 'utils';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

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

  let [organizations, insurancePlans] = await Promise.all([getPayerOrganizations(oystehr), getInsurancePlans(oystehr)]);

  await cleanAllInsurancePlansAndOrgs(insurancePlans, organizations, oystehr);
  insurancePlans = [];
  organizations = [];
}

async function cleanAllInsurancePlansAndOrgs(
  insurancePlans: InsurancePlan[],
  orgs: Organization[],
  oystehr: Oystehr
): Promise<void> {
  const BATCH_SIZE = 20;

  console.log('Removing all insurancePlans');
  for (let i = 0; i < insurancePlans.length; i += BATCH_SIZE) {
    const batch = insurancePlans.slice(i, i + BATCH_SIZE);

    const promises = batch.map((insurancePlan) => {
      console.log(`Removing InsurancePlan: ${insurancePlan.id}`);
      return oystehr.fhir.delete({ id: insurancePlan.id!, resourceType: insurancePlan.resourceType });
    });

    await Promise.allSettled(promises);
  }

  for (let i = 0; i < orgs.length; i += BATCH_SIZE) {
    const batch = orgs.slice(i, i + BATCH_SIZE);

    const promises = batch.map((org) => {
      console.log(`Removing organization: ${org.id}`);
      return oystehr.fhir.delete({ id: org.id!, resourceType: org.resourceType });
    });
    await Promise.allSettled(promises);
  }
}

main()
  .then(() => console.log('Completed removing payers InsurancePlan and Organization resources'))
  .catch((error) => {
    console.error(error);
    throw error;
  });
