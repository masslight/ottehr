/**
 * Read-only diagnostic: inspect the scheduled-outreach config PlanDefinition and its full
 * version history to determine whether any PlanDefinition.action[].id values were ever
 * dropped or overwritten by the FHIR server across saves.
 *
 * The script prompts for the access token (masked), project id, and (optional) PlanDefinition
 * id directly in your terminal, so the token stays in your terminal and never passes through
 * chat or the command line. You may also pre-set them via env vars to skip the prompts:
 *
 *   OYSTEHR_TOKEN, OYSTEHR_PROJECT_ID, OUTREACH_PLANDEF_ID
 *   OYSTEHR_FHIR_API_URL  (optional, defaults to https://fhir-api.zapehr.com)
 *
 * Run (from packages/zambdas):  npm run probe-outreach-action-ids
 */
import * as readline from 'node:readline';
import Oystehr from '@oystehr/sdk';
import { Bundle, PlanDefinition } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils';

const RCM_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/rcm`;
const ACTION_ID_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/outreach-action-id`;

/** Prompt for a value on the terminal. When `hidden` is true the typed characters are masked. */
function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Mute echo so the secret is not displayed or captured in scrollback.
    const rlAny = rl as unknown as { _writeToOutput: (s: string) => void };
    rlAny._writeToOutput = (stringToWrite: string) => {
      // Only echo the question prompt itself; swallow the typed characters.
      if (stringToWrite.includes(question)) {
        process.stdout.write(question);
      }
    };
  }
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      if (hidden) process.stdout.write('\n');
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Use an env var if present, otherwise prompt interactively. */
async function resolveValue(
  envName: string,
  question: string,
  { hidden = false, required = true } = {}
): Promise<string> {
  const fromEnv = process.env[envName];
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  const answer = await prompt(question, hidden);
  if (required && !answer) {
    throw new Error(`A value is required for ${envName}`);
  }
  return answer;
}

interface RawActionView {
  index: number;
  id: string | undefined;
  extensionId: string | undefined;
  actionType: string | undefined;
  triggerEvent: string | undefined;
  offset: string;
}

function offsetString(action: any): string {
  const dur = action?.relatedAction?.[0]?.offsetDuration;
  if (dur) return `${dur.value ?? '?'}${dur.code ?? dur.unit ?? ''}`;
  return '—';
}

function viewAction(action: any, index: number): RawActionView {
  return {
    index,
    id: action?.id,
    extensionId: action?.extension?.find((e: any) => e.url === ACTION_ID_EXTENSION_URL)?.valueString,
    actionType: action?.code?.[0]?.coding?.[0]?.code,
    triggerEvent: action?.trigger?.[0]?.name,
    offset: offsetString(action),
  };
}

async function main(): Promise<void> {
  const accessToken = await resolveValue('OYSTEHR_TOKEN', 'Access token (input hidden): ', { hidden: true });
  const projectId = await resolveValue('OYSTEHR_PROJECT_ID', 'Project ID (blank for an M2M token): ', {
    required: false,
  });
  const planDefInput = await resolveValue('OUTREACH_PLANDEF_ID', 'PlanDefinition ID (blank = search by tags): ', {
    required: false,
  });
  const fhirApiUrl = process.env.OYSTEHR_FHIR_API_URL || 'https://fhir-api.zapehr.com';

  const oystehr = new Oystehr({
    accessToken,
    // projectId is optional for M2M tokens (already project-scoped) and only required for developer
    // tokens (which can span projects). Pass it through only when provided.
    ...(projectId ? { projectId } : {}),
    services: { fhirApiUrl },
  });

  // 1) Locate the PlanDefinition (explicit id wins; otherwise search by the config tags).
  let planDefId = planDefInput || undefined;
  if (!planDefId) {
    const bundle = await oystehr.fhir.search<PlanDefinition>({
      resourceType: 'PlanDefinition',
      params: [
        { name: '_tag', value: `${RCM_TAG_SYSTEM}|scheduled-outreach-config` },
        { name: '_tag', value: `${RCM_TAG_SYSTEM}|rcm` },
      ],
    });
    const results = bundle.unbundle();
    if (results.length === 0) {
      console.error('No scheduled-outreach config PlanDefinition found via tag search.');
      console.error('If you know the id, set OUTREACH_PLANDEF_ID and re-run.');
      process.exit(1);
    }
    if (results.length > 1) {
      console.warn(`Found ${results.length} matching PlanDefinitions: ${results.map((r) => r.id).join(', ')}`);
    }
    planDefId = results[0].id!;
  }

  console.log(`Inspecting PlanDefinition/${planDefId} history at ${fhirApiUrl}\n`);

  // 2) Pull the full version history.
  const historyResp = await oystehr.fhir.history<PlanDefinition>({ resourceType: 'PlanDefinition', id: planDefId });
  const historyBundle = (
    'data' in (historyResp as any) ? (historyResp as any).data : historyResp
  ) as Bundle<PlanDefinition>;
  const versions = (historyBundle.entry ?? [])
    .map((e) => e.resource)
    .filter((r): r is PlanDefinition => !!r)
    // Oldest first so we can watch ids evolve forward.
    .sort((a, b) => Number(a.meta?.versionId ?? 0) - Number(b.meta?.versionId ?? 0));

  console.log(`Found ${versions.length} version(s).\n`);

  // Per-version dump (raw, so you can eyeball every value yourself).
  for (const version of versions) {
    const versionId = version.meta?.versionId ?? '?';
    const lastUpdated = version.meta?.lastUpdated ?? '?';
    const actions = (version.action ?? []).map(viewAction);

    console.log(`── version ${versionId}  (lastUpdated ${lastUpdated}) — ${actions.length} action(s)`);
    for (const a of actions) {
      console.log(
        `   [${a.index}] action.id=${a.id ?? '<MISSING>'}  ext.id=${a.extensionId ?? '<none>'}  ` +
          `type=${a.actionType ?? '?'}  trigger=${a.triggerEvent ?? '?'}  offset=${a.offset}`
      );
    }
    console.log('');
  }

  // Compare each version to the one immediately before it, aligned by action slot (index).
  // This is the authoritative, structure-aware view: it never collapses distinct actions
  // together, and it is explicit when the action count changes (which makes index alignment
  // meaningless and is itself a "structure changed" event, not an id rewrite).
  console.log('════════ changes between consecutive versions ════════\n');
  let anyMissing = false;
  let anyIdChanged = false;
  let anyCountChanged = false;

  for (let i = 1; i < versions.length; i++) {
    const prevActions = (versions[i - 1].action ?? []).map(viewAction);
    const currActions = (versions[i].action ?? []).map(viewAction);
    const versionId = versions[i].meta?.versionId ?? '?';
    const lastUpdated = versions[i].meta?.lastUpdated ?? '?';

    if (currActions.some((a) => !a.id)) anyMissing = true;

    if (prevActions.length !== currActions.length) {
      anyCountChanged = true;
      console.log(
        `version ${versionId}  (lastUpdated ${lastUpdated}): action count ${prevActions.length} → ` +
          `${currActions.length} (structure changed; per-slot id comparison skipped)`
      );
      console.log('');
      continue;
    }

    const changes: string[] = [];
    for (let idx = 0; idx < currActions.length; idx++) {
      const before = prevActions[idx];
      const after = currActions[idx];
      if (before.id !== after.id) {
        anyIdChanged = true;
        changes.push(
          `   [${idx}] ${after.actionType ?? '?'}|${after.triggerEvent ?? '?'}|${after.offset}:  ` +
            `action.id ${before.id ?? '<MISSING>'} → ${after.id ?? '<MISSING>'}`
        );
      }
    }
    if (changes.length > 0) {
      console.log(`version ${versionId}  (lastUpdated ${lastUpdated})`);
      console.log(changes.join('\n'));
      console.log('');
    }
  }

  if (!anyIdChanged && !anyCountChanged) {
    console.log('(no action.id changed between any consecutive versions)');
    console.log('');
  }

  console.log('════════ summary ════════');
  console.log(`action.id ever MISSING:                  ${anyMissing ? 'YES' : 'no'}`);
  console.log(`action.id changed across same-shape save: ${anyIdChanged ? 'YES' : 'no'}`);
  console.log(`action count changed between versions:    ${anyCountChanged ? 'YES' : 'no'}`);
  if (anyIdChanged) {
    console.log('\nConclusion: the server reassigns action.id across saves of the same action set.');
    console.log('=> action.id is NOT a reliable idempotency key (the durable extension fix is warranted).');
  } else {
    console.log('\nConclusion: action.id did NOT change across any same-shape save.');
    console.log('=> No evidence here that the server rewrites action.id; look elsewhere for the duplicate cause.');
    if (anyCountChanged) {
      console.log('   (Some versions changed the number of actions — those are edits, not id rewrites.)');
    }
  }
}

main().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
