#! npx tsx

import fs from 'fs';
import path from 'path';
import { generateQuestionnaireArchiveKey, QuestionnaireType } from '../../packages/spec/src/questionnaire-utils';

/**
 * Validates that the current questionnaire version exists in the archive.
 * Run this before production deployments to ensure all versions are archived.
 *
 * - Fails if current version is not in the archive
 * - Passes if current version exists with matching content
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

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main(): Promise<void> {
  const questionnaireType = process.argv[2] as QuestionnaireType;

  if (!questionnaireType || !QUESTIONNAIRE_TYPES.includes(questionnaireType)) {
    console.error(`Usage: npx tsx validate-intake-questionnaire-archive.ts <${QUESTIONNAIRE_TYPES.join('|')}>`);
    console.error('');
    console.error('Validates that the current questionnaire version exists in the archive.');
    console.error('Run this before production deployments.');
    console.error('');
    console.error('Use update-intake-questionnaire-archive.ts to add new versions to the archive.');
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

  // Look up the current version in the archive by key
  const archiveKey = generateQuestionnaireArchiveKey(questionnaireType, generatedVersion);
  const archivedEntry = archiveData.fhirResources[archiveKey];

  if (!archivedEntry) {
    console.error('');
    console.error('ERROR: Current questionnaire version not found in archive!');
    console.error(`  Version: ${generatedVersion}`);
    console.error(`  Expected key: ${archiveKey}`);
    console.error('');
    console.error('The archive must contain all questionnaire versions before deploying to production.');
    console.error('Run the following command to add this version to the archive:');
    console.error(`  npm run update-intake-questionnaire-archive ${questionnaireType}`);
    process.exit(1);
  }

  // Version exists in archive - verify content matches
  if (deepEqual(generatedQuestionnaire, archivedEntry.resource)) {
    console.log('');
    console.log('✓ Validation passed: Generated questionnaire matches archived version.');
    process.exit(0);
  } else {
    console.error('');
    console.error('ERROR: Content mismatch detected!');
    console.error(`  Version: ${generatedVersion}`);
    console.error(`  Archive key: ${archiveKey}`);
    console.error('');
    console.error('The generated questionnaire has the same version as the archived entry,');
    console.error('but the content is different. This should not happen.');
    console.error('');
    console.error('Possible causes:');
    console.error('  1. Questionnaire content was changed without bumping the version');
    console.error('  2. Archive was manually edited incorrectly');
    console.error('');
    console.error('To fix: Bump the version in the questionnaire config, then run:');
    console.error(`  npm run update-intake-questionnaire-archive ${questionnaireType}`);
    process.exit(1);
  }
}

void main();
