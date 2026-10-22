// Publishes a vetted Report Studio report as a system report of a practice: one FHIR Basic under the
// system-report code (shared/system-report.ts) that an EHR screen loads by name and renders without the
// sandbox. Run by staff with the practice's service credentials, read from packages/zambdas/.env/<env>.json
// (never printed). A report with the same name is updated in place.
//
//   npm run publish-system-report -- <file.report.json> --env <env>
//   npm run publish-system-report -- --remove <report name> --env <env>
import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import { readFileSync } from 'fs';
import path from 'path';
import { systemReportFromStudioFile } from 'utils/lib/types/adhoc/system/system-report';
import { getAuth0Token } from '../shared/getAuth0Token';
import { findSystemReportBasicByName, makeSystemReportBasic } from '../shared/system-report';

const argValue = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i !== -1 && i < process.argv.length - 1 ? process.argv[i + 1] : undefined;
};

async function main(): Promise<void> {
  const env = argValue('--env');
  const remove = argValue('--remove');
  const file = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'));
  if (!env || (!file && !remove)) {
    throw new Error('Usage: publish-system-report <file.report.json> --env <env> | --remove <name> --env <env>');
  }

  const envFile = path.resolve(__dirname, '../../.env', `${env}.json`);
  const secrets = JSON.parse(readFileSync(envFile, 'utf-8'));
  const token = await getAuth0Token(secrets);
  const oystehr = new Oystehr({
    accessToken: token,
    projectId: secrets.PROJECT_ID,
    services: { projectApiUrl: secrets.PROJECT_API },
  });

  if (remove) {
    const match = await findSystemReportBasicByName(oystehr, remove);
    if (!match?.id) throw new Error(`No system report named "${remove}" on ${env}`);
    await oystehr.fhir.delete({ resourceType: 'Basic', id: match.id });
    console.log(`Removed system report "${remove}" (Basic/${match.id}) from ${env}`);
    return;
  }

  const converted = systemReportFromStudioFile(JSON.parse(readFileSync(file!, 'utf-8')));
  if (!converted.ok) {
    throw new Error(`${file} is not a publishable Report Studio report:\n  ${converted.errors.join('\n  ')}`);
  }
  const { definition } = converted;
  const resource = makeSystemReportBasic(definition);
  const match = await findSystemReportBasicByName(oystehr, definition.name);
  const saved = match?.id
    ? await oystehr.fhir.update<Basic>({ ...resource, id: match.id })
    : await oystehr.fhir.create<Basic>(resource);
  console.log(
    `${match ? 'Updated' : 'Published'} system report "${definition.name}" (Basic/${saved.id}) on ${env}` +
      ` — ${definition.plan?.steps.length ?? 0} plan step(s)` +
      (definition.parameters.length ? `, parameters: ${definition.parameters.join(', ')}` : '')
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
