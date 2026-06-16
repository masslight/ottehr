// cSpell:ignore elig
import Oystehr from '@oystehr/sdk';
import { CoverageEligibilityResponse } from 'fhir/r4b';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';

const RAW_RESPONSE_EXTENSION_URL = 'https://extensions.fhir.oystehr.com/raw-response';

// Maps a token's Auth0 audience to the matching non-production Oystehr API URLs.
// Production (and anything unrecognized) falls back to the SDK defaults.
function apiUrlsFromAudience(audience: string | undefined): { fhirApiUrl?: string; projectApiUrl?: string } {
  switch (audience) {
    case 'https://dev.api.zapehr.com':
      return { fhirApiUrl: 'https://dev.fhir-api.zapehr.com', projectApiUrl: 'https://dev.project-api.zapehr.com/v1' };
    case 'https://dev2.api.zapehr.com':
      return {
        fhirApiUrl: 'https://dev2.fhir-api.zapehr.com',
        projectApiUrl: 'https://dev2.project-api.zapehr.com/v1',
      };
    case 'https://testing.api.zapehr.com':
      return {
        fhirApiUrl: 'https://testing.fhir-api.zapehr.com',
        projectApiUrl: 'https://testing.project-api.zapehr.com/v1',
      };
    case 'https://staging.api.zapehr.com':
      return {
        fhirApiUrl: 'https://staging.fhir-api.zapehr.com',
        projectApiUrl: 'https://staging.project-api.zapehr.com/v1',
      };
    default:
      // production or unknown -> use SDK defaults (https://fhir-api.zapehr.com)
      return {};
  }
}

// Best-effort decode of a JWT's `aud` claim so we can target the correct environment.
function audienceFromToken(token: string): string | undefined {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) return undefined;
    const json = Buffer.from(payloadSegment, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as { aud?: string | string[] };
    const aud = payload.aud;
    if (Array.isArray(aud)) {
      return aud.find((a) => a.includes('api.zapehr.com')) ?? aud[0];
    }
    return aud;
  } catch {
    return undefined;
  }
}

function prompt(question: string, { hideInput = false }: { hideInput?: boolean } = {}): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  if (hideInput) {
    // Mask the typed characters so the token doesn't end up in terminal scrollback.
    const rlAny = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let firstWrite = true;
    rlAny._writeToOutput = function (stringToWrite: string): void {
      if (firstWrite) {
        rlAny.output.write(stringToWrite);
        firstWrite = false;
      } else {
        rlAny.output.write('*');
      }
    };
  }

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      if (hideInput) process.stdout.write('\n');
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Pulls the raw Claim.MD clearinghouse response out of the FHIR resource's `raw-response` extension.
function extractRawResponse(eligibilityResponse: CoverageEligibilityResponse): unknown | null {
  const rawResponseExtension = eligibilityResponse.extension?.find((ext) => ext.url === RAW_RESPONSE_EXTENSION_URL);

  const rawResponseValue =
    rawResponseExtension?.valueString ||
    (rawResponseExtension?.valueAttachment?.data
      ? Buffer.from(rawResponseExtension.valueAttachment.data, 'base64').toString('utf8')
      : undefined) ||
    rawResponseExtension?.valueBase64Binary;

  if (!rawResponseValue) {
    return null;
  }

  try {
    return JSON.parse(rawResponseValue);
  } catch {
    // If it isn't valid JSON, fall back to the raw string value.
    return rawResponseValue;
  }
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Formats a date as YYYY-MMM-dd-HH:mm:ss (local time).
function formatTimestamp(date: Date): string {
  const datePart = `${date.getFullYear()}-${MONTHS[date.getMonth()]}-${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${datePart}-${timePart}`;
}

// Makes a project name safe to use as a directory name.
function sanitizeForPath(value: string): string {
  return (
    value
      .replace(/[/\\]/g, '-')
      .replace(/[^a-zA-Z0-9-_. ]/g, '')
      .trim() || 'unknown-project'
  );
}

async function main(): Promise<void> {
  const token = await prompt('Access token: ', { hideInput: true });
  if (!token) throw new Error('Access token is required.');

  const projectId = await prompt('Project ID: ');
  if (!projectId) throw new Error('Project ID is required.');

  const patientId = await prompt('Patient ID: ');
  if (!patientId) throw new Error('Patient ID is required.');

  const apiUrls = apiUrlsFromAudience(audienceFromToken(token));

  const oystehr = new Oystehr({
    accessToken: token,
    projectId,
    ...apiUrls,
  });

  // Resolve the project name for the output directory.
  let projectName = projectId;
  try {
    const project = await oystehr.project.get();
    if (project?.name) {
      projectName = project.name;
    }
  } catch (error) {
    console.warn(`⚠️  Could not fetch project name, falling back to project ID. ${String(error)}`);
  }

  const outputDir = path.join(os.homedir(), 'Downloads', 'coverage-eligibilities', sanitizeForPath(projectName));
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\nFetching CoverageEligibilityResponse IDs for patient ${patientId}...`);
  const eligibilityCheckIds = (
    await oystehr.fhir.search<CoverageEligibilityResponse>({
      resourceType: 'CoverageEligibilityResponse',
      params: [
        { name: 'patient._id', value: patientId },
        { name: '_sort', value: '-created' },
        { name: '_elements', value: 'id' },
        { name: '_count', value: '1000' },
      ],
    })
  )
    .unbundle()
    .map((cer) => cer.id)
    .filter((id): id is string => !!id);

  if (eligibilityCheckIds.length === 0) {
    console.log('No CoverageEligibilityResponse resources found for this patient.');
    return;
  }

  console.log(`Found ${eligibilityCheckIds.length} CoverageEligibilityResponse(s). Downloading each...`);

  let written = 0;
  let skipped = 0;

  for (const id of eligibilityCheckIds) {
    try {
      const eligibilityResponse = await oystehr.fhir.get<CoverageEligibilityResponse>({
        resourceType: 'CoverageEligibilityResponse',
        id,
      });

      const rawData = extractRawResponse(eligibilityResponse);
      if (rawData === null) {
        console.log(`  ⏭️  ${id}: no raw clearinghouse response found, skipping.`);
        skipped++;
        continue;
      }

      const timestampSource = eligibilityResponse.created ?? eligibilityResponse.meta?.lastUpdated;
      const timestamp = timestampSource ? new Date(timestampSource) : new Date();

      let filename = `eligibility-response-${patientId}-${formatTimestamp(timestamp)}.json`;
      let filePath = path.join(outputDir, filename);
      // Guard against collisions when multiple responses share the same second.
      if (fs.existsSync(filePath)) {
        filename = `eligibility-response-${patientId}-${formatTimestamp(timestamp)}-${id}.json`;
        filePath = path.join(outputDir, filename);
      }

      fs.writeFileSync(filePath, JSON.stringify(rawData, null, 2), 'utf8');
      console.log(`  ✅ ${id} -> ${filePath}`);
      written++;
    } catch (error) {
      console.error(`  ❌ Error processing CoverageEligibilityResponse ${id}:`, error);
    }
  }

  console.log(`\nDone. Wrote ${written} file(s), skipped ${skipped} without raw response data.`);
  console.log(`Output directory: ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
