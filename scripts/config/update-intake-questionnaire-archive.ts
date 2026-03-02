#! npx tsx

import fs from 'fs';
import path from 'path';
import { generateQuestionnaireArchiveKey, QuestionnaireType } from '../../packages/spec/src/questionnaire-utils';

// We need to import from the built utils package
// This script should be run after building
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

async function main(): Promise<void> {
  const questionnaireType = process.argv[2] as QuestionnaireType;

  if (!questionnaireType || !QUESTIONNAIRE_TYPES.includes(questionnaireType)) {
    console.error(`Usage: npx tsx update-intake-questionnaire-archive.ts <${QUESTIONNAIRE_TYPES.join('|')}>`);
    console.error('');
    console.error('Updates the archive file with a new questionnaire version.');
    console.error('Use validate-intake-questionnaire-archive.ts to check if an update is needed.');
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

  // Find the latest version in the archive
  const latestArchive = findLatestArchiveVersion(archiveData);

  if (!latestArchive) {
    // Archive is empty - add the first entry
    console.log('Archive is empty. Adding generated questionnaire as first entry.');
    const newKey = generateQuestionnaireArchiveKey(questionnaireType, generatedVersion);
    archiveData.fhirResources[newKey] = { resource: generatedQuestionnaire };
    await fs.promises.writeFile(archiveFilePath, JSON.stringify(archiveData, null, 2));
    console.log(`✓ Archive updated with version ${generatedVersion}`);
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
    console.error('Cannot update the archive with a lower version.');
    process.exit(1);
  }

  if (versionComparison === 0) {
    // Versions match - nothing to update
    console.log('');
    console.log('✓ Archive already contains this version. No update needed.');
    process.exit(0);
  }

  // Generated version is HIGHER than archive - update
  console.log('');
  console.log(`Updating archive: ${latestArchive.version} -> ${generatedVersion}`);

  const newKey = generateQuestionnaireArchiveKey(questionnaireType, generatedVersion);
  archiveData.fhirResources[newKey] = { resource: generatedQuestionnaire };
  await fs.promises.writeFile(archiveFilePath, JSON.stringify(archiveData, null, 2));
  console.log(`✓ Archive updated with version ${generatedVersion}`);
  process.exit(0);
}

void main();
