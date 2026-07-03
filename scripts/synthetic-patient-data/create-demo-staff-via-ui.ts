// Creates the 24 synth staff in a target env by driving the EHR's Admin →
// Employees → Add UI with Playwright (the UI route works where the raw API
// doesn't — "Add Employee" goes through the privileged create-user zambda).
// You log in yourself in the opened browser; the script never sees your password.
//
// Run it yourself (it creates accounts):
//   npx tsx scripts/synthetic-patient-data/create-demo-staff-via-ui.ts [--ehr https://ehr.ottehr.com]
//
// (If Playwright's browser isn't installed: npx playwright install chromium)
//
// Per staffer: open Add Employee, fill Email/First/Last, Save → lands on the
// employee edit page; for the 12 providers it then checks the "Provider" role
// box and saves (Add defaults to Staff). MAs/front-desk stay Staff (correct —
// the census uses non-provider employees for intake). Idempotent-ish: a
// duplicate email errors on that one and the script moves on.

import { chromium, Page } from '@playwright/test';
import { arg } from './shared/cli';

const EHR = arg('--ehr', 'https://ehr.ottehr.com').replace(/\/$/, '');
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

interface Staff {
  first: string;
  last: string;
  provider: boolean;
}
// Providers first (most important if interrupted), then MAs, then front desk.
const STAFF: Staff[] = [
  ...[
    'Maria Alvarez',
    'James Okafor',
    'Priya Nair',
    'Daniel Cohen',
    'Sofia Ramirez',
    'Wei Chen',
    'Aisha Patel',
    "Liam O'Brien",
    'Grace Kim',
    'Marcus Webb',
    'Elena Petrova',
    'Samuel Adeyemi',
  ].map((n) => mk(n, true)),
  ...[
    'Jasmine Lee',
    'Carlos Mendez',
    'Tanya Robinson',
    'Destiny Brooks',
    'Omar Haddad',
    'Lucia Romano',
    'Brittany Foster',
    'Andre Jackson',
    'Mei Lin',
    'Rachel Goldstein',
    'Tyrone Washington',
    'Fatima Khan',
  ].map((n) => mk(n, false)),
];
function mk(name: string, provider: boolean): Staff {
  const parts = name.split(' ');
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1], provider };
}

// No terminal interaction. Navigate to the Add form ONCE (bounces to the auth
// screens if needed). Then poll passively — crucially WITHOUT navigating while
// you're on the auth domain, since re-navigating mid-login throws you back to
// the email step. Only once we're back on the EHR origin do we (re)request the
// Add form and wait for its first field.
async function waitForLogin(page: Page, timeoutMs: number): Promise<void> {
  const ehrHost = new URL(EHR).hostname;
  const onEhr = (): boolean => {
    try {
      return new URL(page.url()).hostname === ehrHost;
    } catch {
      return false;
    }
  };
  const deadline = Date.now() + timeoutMs;
  await page.goto(`${EHR}/admin/employees/add`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  for (;;) {
    if (onEhr()) {
      // Back on the app (login finished). Ensure we're on the Add form, then confirm the field.
      if (!/\/admin\/employees\/add/.test(page.url())) {
        await page.goto(`${EHR}/admin/employees/add`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      }
      try {
        await page.getByLabel('First name').waitFor({ timeout: 3000 });
        return;
      } catch {
        /* not ready yet — fall through and keep polling */
      }
    }
    if (Date.now() > deadline) throw new Error('Timed out waiting for login / Add Employee form.');
    await page.waitForTimeout(2000);
  }
}

async function createOne(page: Page, s: Staff): Promise<'created' | 'exists' | 'failed'> {
  const email = `${slug(s.first)}.${slug(s.last)}@synth.invalid`;
  await page.goto(`${EHR}/admin/employees/add`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('First name').waitFor({ timeout: 30000 });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('First name').fill(s.first);
  await page.getByLabel('Last name').fill(s.last);
  await page.getByRole('button', { name: 'Save' }).click();
  // Success → navigates to /admin/employee/<id>. Duplicate email → stays on the
  // Add form and shows the "User is already a member of the project" snackbar
  // (AddEmployeePage.tsx). Any other failure must be counted as 'failed', not
  // 'exists'. The snackbar auto-hides after ~5s, so race it against navigation
  // rather than checking after the full navigation timeout has elapsed.
  const navigated = page
    .waitForURL(/\/admin\/employee\/[^/]+$/, { timeout: 20000 })
    .then(() => 'created' as const)
    .catch(() => null);
  const duplicate = page
    .getByText('already a member of the project')
    .first()
    .waitFor({ state: 'visible', timeout: 20000 })
    .then(() => 'exists' as const)
    .catch(() => null);
  const outcome = await Promise.race([navigated, duplicate]);
  if (outcome !== 'created') {
    if (outcome === 'exists') return 'exists';
    console.log(`    ✗ ${s.first} ${s.last} (${email}): Save did not navigate and no duplicate-email error shown`);
    return 'failed';
  }
  if (s.provider) {
    // Check the "Provider" role box, then Save on the edit page.
    const providerBox = page
      .getByRole('checkbox', { name: 'Provider', exact: true })
      .or(page.getByLabel('Provider', { exact: true }));
    try {
      await providerBox.first().waitFor({ timeout: 15000 });
      if (!(await providerBox.first().isChecked())) await providerBox.first().check();
      // Oystehr is rolling out NPI checksum (Luhn) validation on the create/update-provider flow,
      // so a blank or arbitrary NPI gets rejected on Save. 1234567893 is a known checksum-valid test
      // NPI. The NPI field only renders once the Provider role is checked, so fill it here.
      const npiField = page.getByLabel('NPI', { exact: true });
      try {
        await npiField.first().waitFor({ timeout: 5000 });
        await npiField.first().fill('1234567893');
      } catch {
        /* NPI field absent (older build / not required yet) — proceed to Save without it */
      }
      await page.getByRole('button', { name: /save/i }).first().click();
      await page.waitForTimeout(1500);
    } catch (e) {
      console.log(
        `    ⚠ ${s.first} ${s.last}: created but couldn't set Provider role (${(e as Error).message.slice(
          0,
          60
        )}) — set it manually`
      );
    }
  }
  return 'created';
}

(async () => {
  console.log(`Creating ${STAFF.length} staff via ${EHR}/admin/employees/add`);
  // Persistent profile so login survives reruns (selector fixes won't force a re-login).
  const context = await chromium.launchPersistentContext('/tmp/ottehr-staff-pw-profile', { headless: false });
  const page = context.pages()[0] ?? (await context.newPage());
  console.log(
    '\n>> Log in as admin in the opened browser (only needed the first time). The script auto-starts once the Add Employee form loads (waits up to 5 min)…\n'
  );
  await waitForLogin(page, 5 * 60 * 1000);

  const tally = { created: 0, exists: 0, failed: 0 };
  for (const s of STAFF) {
    try {
      const r = await createOne(page, s);
      tally[r]++;
      console.log(
        `  ${r === 'created' ? '✓' : r === 'exists' ? '•' : '✗'} ${s.provider ? 'Provider' : 'Staff   '} ${s.first} ${
          s.last
        }`
      );
    } catch (e) {
      tally.failed++;
      console.log(`  ✗ ${s.first} ${s.last}: ${(e as Error).message.slice(0, 80)}`);
    }
  }
  console.log(`\nDone — created ${tally.created}, already-present ${tally.exists}, failed ${tally.failed}.`);
  console.log('Leaving the browser open 60s so you can spot-check, then closing…');
  await page.waitForTimeout(60000);
  await context.close();
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
