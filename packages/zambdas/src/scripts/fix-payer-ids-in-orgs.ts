import Oystehr from '@oystehr/sdk';
import { Organization } from 'fhir/r4b';
import * as fs from 'fs';
import { ORG_TYPE_CODE_SYSTEM, ORG_TYPE_PAYER_CODE } from 'utils';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

const PAYER_ID_SYSTEM = 'payer-id';

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

async function fixOrganizations(oystehr: Oystehr, organizations: Organization[]): Promise<void> {
  console.log(`Processing ${organizations.length} organizations...`);

  let fixedCount = 0;
  let payerIdFixCount = 0;
  let eligibilityPayerIdFixCount = 0;

  for (let i = 0; i < organizations.length; i++) {
    const organization = organizations[i];

    try {
      console.log(`Processing organization ${i + 1}/${organizations.length}: ${organization.id}`);

      // Extract payerIdKey (from PAYER_ID_SYSTEM identifier)
      const payerIdIdentifier = organization.identifier?.find(
        (id) => id.type?.coding?.some((coding) => coding.system === PAYER_ID_SYSTEM)
      );
      let payerIdKey = payerIdIdentifier?.type?.coding?.find((coding) => coding.system === PAYER_ID_SYSTEM)?.code;

      // Extract eligibilityPayerIdKey (from XX code identifier value)
      const eligibilityPayerIdIdentifier = organization.identifier?.find(
        (id) =>
          id.type?.coding?.some(
            (coding) => coding.code === 'XX' && coding.system === 'http://terminology.hl7.org/CodeSystem/v2-0203'
          )
      );
      let eligibilityPayerIdKey = eligibilityPayerIdIdentifier?.value;

      let needsUpdate = false;

      // Fix payerIdKey if it's purely numeric and not 5 characters
      if (payerIdKey && /^\d+$/.test(payerIdKey) && payerIdKey.length !== 5) {
        const originalPayerIdKey = payerIdKey;
        payerIdKey = payerIdKey.padStart(5, '0');
        console.log(`  - Fixed payerIdKey: ${originalPayerIdKey} -> ${payerIdKey}`);
        needsUpdate = true;
        payerIdFixCount++;
      }

      // Fix eligibilityPayerIdKey if it's purely numeric and not 5 characters
      if (eligibilityPayerIdKey && /^\d+$/.test(eligibilityPayerIdKey) && eligibilityPayerIdKey.length !== 5) {
        const originalEligibilityPayerIdKey = eligibilityPayerIdKey;
        eligibilityPayerIdKey = eligibilityPayerIdKey.padStart(5, '0');
        console.log(`  - Fixed eligibilityPayerIdKey: ${originalEligibilityPayerIdKey} -> ${eligibilityPayerIdKey}`);
        needsUpdate = true;
        eligibilityPayerIdFixCount++;
      }

      // Update organization if needed
      if (needsUpdate) {
        const updatedOrganization = { ...organization };

        // Update payerIdKey in the organization
        if (payerIdIdentifier && updatedOrganization.identifier) {
          const payerIdIndex = updatedOrganization.identifier.findIndex(
            (id) => id.type?.coding?.some((coding) => coding.system === PAYER_ID_SYSTEM)
          );
          if (payerIdIndex !== -1 && updatedOrganization.identifier[payerIdIndex].type?.coding) {
            const codingIndex = updatedOrganization.identifier[payerIdIndex].type!.coding!.findIndex(
              (coding) => coding.system === PAYER_ID_SYSTEM
            );
            if (codingIndex !== -1) {
              updatedOrganization.identifier[payerIdIndex].type!.coding![codingIndex].code = payerIdKey;
            }
          }
        }

        // Update eligibilityPayerIdKey in the organization
        if (eligibilityPayerIdIdentifier && updatedOrganization.identifier) {
          const eligibilityIdIndex = updatedOrganization.identifier.findIndex(
            (id) =>
              id.type?.coding?.some(
                (coding) => coding.code === 'XX' && coding.system === 'http://terminology.hl7.org/CodeSystem/v2-0203'
              )
          );
          if (eligibilityIdIndex !== -1) {
            updatedOrganization.identifier[eligibilityIdIndex].value = eligibilityPayerIdKey;
          }
        }

        await oystehr.fhir.update<Organization>(updatedOrganization);
        console.log(`  - Updated organization ${organization.id}`);
        fixedCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing organization ${organization.id}:`, error);
    }
  }

  console.log('Finished processing all organizations');
  console.log(`📊 Summary:`);
  console.log(`  - Total organizations processed: ${organizations.length}`);
  console.log(`  - Organizations updated: ${fixedCount}`);
  console.log(`  - PayerIdKey fixes: ${payerIdFixCount}`);
  console.log(`  - EligibilityPayerIdKey fixes: ${eligibilityPayerIdFixCount}`);
}

async function main(): Promise<void> {
  const env = process.argv[2];
  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  const token = await getAuth0Token(secrets);

  if (!token) {
    throw new Error('❌ Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  const organizations = await getPayerOrganizations(oystehr);
  await fixOrganizations(oystehr, organizations);
}

main()
  .then(() => console.log('✅ Completed fixing payer IDs in organizations'))
  .catch((error) => {
    console.error(error);
    throw error;
  });
