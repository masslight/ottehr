/**
 * Manual test script for the recommend-billing-suggestions zambda.
 *
 * Scenarios tested:
 * 1. Positive COVID test → expect COVID ICD-10 code + 99214 E&M
 * 2. Negative COVID test → expect NO COVID ICD-10 code + 99214 E&M
 * 3. X-ray confirming 5th metatarsal fracture → expect S92.x ICD-10 code + foot X-ray CPT + 99214 E&M
 * 4. New patient, viral conjunctivitis, OTC only → expect conjunctivitis ICD-10 code + 99202 E&M (Straightforward)
 * 5. Returning patient, seasonal allergic rhinitis mild flare, OTC only → expect allergic rhinitis ICD-10 code + 99213 E&M (Low)
 *
 * Requires the local zambda server to be running on port 3000:
 *   npm run zambdas:start
 *
 * Usage:
 *   npx tsx scripts/test-billing-suggestions.ts [--env local]
 */

import * as fs from 'fs';
import * as path from 'path';
import { BillingSuggestionInput, BillingSuggestionOutput } from 'utils';

const COVID_ICD10_CODES = ['U07.1', 'U07.2', 'J12.82'];
// Foot X-ray CPT codes: 73630 (≥3 views, most appropriate) or 73620 (2 views)
const FOOT_XRAY_CPT_CODES = ['73630', '73620'];
const RUNS_PER_SCENARIO = 5;
const ZAMBDA_URL = 'http://localhost:3000/local/zambda/recommend-billing-suggestions/execute';

// ── Config ────────────────────────────────────────────────────────────────────

const envFlag = process.argv.indexOf('--env');
const env = envFlag !== -1 ? process.argv[envFlag + 1] : 'local';
const envFilePath = path.resolve(__dirname, '../packages/zambdas/.env', `${env}.json`);
const envConfig = JSON.parse(fs.readFileSync(envFilePath, 'utf8'));

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const response = await fetch(envConfig.AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: envConfig.AUTH0_CLIENT,
      client_secret: envConfig.AUTH0_SECRET,
      audience: envConfig.AUTH0_AUDIENCE,
    }),
  });
  if (!response.ok) {
    throw new Error(`Auth0 token request failed: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

// ── Zambda call ───────────────────────────────────────────────────────────────

// Established patient with fever + systemic symptoms + COVID antigen test reviewed.
// Per 2021 AMA/CMS MDM: acute illness with systemic symptoms + data review → Moderate → 99214.
const COVID_VISIT: BillingSuggestionInput = {
  newPatient: false,
  patientAge: '17',
  patientSex: 'female',
  hpi: 'Patient presents with 3 days of fever (101.2°F), fatigue, dry cough, and myalgias. Reports close contact with a COVID-19-positive household member 5 days ago. Denies sore throat, rhinorrhea, or shortness of breath.',
  mdm: 'Patient with symptoms consistent with COVID-19 exposure. Point-of-care COVID-19 antigen test performed in office. Reviewed results and counseled patient on isolation and return precautions.',
  externalLabOrders: '',
  internalLabOrders: '',
  radiologyOrders: undefined,
  procedures: undefined,
  diagnoses: undefined,
  billing: undefined,
};

// Established patient with right foot trauma; X-ray confirms 5th metatarsal base fracture.
// Expected: S92.x ICD-10 foot fracture code, 73630 CPT (foot X-ray ≥3 views), 99214 E&M
// (new problem requiring workup + prescription-level management → Moderate).
const XRAY_BROKEN_FOOT_VISIT: BillingSuggestionInput = {
  newPatient: false,
  patientAge: '35',
  patientSex: 'male',
  hpi: 'Patient presents with right foot pain after rolling ankle stepping off a curb 2 hours ago. Pain localized to the lateral midfoot. Able to bear weight with difficulty. Denies numbness or tingling.',
  mdm: 'Clinical suspicion for metatarsal fracture. Right foot X-ray ordered (3 views). Radiology report reviewed — fracture confirmed at base of 5th metatarsal, non-displaced. Posterior splint applied. Crutches dispensed. Orthopedic referral placed. Ibuprofen and acetaminophen recommended for pain.',
  externalLabOrders: '',
  internalLabOrders: '',
  radiologyOrders: 'X-ray right foot, 3 views',
  radiologyReports:
    'Fracture of base of fifth metatarsal, right foot. Non-displaced. No dislocation. Soft tissues unremarkable.',
  procedures: undefined,
  diagnoses: undefined,
  billing: undefined,
};

// New patient with a single minor self-limited problem; no labs, no imaging, no prescription — OTC only.
// Per 2021 AMA/CMS MDM: single self-limited or minor problem + minimal risk (OTC only) → Straightforward.
// Straightforward for a new patient = 99202.
const LOW_COMPLEXITY_NEW_PATIENT_VISIT: BillingSuggestionInput = {
  newPatient: true,
  patientAge: '22',
  patientSex: 'male',
  hpi: 'New patient presents with 1 day of red, watery, itchy right eye. No discharge. No vision changes. No pain. No recent illness or sick contacts.',
  mdm: 'Presentation consistent with viral conjunctivitis, self-limited. No antibiotic drops indicated. OTC artificial tears and cool compresses advised. Counseled on hand hygiene to avoid spread. Return precautions given if vision changes or worsening.',
  externalLabOrders: '',
  internalLabOrders: '',
  radiologyOrders: undefined,
  procedures: undefined,
  diagnoses: undefined,
  billing: undefined,
};

// Established patient with known seasonal allergic rhinitis; mild spring flare, no prescription needed.
// Per 2021 AMA/CMS MDM: chronic illness with mild exacerbation + OTC management only → Low → 99213.
const LOW_COMPLEXITY_ESTABLISHED_PATIENT_VISIT: BillingSuggestionInput = {
  newPatient: false,
  patientAge: '41',
  patientSex: 'female',
  hpi: 'Established patient with known seasonal allergic rhinitis presents with 1 week of nasal congestion, sneezing, and itchy eyes consistent with her annual spring flare. Symptoms are mild. No fever. No sinus pain. No asthma symptoms.',
  mdm: 'Mild seasonal allergic rhinitis exacerbation, consistent with prior presentations. No prescription change needed. OTC loratadine and nasal saline rinse recommended. Advised to monitor for worsening or signs of sinusitis. Return precautions given.',
  externalLabOrders: '',
  internalLabOrders: '',
  radiologyOrders: undefined,
  procedures: undefined,
  diagnoses: undefined,
  billing: undefined,
};

async function callBillingSuggestions(token: string, visit: BillingSuggestionInput): Promise<BillingSuggestionOutput> {
  const response = await fetch(ZAMBDA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(visit),
  });
  if (!response.ok) {
    throw new Error(`Zambda call failed: ${response.status} ${await response.text()}`);
  }
  const wrapper = (await response.json()) as { status: number; output: BillingSuggestionOutput };
  if (wrapper.status !== 200) {
    throw new Error(`Zambda returned status ${wrapper.status}: ${JSON.stringify(wrapper.output)}`);
  }
  return wrapper.output;
}

// ── Test runner ───────────────────────────────────────────────────────────────

interface ScenarioChecks {
  /** Returns true if the suggested ICD codes are correct for this scenario. */
  icd: { fn: (codes: string[]) => boolean; expected: string };
  /** Optional CPT check. If omitted, CPT is not evaluated. */
  cpt?: { fn: (codes: string[]) => boolean; expected: string };
  /** E&M code that must appear in suggestions. */
  em: { code: string };
}

interface TestResult {
  run: number;
  icdPassed: boolean;
  cptPassed: boolean;
  emPassed: boolean;
  passed: boolean;
  suggestedIcdCodes: string[];
  suggestedCptCodes: string[];
  suggestedEmCodes: string[];
  error?: string;
}

async function runScenario(
  token: string,
  label: string,
  visit: BillingSuggestionInput,
  checks: ScenarioChecks
): Promise<TestResult[]> {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Scenario: ${label} (${RUNS_PER_SCENARIO} runs)`);
  console.log('─'.repeat(60));

  const results: TestResult[] = [];

  for (let run = 1; run <= RUNS_PER_SCENARIO; run++) {
    let icdPassed = false;
    let cptPassed = true; // default pass when no CPT check configured
    let emPassed = false;
    let suggestedIcdCodes: string[] = [];
    let suggestedCptCodes: string[] = [];
    let suggestedEmCodes: string[] = [];
    let error: string | undefined;

    try {
      const output = await callBillingSuggestions(token, visit);
      suggestedIcdCodes = output.icdCodes.map((c) => c.code);
      suggestedCptCodes = output.cptCodes.map((c) => c.code);
      suggestedEmCodes = output.emCode.map((c) => c.code);

      icdPassed = checks.icd.fn(suggestedIcdCodes);
      if (checks.cpt) {
        cptPassed = checks.cpt.fn(suggestedCptCodes);
      }
      emPassed = suggestedEmCodes.includes(checks.em.code);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const passed = icdPassed && cptPassed && emPassed;
    const icon = passed ? '✓' : '✗';
    const icdIcon = icdPassed ? '✓' : '✗';
    const cptIcon = cptPassed ? '✓' : '✗';
    const emIcon = emPassed ? '✓' : '✗';
    const icdList = suggestedIcdCodes.length ? suggestedIcdCodes.join(', ') : '(none)';
    const cptList = suggestedCptCodes.length ? suggestedCptCodes.join(', ') : '(none)';
    const emList = suggestedEmCodes.length ? suggestedEmCodes.join(', ') : '(none)';

    let line = `  Run ${run}: ${icon}  ICD ${icdIcon}: ${icdList}`;
    if (checks.cpt) {
      line += `  |  CPT ${cptIcon} (expected ${checks.cpt.expected}): ${cptList}`;
    }
    line += `  |  E&M ${emIcon} (expected ${checks.em.code}): ${emList}`;
    if (error) line += `  ERROR: ${error}`;
    console.log(line);

    results.push({
      run,
      icdPassed,
      cptPassed,
      emPassed,
      passed,
      suggestedIcdCodes,
      suggestedCptCodes,
      suggestedEmCodes,
      error,
    });
  }

  const passCount = results.filter((r) => r.passed).length;
  const icdPassCount = results.filter((r) => r.icdPassed).length;
  const cptPassCount = results.filter((r) => r.cptPassed).length;
  const emPassCount = results.filter((r) => r.emPassed).length;

  let summary = `\n  Result: ${passCount}/${RUNS_PER_SCENARIO} passed  (ICD: ${icdPassCount}/${RUNS_PER_SCENARIO}`;
  if (checks.cpt) {
    summary += `, CPT: ${cptPassCount}/${RUNS_PER_SCENARIO}`;
  }
  summary += `, E&M: ${emPassCount}/${RUNS_PER_SCENARIO})`;
  console.log(summary);

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Billing Suggestions – Accuracy Check');
  console.log(`Environment: ${env}`);
  console.log(`Zambda URL:  ${ZAMBDA_URL}`);

  console.log('\nAuthenticating...');
  const token = await getToken();
  console.log('Authenticated.');

  const positiveResults = await runScenario(
    token,
    'Positive COVID test → expect COVID ICD-10 code + 99214',
    { ...COVID_VISIT, internalLabOrders: 'Test: COVID-19 Antigen Test | Result: Positive' },
    {
      icd: {
        fn: (codes) => codes.some((c) => COVID_ICD10_CODES.includes(c)),
        expected: COVID_ICD10_CODES.join(' or '),
      },
      em: { code: '99214' },
    }
  );

  const negativeResults = await runScenario(
    token,
    'Negative COVID test → expect NO COVID ICD-10 code + 99214',
    { ...COVID_VISIT, internalLabOrders: 'Test: COVID-19 Antigen Test | Result: Negative' },
    {
      icd: {
        fn: (codes) => !codes.some((c) => COVID_ICD10_CODES.includes(c)),
        expected: 'no COVID code',
      },
      em: { code: '99214' },
    }
  );

  const xrayResults = await runScenario(
    token,
    'X-ray confirmed 5th metatarsal fracture → expect S92.x ICD + foot X-ray CPT + 99214',
    XRAY_BROKEN_FOOT_VISIT,
    {
      icd: {
        fn: (codes) =>
          codes.some((c) =>
            [
              'S92.351A', // Displaced fracture of fifth metatarsal, right foot, initial
              'S92.352A', // Displaced fracture of fifth metatarsal, left foot, initial
              'S92.356A', // Nondisplaced fracture of fifth metatarsal, right foot, initial
              'S92.357A', // Nondisplaced fracture of fifth metatarsal, left foot, initial
              'S92.301A', // Fracture of metatarsal bone(s), unspecified foot, initial
              'S92.309A', // Fracture of unspecified metatarsal bone(s), unspecified foot, initial
              'S92.909A', // Unspecified fracture of unspecified foot, initial
            ].includes(c)
          ),
        expected: 'S92.351A, S92.356A, S92.301A, or similar fifth metatarsal fracture code',
      },
      cpt: {
        fn: (codes) => codes.some((c) => FOOT_XRAY_CPT_CODES.includes(c)),
        expected: FOOT_XRAY_CPT_CODES.join(' or '),
      },
      em: { code: '99214' },
    }
  );

  const lowComplexityResults = await runScenario(
    token,
    'New patient, viral conjunctivitis, OTC only → expect conjunctivitis ICD + 99202 (Straightforward)',
    LOW_COMPLEXITY_NEW_PATIENT_VISIT,
    {
      icd: {
        fn: (codes) =>
          codes.some((c) =>
            [
              'B30.9', // Viral conjunctivitis, unspecified
              'B30.1', // Conjunctivitis due to adenovirus
              'H10.011', // Acute follicular conjunctivitis, right eye
              'H10.012', // Acute follicular conjunctivitis, left eye
              'H10.013', // Acute follicular conjunctivitis, bilateral
              'H10.019', // Acute follicular conjunctivitis, unspecified eye
              'H10.30', // Unspecified acute conjunctivitis, unspecified eye
              'H10.31', // Unspecified acute conjunctivitis, right eye
              'H10.32', // Unspecified acute conjunctivitis, left eye
              'H10.33', // Unspecified acute conjunctivitis, bilateral
            ].includes(c)
          ),
        expected: 'B30.9, B30.1, H10.011, H10.012, H10.013, H10.019, H10.30, H10.31, H10.32, or H10.33',
      },
      em: { code: '99202' },
    }
  );

  const returningLowComplexityResults = await runScenario(
    token,
    'Returning patient, seasonal allergic rhinitis mild flare, OTC only → expect allergic rhinitis ICD + 99213 (Low)',
    LOW_COMPLEXITY_ESTABLISHED_PATIENT_VISIT,
    {
      icd: {
        fn: (codes) =>
          codes.some((c) =>
            [
              'J30.1', // Allergic rhinitis due to pollen
              'J30.2', // Other seasonal allergic rhinitis
              'J30.9', // Allergic rhinitis, unspecified
            ].includes(c)
          ),
        expected: 'J30.1, J30.2, or J30.9 (allergic rhinitis)',
      },
      em: { code: '99213' },
    }
  );

  // ── Summary ──────────────────────────────────────────────────────────────────
  const allResults = [
    ...positiveResults,
    ...negativeResults,
    ...xrayResults,
    ...lowComplexityResults,
    ...returningLowComplexityResults,
  ];
  const totalPassed = allResults.filter((r) => r.passed).length;
  const totalIcdPassed = allResults.filter((r) => r.icdPassed).length;
  const totalEmPassed = allResults.filter((r) => r.emPassed).length;
  const totalRuns = allResults.length;

  const xrayCptPassed = xrayResults.filter((r) => r.cptPassed).length;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Overall:  ${totalPassed}/${totalRuns} passed`);
  console.log(`  ICD-10: ${totalIcdPassed}/${totalRuns} passed`);
  console.log(`  CPT:    ${xrayCptPassed}/${RUNS_PER_SCENARIO} passed`);
  console.log(`  E&M:    ${totalEmPassed}/${totalRuns} passed`);
  console.log('═'.repeat(60));
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
