#! npx tsx

import fs from 'fs';
import path from 'path';
import { QuestionnaireType } from '../../packages/spec/src/questionnaire-utils';

/**
 * Validates that questionnaire content changes are accompanied by version bumps.
 * Run this in CI on all PRs to catch versioning errors early.
 *
 * - Fails if content changed but version is same (forgot to bump)
 * - Fails if version regressed (current < latest archive)
 * - Passes if no changes or new version is properly bumped
 */

const QUESTIONNAIRE_TYPES: QuestionnaireType[] = ['in-person', 'virtual'];

interface FhirResource {
  resource: {
    resourceType: string;
    url: string;
    version: string;
    [key: string]: any;
  };
}

interface ArchiveData {
  'schema-version': string;
  fhirResources: Record<string, FhirResource>;
}

function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.');
  if (parts.length !== 3 || parts.some((part) => isNaN(Number(part)))) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return parts.map(Number) as [number, number, number];
}

function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseVersion(a);
  const [bMajor, bMinor, bPatch] = parseVersion(b);

  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

function findLatestArchiveVersion(archiveData: ArchiveData): { key: string; version: string; resource: any } | null {
  const entries = Object.entries(archiveData.fhirResources);
  if (entries.length === 0) return null;

  let latest: { key: string; version: string; resource: any } | null = null;

  for (const [key, value] of entries) {
    const version = value.resource.version;
    if (!latest || compareVersions(version, latest.version) > 0) {
      latest = { key, version, resource: value.resource };
    }
  }

  return latest;
}

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main(): Promise<void> {
  const questionnaireType = process.argv[2] as QuestionnaireType;

  if (!questionnaireType || !QUESTIONNAIRE_TYPES.includes(questionnaireType)) {
    console.error(`Usage: npx tsx validate-intake-questionnaire-version.ts <${QUESTIONNAIRE_TYPES.join('|')}>`);
    console.error('');
    console.error('Validates that questionnaire content changes have corresponding version bumps.');
    console.error('Run this in CI on all PRs.');
    process.exit(1);
  }

  // Dynamically import the questionnaire generator
  // This requires the utils package to be built
  let generateQuestionnaire: () => any;
  try {
    const utils = await import('utils');
    if (questionnaireType === 'in-person') {
      generateQuestionnaire = utils.IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE;
    } else {
      generateQuestionnaire = utils.VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE;
    }
  } catch (error) {
    console.error('Failed to import utils package. Make sure to run `npm run build` first.');
    console.error(error);
    process.exit(1);
  }

  // Generate the current questionnaire
  const generatedQuestionnaire = generateQuestionnaire();
  const generatedVersion = generatedQuestionnaire.version;

  if (!generatedVersion) {
    console.error('Generated questionnaire does not have a version field');
    process.exit(1);
  }

  console.log(`Generated ${questionnaireType} questionnaire version: ${generatedVersion}`);

  // Read the archive file
  const archiveFileName =
    questionnaireType === 'in-person'
      ? 'in-person-intake-questionnaire-archive.json'
      : 'virtual-intake-questionnaire-archive.json';

  const archiveFilePath = path.resolve(__dirname, '../../config/oystehr', archiveFileName);

  let archiveData: ArchiveData;
  try {
    const archiveContent = await fs.promises.readFile(archiveFilePath, 'utf-8');
    archiveData = JSON.parse(archiveContent);
  } catch (error) {
    console.error(`Failed to read archive file: ${archiveFilePath}`);
    console.error(error);
    process.exit(1);
  }

  const latestArchive = findLatestArchiveVersion(archiveData);

  if (!latestArchive) {
    // Archive is empty - pass, but warn
    console.log('');
    console.log('⚠ Archive is empty. This is the first version.');
    console.log('✓ Validation passed.');
    process.exit(0);
  }

  console.log(`Latest archive version: ${latestArchive.version}`);

  const versionComparison = compareVersions(generatedVersion, latestArchive.version);

  if (versionComparison < 0) {
    // Generated version is LOWER than archive - ERROR
    console.error('');
    console.error('ERROR: Version regression detected!');
    console.error(`  Generated version: ${generatedVersion}`);
    console.error(`  Archive version:   ${latestArchive.version}`);
    console.error('');
    console.error('The generated questionnaire has a lower version than what is in the archive.');
    console.error('This likely means the version was accidentally decremented.');
    process.exit(1);
  }

  if (versionComparison === 0) {
    // Versions match - check if content matches
    if (deepEqual(generatedQuestionnaire, latestArchive.resource)) {
      console.log('');
      console.log('✓ Validation passed: No changes detected.');
      process.exit(0);
    } else {
      console.error('');
      console.error('ERROR: Content changed without version bump!');
      console.error(`  Version: ${generatedVersion}`);
      console.error('');
      console.error('The generated questionnaire has the same version as the archive,');
      console.error('but the content is different. You must bump the version number');
      console.error('when making changes to the questionnaire.');
      console.error('');
      console.error('To fix: Update the version in the questionnaire config.');
      process.exit(1);
    }
  }

  // Generated version is HIGHER than archive - this is fine
  console.log('');
  console.log(`✓ Validation passed: New version ${generatedVersion} detected.`);
  process.exit(0);
}

void main();
