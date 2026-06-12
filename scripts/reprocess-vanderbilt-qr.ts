/**
 * Re-evaluates calculated expressions on a Vanderbilt QuestionnaireResponse and
 * writes the computed values (screen booleans + rationale strings) back into the
 * QR's "results" group. Use this after updating expressions on the Questionnaire
 * to backfill existing QRs.
 *
 * Usage:
 *   npx env-cmd -f apps/ehr/env/tests.<env>.json npx tsx scripts/reprocess-vanderbilt-qr.ts <appointmentId>
 *
 * Required env vars: AUTH0_CLIENT, AUTH0_SECRET, PROJECT_ID.
 * Optional overrides: AUTH0_ENDPOINT, AUTH0_AUDIENCE, FHIR_API.
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    console.error('Provide credentials via env file, e.g.');
    console.error(
      `  npx env-cmd -f apps/ehr/env/tests.<env>.json npx tsx scripts/reprocess-vanderbilt-qr.ts <appointmentId>`
    );
    process.exit(1);
  }
  return v;
}

const ENV = {
  AUTH0_ENDPOINT: process.env.AUTH0_ENDPOINT || 'https://auth.zapehr.com/oauth/token',
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || 'https://api.zapehr.com',
  AUTH0_CLIENT: requireEnv('AUTH0_CLIENT'),
  AUTH0_SECRET: requireEnv('AUTH0_SECRET'),
  FHIR_API: process.env.FHIR_API || 'https://fhir-api.zapehr.com',
  PROJECT_ID: requireEnv('PROJECT_ID'),
};

const APPT_ID = process.argv[2];
if (!APPT_ID) {
  console.error('Usage: npx tsx scripts/reprocess-vanderbilt-qr.ts <appointmentId>');
  process.exit(1);
}

const HIDDEN_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-hidden';
const CALC_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression';
const PRACTICE_MANAGED_TAG_CODE = 'practice-managed';

async function getToken(): Promise<string> {
  const res = await fetch(ENV.AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: ENV.AUTH0_CLIENT,
      client_secret: ENV.AUTH0_SECRET,
      audience: ENV.AUTH0_AUDIENCE,
    }),
  });
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function fhirGet(token: string, path: string): Promise<any> {
  const res = await fetch(`${ENV.FHIR_API}/r4/${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'x-zapehr-project-id': ENV.PROJECT_ID },
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fhirPut(token: string, resourceType: string, id: string, body: any): Promise<any> {
  const res = await fetch(`${ENV.FHIR_API}/r4/${resourceType}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-zapehr-project-id': ENV.PROJECT_ID,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`PUT ${resourceType}/${id} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function isHidden(item: any): boolean {
  return item.extension?.some((e: any) => e.url === HIDDEN_URL && e.valueBoolean === true);
}

function getExpression(item: any): string | undefined {
  const ext = item.extension?.find((e: any) => e.url === CALC_URL);
  if (ext?.valueExpression?.language === 'text/javascript') return ext.valueExpression.expression;
  return undefined;
}

function extractAnswer(answer: any): any {
  if (answer.valueCoding?.code) return parseInt(answer.valueCoding.code, 10) || answer.valueCoding.code;
  if (answer.valueString !== undefined) return answer.valueString;
  if (answer.valueBoolean !== undefined) return answer.valueBoolean;
  if (answer.valueInteger !== undefined) return answer.valueInteger;
  if (answer.valueDecimal !== undefined) return answer.valueDecimal;
  return undefined;
}

function buildAnswers(items: any[], out: Record<string, any> = {}): Record<string, any> {
  for (const it of items || []) {
    if (it.answer?.[0]) {
      const v = extractAnswer(it.answer[0]);
      if (v !== undefined) out[it.linkId] = v;
    }
    if (it.item) buildAnswers(it.item, out);
  }
  return out;
}

function flattenItems(items: any[], out: any[] = []): any[] {
  for (const it of items || []) {
    out.push(it);
    if (it.item) flattenItems(it.item, out);
  }
  return out;
}

function evaluateExpressions(allItems: any[], answers: Record<string, any>): Record<string, any> {
  const results: Record<string, any> = {};
  for (let pass = 0; pass < 2; pass++) {
    for (const item of allItems) {
      const expr = getExpression(item);
      if (!expr) continue;
      try {
        const ctx = { ...answers, ...results };
        const fn = new Function('answers', `with(answers) { return (${expr}); }`);
        results[item.linkId] = fn(ctx);
      } catch (e: any) {
        console.warn(`  failed to evaluate ${item.linkId}:`, e.message);
      }
    }
  }
  return results;
}

function valueFor(v: any): any {
  if (typeof v === 'boolean') return { valueBoolean: v };
  if (typeof v === 'number') return { valueDecimal: v };
  return { valueString: String(v) };
}

async function main(): Promise<void> {
  const token = await getToken();

  console.log(`Looking up encounter for appointment ${APPT_ID}...`);
  const encBundle = await fhirGet(token, `Encounter?appointment=${APPT_ID}`);
  const encounter = encBundle.entry?.[0]?.resource;
  if (!encounter) throw new Error('No encounter found for appointment');
  console.log(`  encounter: ${encounter.id}`);

  console.log('Fetching QuestionnaireResponses on encounter...');
  const qrBundle = await fhirGet(
    token,
    `QuestionnaireResponse?encounter=Encounter/${encounter.id}&_sort=-_lastUpdated&_count=50`
  );
  const qrs = (qrBundle.entry || []).map((e: any) => e.resource);
  const pmQrs = qrs.filter((qr: any) => qr.meta?.tag?.some((t: any) => t.code === PRACTICE_MANAGED_TAG_CODE));
  console.log(`  found ${qrs.length} QRs total, ${pmQrs.length} practice-managed`);

  if (pmQrs.length === 0) {
    console.log('No practice-managed QRs to reprocess.');
    return;
  }

  const qr = pmQrs[0];
  console.log(`\nReprocessing QR ${qr.id}`);
  console.log(`  questionnaire: ${qr.questionnaire}`);

  const qUrl = qr.questionnaire?.split('|')[0];
  if (!qUrl) throw new Error('QR has no questionnaire canonical URL');
  const qBundle = await fhirGet(token, `Questionnaire?url=${encodeURIComponent(qUrl)}&_sort=-_lastUpdated&_count=1`);
  const questionnaire = qBundle.entry?.[0]?.resource;
  if (!questionnaire) throw new Error('Questionnaire not found for QR');
  console.log(`  loaded Questionnaire ${questionnaire.id} (${questionnaire.title})`);

  const answers = buildAnswers(qr.item || []);
  console.log(`  extracted ${Object.keys(answers).length} raw answers`);

  const allItems = flattenItems(questionnaire.item || []);
  const computedItems = allItems.filter((it: any) => isHidden(it) && getExpression(it));
  console.log(`  evaluating ${computedItems.length} calculated items...`);
  const results = evaluateExpressions(allItems, answers);

  const resultsGroupItems = computedItems
    .filter((it: any) => results[it.linkId] !== undefined)
    .map((it: any) => ({ linkId: it.linkId, answer: [valueFor(results[it.linkId])] }));

  console.log('\n  computed values:');
  for (const it of resultsGroupItems) {
    const v = it.answer[0].valueBoolean ?? it.answer[0].valueString ?? it.answer[0].valueDecimal;
    console.log(`    ${it.linkId}: ${v}`);
  }

  const newItems = (qr.item || []).filter((i: any) => i.linkId !== 'results');
  newItems.push({ linkId: 'results', item: resultsGroupItems });

  const updatedQr = { ...qr, item: newItems };
  console.log(`\nWriting updated QR ${qr.id}...`);
  await fhirPut(token, 'QuestionnaireResponse', qr.id, updatedQr);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
