// cSpell:ignore elig, inplan, mesg
import Oystehr from '@oystehr/sdk';
import { List, ListEntry, Organization } from 'fhir/r4b';
import * as fs from 'fs';
import { FHIR_EXTENSION, getPayerUrl } from 'utils';
import { ottehrExtensionUrl } from 'utils/lib/fhir/systemUrls';
import { getInsuranceOverrideList } from '../rcm/get-insurance-override-list/handler';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

async function getPayers(oystehr: Oystehr): Promise<Organization[]> {
  console.log('Fetching payer organizations...');

  const payers: Organization[] = [];
  let offset = 0;
  let hasMore = false;
  try {
    do {
      const bundledResponse = await oystehr.fhir.search<Organization>({
        resourceType: 'Organization',
        params: [
          {
            name: 'type',
            value: 'http://terminology.hl7.org/CodeSystem/organization-type|pay',
          },
          {
            name: '_offset',
            value: offset,
          },
        ],
      });

      hasMore = (bundledResponse.link ?? []).some((l) => l.relation === 'next');
      offset += 1000;
      payers.push(...bundledResponse.unbundle());
    } while (hasMore);

    console.log(`Found ${payers.length} insurance payers`);

    return payers;
  } catch (error) {
    console.error('Error fetching payer organizations:', error);
    return [];
  }
}

async function main(): Promise<void> {
  const env = process.argv[2];

  const secrets = JSON.parse(fs.readFileSync(`../../config/.env/${env}.json`, 'utf8'));

  const token = await getAuth0Token(secrets);

  if (!token) {
    throw new Error('❌ Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  const payers = await getPayers(oystehr);

  if (payers.length === 0) {
    console.log('No payer organizations found.');
    return;
  }

  const activePayers = payers.filter((org) => org.active === true);
  const activePayersWithNameOverrides = activePayers.filter((org) => org.alias?.length);
  const payersWithNotes = payers.filter(
    (org) => org.extension?.some((e) => e.url === FHIR_EXTENSION.InsurancePlan.notes.url)
  );

  // CW TODO: find or create lists, upsert entries
  let patientOverrideList = await getInsuranceOverrideList(oystehr, 'patient');
  let ehrOverrideList = await getInsuranceOverrideList(oystehr, 'ehr');

  let patientOverrideEntries: ListEntry[] = [];
  if (activePayers.length !== payers.length) {
    patientOverrideEntries = activePayers.map<ListEntry>((org) => {
      const name = org.name;
      const nameOverrideOrg = activePayersWithNameOverrides.find((overrideOrg) => overrideOrg.id === org.id);
      const nameOverride = nameOverrideOrg?.alias?.[0];
      return {
        item: {
          reference: getPayerUrl(org.id!),
        },
        extension: [
          {
            url: ottehrExtensionUrl('insurance-override-name'),
            valueString: nameOverride ?? name ?? '',
          },
        ],
      };
    });
  }

  const ehrOverrideEntries = payersWithNotes.map<ListEntry>((org) => {
    const note = org.extension?.find((e) => e.url === FHIR_EXTENSION.InsurancePlan.notes.url)?.valueString;
    return {
      item: {
        reference: getPayerUrl(org.id!),
      },
      extension: [
        {
          url: ottehrExtensionUrl('insurance-override-note'),
          valueString: note ?? '',
        },
      ],
    };
  });

  patientOverrideList = await oystehr.fhir.patch<List>({
    resourceType: 'List',
    id: patientOverrideList.id,
    operations: [
      {
        op: patientOverrideList.entry?.length ?? 0 > 0 ? 'replace' : 'add',
        path: '/entry',
        value: patientOverrideEntries,
      },
    ],
  });

  ehrOverrideList = await oystehr.fhir.patch<List>({
    resourceType: 'List',
    id: ehrOverrideList.id,
    operations: [
      {
        op: ehrOverrideList.entry?.length ?? 0 > 0 ? 'replace' : 'add',
        path: '/entry',
        value: ehrOverrideEntries,
      },
    ],
  });

  console.log(`\n📊 Summary:`);
  console.log(`Patient-Facing Insurances: ${patientOverrideList.entry?.length}`);
  console.log(`Insurances with Notes: ${ehrOverrideList.entry?.length}`);
}

main()
  .then(() => console.log('\n✅ Done!'))
  .catch((error) => {
    console.error(error);
    throw error;
  });
