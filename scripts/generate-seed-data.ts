/**
 * Script to generate seed data for e2e tests.
 *
 * This script creates appointment resources using ResourceHandler (same as e2e tests),
 * waits for preprocessing/harvesting, fetches all related resources,
 * and saves them as individual JSON files in seed-data/resources/ directory.
 *
 * Output structure:
 *   seed-data/
 *     resources/
 *       Account-0.json
 *       Appointment-0.json
 *       Patient-0.json
 *       ...
 *     index.ts (static file that merges all resources)
 *
 * Usage:
 *   ENV={env} npx env-cmd -f apps/ehr/env/tests.{env}.json tsx scripts/generate-seed-data.ts
 *
 * We are reusing a part of e2e tests flow, so we need to have:
 *   - playwright ehr user.json (to generate it run 'npm run ehr:e2e:{env}:integration:ui')
 *   - Environment variables must be set (AUTH0_*, FHIR_API, PROJECT_API_ZAMBDA_URL, etc.)
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { DateTime } from 'luxon';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM, getAppointmentGraphSearchParams } from 'utils';

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
        params: getAppointmentGraphSearchParams(appointmentId),
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

    // Filter out Location (we use placeholder) and sort by resourceType
    const filteredResources = resources
      .filter((r: any) => r.resourceType !== 'Location')
      .sort((a: any, b: any) => a.resourceType.localeCompare(b.resourceType));

    // Validate all resources have required fields
    filteredResources.forEach((r: any, index: number) => {
      if (!r.resourceType) {
        throw new Error(`Resource at index ${index} is missing resourceType`);
      }
      if (!r.id) {
        throw new Error(`Resource ${r.resourceType} at index ${index} is missing id`);
      }
    });

    // Build ID → fullUrl map using format: urn:uuid:ResourceType-OriginalId
    const idToFullUrl = new Map<string, string>();

    filteredResources.forEach((r: any) => {
      idToFullUrl.set(r.id, `urn:uuid:${r.resourceType}-${r.id}`);
    });

    // Prepare output directory (clean before generation)
    const seedDataDir = join(__dirname, '../apps/ehr/tests/e2e-utils/seed-data');
    const resourcesDir = join(seedDataDir, 'resources');

    if (existsSync(resourcesDir)) {
      rmSync(resourcesDir, { recursive: true });
    }
    mkdirSync(resourcesDir, { recursive: true });

    // Process and save each resource
    filteredResources.forEach((resource: any) => {
      const type = resource.resourceType;
      const resourceId = resource.id;
      const fullUrl = idToFullUrl.get(resourceId)!;

      // Remove id and clean meta
      const { id: _id, meta, ...rest } = resource;
      let cleanedResource: any = rest;

      if (meta?.tag) {
        const cleanedTags = meta.tag.filter((tag: any) => tag.system !== E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM);
        if (cleanedTags.length > 0) {
          cleanedResource = { ...rest, meta: { tag: cleanedTags } };
        }
      }

      // Replace references with fullUrl placeholders
      let jsonStr = JSON.stringify(cleanedResource);

      idToFullUrl.forEach((fullUrl, id) => {
        // Replace all reference patterns for this id
        const patterns = [
          `"Patient/${id}"`,
          `"Appointment/${id}"`,
          `"Encounter/${id}"`,
          `"RelatedPerson/${id}"`,
          `"Slot/${id}"`,
          `"Person/${id}"`,
          `"${type}/${id}"`,
        ];
        patterns.forEach((pattern) => {
          jsonStr = jsonStr.split(pattern).join(`"${fullUrl}"`);
        });
      });

      // Replace environment-specific values with placeholders
      jsonStr = jsonStr.split(`Location/${locationId}`).join('Location/{{locationId}}');
      if (scheduleId) {
        jsonStr = jsonStr.split(`Schedule/${scheduleId}`).join('Schedule/{{scheduleId}}');
      }
      jsonStr = jsonStr.split(questionnaireUrl).join('{{questionnaireUrl}}');
      jsonStr = jsonStr.split(today).join('{{date}}');

      const entry = {
        fullUrl,
        request: { method: 'POST', url: `/${type}` },
        resource: JSON.parse(jsonStr),
      };

      // Sort keys and save (use resourceId for unique file names)
      const fileName = `${type}-${resourceId}.json`;
      writeFileSync(join(resourcesDir, fileName), JSON.stringify(entry, null, 2));
    });

    console.log(`Saved ${filteredResources.length} resource files to: ${resourcesDir}`);

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
