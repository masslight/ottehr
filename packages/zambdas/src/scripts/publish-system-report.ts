// Publishes a vetted Report Studio report as a system report of a practice: one FHIR Basic under the
// system-report code (shared/system-report.ts) that the EHR lists next to the saved ad-hoc reports and
// renders without the sandbox. Run by staff with the practice's service credentials, read from
// packages/zambdas/.env/<env>.json (never printed). A report with the same name is updated in place.
//
//   npm run publish-system-report -- <file.report.json> --env <env> [--roles Administrator,Provider]
//   npm run publish-system-report -- --remove <report name> --env <env>
import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import { readFileSync } from 'fs';
import path from 'path';
import { systemReportFromStudioFile } from 'utils/lib/types/adhoc/system/system-report';
import { RoleType } from 'utils/lib/types/api/user.types';
import { getAuth0Token } from '../shared/getAuth0Token';
import { listSystemReportBasics, makeSystemReportBasic, systemReportBasicName } from '../shared/system-report';

const argValue = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i !== -1 && i < process.argv.length - 1 ? process.argv[i + 1] : undefined;
};

async function main(): Promise<void> {
  const env = argValue('--env');
  const remove = argValue('--remove');
  const file = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'));
  if (!env || (!file && !remove)) {
    throw new Error(
      'Usage: publish-system-report <file.report.json> --env <env> [--roles A,B] | --remove <name> --env <env>'
    );
  }
  // Who may list and run the report; Administrator alone when not given.
  const roles = (argValue('--roles') ?? RoleType.Administrator).split(',').map((r) => r.trim()) as RoleType[];
  const unknownRoles = roles.filter((r) => !Object.values(RoleType).includes(r));
  if (unknownRoles.length) {
    throw new Error(`Unknown role(s) ${unknownRoles.join(', ')}; valid: ${Object.values(RoleType).join(', ')}`);
  }

  const envFile = path.resolve(__dirname, '../../.env', `${env}.json`);
  const secrets = JSON.parse(readFileSync(envFile, 'utf-8'));
  const token = await getAuth0Token(secrets);
  const oystehr = new Oystehr({
    accessToken: token,
    projectId: secrets.PROJECT_ID,
    services: { projectApiUrl: secrets.PROJECT_API },
  });

  const existing = (await listSystemReportBasics(oystehr)).map((basic) => ({
    basic,
    name: systemReportBasicName(basic),
  }));

  if (remove) {
    const match = existing.find(({ name }) => name === remove);
    if (!match?.basic.id) throw new Error(`No system report named "${remove}" on ${env}`);
    await oystehr.fhir.delete({ resourceType: 'Basic', id: match.basic.id });
    console.log(`Removed system report "${remove}" (Basic/${match.basic.id}) from ${env}`);
    return;
  }

  const converted = systemReportFromStudioFile(JSON.parse(readFileSync(file!, 'utf-8')), { roles });
  if (!converted.ok) {
    throw new Error(`${file} is not a publishable Report Studio report:\n  ${converted.errors.join('\n  ')}`);
  }
  const { definition } = converted;
  const resource = makeSystemReportBasic(definition);
  const match = existing.find(({ name }) => name === definition.name);
  const saved = match?.basic.id
    ? await oystehr.fhir.update<Basic>({ ...resource, id: match.basic.id })
    : await oystehr.fhir.create<Basic>(resource);
  console.log(
    `${match ? 'Updated' : 'Published'} system report "${definition.name}" (Basic/${saved.id}) on ${env}` +
      ` — ${definition.plan?.steps.length ?? 0} plan step(s), roles: ${definition.roles.join(', ')}` +
      (definition.parameters.length ? `, parameters: ${definition.parameters.join(', ')}` : '') +
      (definition.places?.length ? `, places: ${definition.places.join(', ')}` : '')
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
