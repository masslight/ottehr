/**
 * One-time migration script: converts hardcoded quick picks from MEDICAL_HISTORY_CONFIG
 * and PROCEDURES_CONFIG into FHIR ActivityDefinition resources.
 *
 * The script reads the instance's actual configs (including any overrides) so it
 * migrates whatever quick picks that specific instance is currently using.
 *
 * Usage:
 *   npx env-cmd -f apps/ehr/env/tests.local.json npx tsx scripts/migrate-quick-picks-to-fhir.ts
 *   npx env-cmd -f apps/ehr/env/tests.e2e.json npx tsx scripts/migrate-quick-picks-to-fhir.ts
 *
 * The script is idempotent: it checks for existing quick picks by tag before creating,
 * so running it multiple times will not create duplicates.
 *
 * Set DRY_RUN=true to preview what would be created without writing to FHIR.
 */

import Oystehr from '@oystehr/sdk';
import { ActivityDefinition } from 'fhir/r4b';
import { MEDICAL_HISTORY_CONFIG, PROCEDURES_CONFIG } from 'utils';

// ── Constants (must match quick-pick-helpers.ts) ──

const QUICK_PICK_TAG_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/quick-pick-category';
const QUICK_PICK_CONFIG_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/quick-pick-config';

const TAG_CODES = {
  allergy: 'allergy-quick-pick',
  medicalCondition: 'medical-condition-quick-pick',
  medicationHistory: 'medication-history-quick-pick',
  procedure: 'procedure-quick-pick',
} as const;

// ── Auth ──

async function getAuthToken(): Promise<string> {
  const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE } = process.env;
  if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE) {
    throw new Error('Missing auth env vars (AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE)');
  }
  const response = await fetch(AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: AUTH0_CLIENT,
      client_secret: AUTH0_SECRET,
      audience: AUTH0_AUDIENCE,
    }),
  });
  if (!response.ok) {
    throw new Error(`Auth failed: HTTP ${response.status}`);
  }
  return (await response.json()).access_token;
}

// ── FHIR helpers ──

function buildActivityDefinition(
  title: string,
  tagCode: string,
  configData: Record<string, unknown>
): ActivityDefinition {
  return {
    resourceType: 'ActivityDefinition',
    status: 'active',
    name: title.replace(/[^a-zA-Z0-9]/g, '_'),
    title,
    meta: {
      tag: [{ system: QUICK_PICK_TAG_SYSTEM, code: tagCode }],
    },
    extension: [
      {
        url: QUICK_PICK_CONFIG_EXTENSION_URL,
        valueString: JSON.stringify(configData),
      },
    ],
  };
}

async function getExistingQuickPicks(oystehr: Oystehr, tagCode: string): Promise<Set<string>> {
  const results = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        { name: '_tag', value: `${QUICK_PICK_TAG_SYSTEM}|${tagCode}` },
        { name: 'status', value: 'active' },
        { name: '_count', value: '200' },
      ],
    })
  ).unbundle();

  // Build a composite key from title + config to handle items with the same name
  // but different configs (e.g., "Toradol 60 mg" vs "Toradol 30 mg")
  return new Set(
    results.map((ad) => {
      const title = ad.title ?? ad.name ?? '';
      const configExt = ad.extension?.find((ext) => ext.url === QUICK_PICK_CONFIG_EXTENSION_URL);
      return `${title}::${configExt?.valueString ?? ''}`;
    })
  );
}

// ── Migration logic ──

interface MigrationItem {
  title: string;
  tagCode: string;
  config: Record<string, unknown>;
}

function buildMigrationItems(): MigrationItem[] {
  const items: MigrationItem[] = [];

  // Allergies — display name key is 'name', so strip it from config
  // Remap 'id' (hardcoded config field) to 'allergyId' (FHIR quick pick schema)
  for (const qp of MEDICAL_HISTORY_CONFIG.allergies.quickPicks) {
    const { name, id: allergyId, ...rest } = qp;
    items.push({
      title: name,
      tagCode: TAG_CODES.allergy,
      config: { ...rest, ...(allergyId != null ? { allergyId } : {}) },
    });
  }

  // Medical Conditions — display name key is 'display', so strip it from config
  for (const qp of MEDICAL_HISTORY_CONFIG.medicalConditions.quickPicks) {
    const { display, ...config } = qp;
    items.push({ title: display, tagCode: TAG_CODES.medicalCondition, config });
  }

  // Medications — display name key is 'name', so strip it from config
  // Map 'id' to 'medicationId' to match the FHIR quick pick schema
  for (const qp of MEDICAL_HISTORY_CONFIG.medications.quickPicks) {
    const { name, id, ...rest } = qp;
    items.push({
      title: name,
      tagCode: TAG_CODES.medicationHistory,
      config: { ...rest, ...(id != null ? { medicationId: id } : {}) },
    });
  }

  // Procedures — display name key is 'name', so strip it from config
  for (const qp of PROCEDURES_CONFIG.quickPicks) {
    const { name, ...config } = qp;
    items.push({ title: name, tagCode: TAG_CODES.procedure, config: config as Record<string, unknown> });
  }

  // Note: In-house medication quick picks are excluded because they don't have
  // a FHIR admin category yet.

  return items;
}

async function migrate(): Promise<void> {
  const isDryRun = process.env.DRY_RUN === 'true';

  console.log('=== Quick Picks Migration to FHIR ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log();

  // Authenticate
  console.log('Authenticating...');
  const token = await getAuthToken();
  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: process.env.FHIR_API,
    projectApiUrl: process.env.PROJECT_API,
  });
  console.log('Authenticated successfully.');
  console.log();

  // Build items from the instance's configs (includes overrides)
  const migrationItems = buildMigrationItems();
  const allergyCount = migrationItems.filter((i) => i.tagCode === TAG_CODES.allergy).length;
  const conditionCount = migrationItems.filter((i) => i.tagCode === TAG_CODES.medicalCondition).length;
  const medicationCount = migrationItems.filter((i) => i.tagCode === TAG_CODES.medicationHistory).length;
  const procedureCount = migrationItems.filter((i) => i.tagCode === TAG_CODES.procedure).length;

  console.log(`Quick picks found in config: ${migrationItems.length}`);
  console.log(`  Allergies: ${allergyCount}`);
  console.log(`  Medical Conditions: ${conditionCount}`);
  console.log(`  Medications: ${medicationCount}`);
  console.log(`  Procedures: ${procedureCount}`);
  console.log();

  // Fetch existing quick picks to avoid duplicates
  console.log('Checking for existing FHIR quick picks...');
  const existingByTag: Record<string, Set<string>> = {};
  for (const tagCode of Object.values(TAG_CODES)) {
    existingByTag[tagCode] = await getExistingQuickPicks(oystehr, tagCode);
    const count = existingByTag[tagCode].size;
    if (count > 0) {
      console.log(`  Found ${count} existing ${tagCode} resources`);
    }
  }
  console.log();

  // Create missing quick picks
  let created = 0;
  let skipped = 0;

  for (const item of migrationItems) {
    const existing = existingByTag[item.tagCode];
    const compositeKey = `${item.title}::${JSON.stringify(item.config)}`;
    if (existing.has(compositeKey)) {
      console.log(`  SKIP (exists): [${item.tagCode}] "${item.title}"`);
      skipped++;
      continue;
    }

    if (isDryRun) {
      console.log(`  WOULD CREATE: [${item.tagCode}] "${item.title}" config=${JSON.stringify(item.config)}`);
      created++;
      continue;
    }

    const ad = buildActivityDefinition(item.title, item.tagCode, item.config);
    try {
      const result = await oystehr.fhir.create<ActivityDefinition>(ad);
      console.log(`  CREATED: [${item.tagCode}] "${item.title}" → id=${result.id}`);
      created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR: [${item.tagCode}] "${item.title}" — ${message}`);
    }
  }

  console.log();
  console.log('=== Migration Complete ===');
  console.log(`  Created: ${created}`);
  console.log(`  Skipped (already exist): ${skipped}`);
  console.log(`  Total: ${created + skipped}`);

  if (isDryRun) {
    console.log();
    console.log('This was a dry run. To apply changes, run without DRY_RUN=true.');
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
