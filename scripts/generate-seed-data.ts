/**
 * Script to generate seed data for e2e tests.
 *
 * This script creates appointment resources using ResourceHandler (same as e2e tests),
 * waits for preprocessing/harvesting, fetches all related resources,
 * and saves them to seed-ehr-appointment-data.json with placeholders.
 *
 * Usage:
 *   ENV={env} npx env-cmd -f apps/ehr/env/tests.{env}.json tsx scripts/generate-seed-data.ts
 *
 * We are reusing a part of e2e tests flow, so we need to have:
 *   - user.json should contain valid access token for the user
 *   - Environment variables must be set (AUTH0_*, FHIR_API, PROJECT_API_ZAMBDA_URL, etc.)
 */

import { writeFileSync } from 'fs';
import { DateTime } from 'luxon';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(): Promise<void> {
  console.log('Starting seed data generation...\n');

  console.log('Auth config:');
  console.log(`  AUTH0_CLIENT: ${process.env.AUTH0_CLIENT?.slice(0, 5)}...`);
  console.log(`  AUTH0_SECRET: ${process.env.AUTH0_SECRET?.slice(0, 5)}...`);
  console.log(`  AUTH0_CLIENT_TESTS: ${process.env.AUTH0_CLIENT_TESTS?.slice(0, 5)}...`);
  console.log(`  AUTH0_SECRET_TESTS: ${process.env.AUTH0_SECRET_TESTS?.slice(0, 5)}...`);
  console.log(`  PROJECT_API_ZAMBDA_URL: ${process.env.PROJECT_API_ZAMBDA_URL}`);
  console.log(`  LOCATION_ID: ${process.env.LOCATION_ID}`);
  console.log(`  PROJECT_ID: ${process.env.PROJECT_ID}`);
  console.log('');

  const { ResourceHandler } = await import('../apps/ehr/tests/e2e-utils/resource-handler.ts');
  const processId = `seed-gen-${DateTime.now().toMillis()}`;
  const handler = new ResourceHandler(processId, 'in-person');

  try {
    console.log('Creating appointment resources via Zambda...');
    await handler.setResources();

    const appointmentId = handler.appointment.id!;
    console.log(`Created appointment: ${appointmentId}`);

    console.log('Waiting for appointment preprocessing...');
    await handler.waitTillAppointmentPreprocessed(appointmentId);
    console.log('Preprocessing complete');

    console.log('Waiting for harvesting...');
    await handler.waitTillHarvestingDone(appointmentId);
    console.log('Harvesting complete');

    console.log('Fetching all related resources...');
    const apiClient = await handler.apiClient;
    const resources = (
      await apiClient.fhir.search({
        resourceType: 'Appointment',
        params: [
          { name: '_id', value: appointmentId },
          { name: '_include', value: 'Appointment:patient' },
          { name: '_include', value: 'Appointment:slot' },
          { name: '_include', value: 'Appointment:location' },
          { name: '_revinclude:iterate', value: 'RelatedPerson:patient' },
          { name: '_revinclude:iterate', value: 'Encounter:appointment' },
          { name: '_revinclude:iterate', value: 'DocumentReference:patient' },
          { name: '_revinclude:iterate', value: 'QuestionnaireResponse:encounter' },
          { name: '_revinclude:iterate', value: 'Person:relatedperson' },
          { name: '_revinclude:iterate', value: 'List:subject' },
          { name: '_revinclude:iterate', value: 'Consent:patient' },
          { name: '_revinclude:iterate', value: 'Account:patient' },
          { name: '_revinclude:iterate', value: 'Observation:encounter' },
          { name: '_revinclude:iterate', value: 'ServiceRequest:encounter' },
          { name: '_revinclude:iterate', value: 'ClinicalImpression:encounter' },
        ],
      })
    ).unbundle();

    console.log(`Fetched ${resources.length} resources`);

    const locationId = process.env.LOCATION_ID!;
    const schedule = (
      await apiClient.fhir.search({
        resourceType: 'Schedule',
        params: [{ name: 'actor', value: `Location/${locationId}` }],
      })
    ).unbundle()[0];
    const scheduleId = schedule?.id;

    const { default: inPersonIntakeQuestionnaire } = await import(
      '../config/oystehr/in-person-intake-questionnaire.json',
      { assert: { type: 'json' } }
    );

    const questionnaire = Object.values(inPersonIntakeQuestionnaire.fhirResources).find(
      (q: any) =>
        q.resource.resourceType === 'Questionnaire' &&
        q.resource.status === 'active' &&
        q.resource.url.includes('intake-paperwork-inperson')
    ) as any;

    const questionnaireUrl = `${questionnaire.resource.url}|${questionnaire.resource.version}`;

    const today = DateTime.now().toUTC().toFormat('yyyy-MM-dd');

    console.log('Converting to seed format with placeholders...');

    const filteredResources = resources.filter((r: any) => r.resourceType !== 'Location');

    // Build UUID map for internal references
    const idToUuid = new Map<string, string>();
    filteredResources.forEach((r: any) => {
      if (r.id) {
        idToUuid.set(r.id, `urn:uuid:${crypto.randomUUID()}`);
      }
    });

    const entries = filteredResources.map((resource: any) => {
      const uuid = idToUuid.get(resource.id) || `urn:uuid:${crypto.randomUUID()}`;
      const { id: _id, meta, ...rest } = resource;
      let cleanedMeta: any = undefined;

      if (meta?.tag) {
        const cleanedTags = meta.tag.filter((tag: any) => tag.system !== 'E2E_TEST_RESOURCE_PROCESS_ID');
        if (cleanedTags.length > 0) {
          cleanedMeta = { tag: cleanedTags };
        }
      }

      const resourceWithMeta = cleanedMeta ? { ...rest, meta: cleanedMeta } : rest;

      let jsonStr = JSON.stringify(resourceWithMeta);

      idToUuid.forEach((uuid, id) => {
        jsonStr = jsonStr.replace(new RegExp(`"${resource.resourceType}/${id}"`, 'g'), `"${uuid}"`);
        jsonStr = jsonStr.replace(new RegExp(`"Patient/${id}"`, 'g'), `"${uuid}"`);
        jsonStr = jsonStr.replace(new RegExp(`"Appointment/${id}"`, 'g'), `"${uuid}"`);
        jsonStr = jsonStr.replace(new RegExp(`"Encounter/${id}"`, 'g'), `"${uuid}"`);
        jsonStr = jsonStr.replace(new RegExp(`"RelatedPerson/${id}"`, 'g'), `"${uuid}"`);
        jsonStr = jsonStr.replace(new RegExp(`"Slot/${id}"`, 'g'), `"${uuid}"`);
        jsonStr = jsonStr.replace(new RegExp(`"Person/${id}"`, 'g'), `"${uuid}"`);
      });

      jsonStr = jsonStr.replace(new RegExp(`Location/${locationId}`, 'g'), 'Location/{{locationId}}');
      if (scheduleId) {
        jsonStr = jsonStr.replace(new RegExp(`Schedule/${scheduleId}`, 'g'), 'Schedule/{{scheduleId}}');
      }
      jsonStr = jsonStr.replace(
        new RegExp(questionnaireUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        '{{questionnaireUrl}}'
      );
      jsonStr = jsonStr.replace(new RegExp(today, 'g'), '{{date}}');

      const processedResource = JSON.parse(jsonStr);

      return {
        request: {
          method: 'POST',
          url: `/${resource.resourceType}`,
        },
        fullUrl: uuid,
        resource: processedResource,
      };
    });

    const bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: entries,
    };

    const outputPath = join(__dirname, '../apps/ehr/tests/e2e-utils/seed-data/seed-ehr-appointment-data.json');
    writeFileSync(outputPath, JSON.stringify(bundle, null, 2));
    console.log(`Saved to: ${outputPath}`);

    console.log('🧹 Cleaning up resources...');
    await handler.cleanupResources();

    console.log('\nSeed data generation completed successfully!');
  } catch (error) {
    console.error('Error:', error);
    try {
      await handler.cleanupResources();
    } catch {
      // ignore cleanup errors
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
