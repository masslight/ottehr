/* eslint-disable no-console */
// Synthesizes billing-report test data into the LOCAL environment:
//   - FHIR: Locations, Patients, visit graphs (Appointment+Encounter+Claim), PaymentNotices
//   - Stripe (test mode): customers (linked to patients), cards on file, send_invoice invoices
//
// Fail-closed: requires SEED_OK=1, only runs against .env/local.json with a test-mode Stripe key.
// Phases can be skipped for reruns: SKIP_FHIR_BASE=1 SKIP_CUSTOMERS=1 SKIP_INVOICES=1 SKIP_PAYMENTS=1
// Volumes: CUSTOMERS=6000 INVOICES=8000 PAYMENTS=10000 VISITS=2000
//
// Usage: SEED_OK=1 NODE_OPTIONS='--preserve-symlinks' npx tsx tmp/seed-report-test-data.ts
import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { Appointment, Claim, Encounter, Location, Patient, PaymentNotice, PaymentReconciliation } from 'fhir/r4b';
import * as fs from 'fs';
import Stripe from 'stripe';
import { PAYMENT_METHOD_EXTENSION_URL } from '../packages/utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from '../packages/utils/lib/fhir/systemUrls';
import { createBillingClient } from '../packages/zambdas/src/billing/shared';
import { getAuth0Token } from '../packages/zambdas/src/shared/getAuth0Token';
import { getStripeClient, STRIPE_PAYMENT_ID_SYSTEM } from '../packages/zambdas/src/shared/stripeIntegration';

const SECRETS_PATH = 'packages/zambdas/.env/local.json';

const CUSTOMERS = Number(process.env.CUSTOMERS ?? 6000);
const INVOICES = Number(process.env.INVOICES ?? 8000);
const PAYMENTS = Number(process.env.PAYMENTS ?? 10000);
const VISITS = Number(process.env.VISITS ?? 2000);
const LOCATION_COUNT = 8;

const STRIPE_CONCURRENCY = 10;
const FHIR_BATCH_SIZE = 100;
const SEED_MARKER = 'report-seed';

const CLAIM_ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');

// --- guards -------------------------------------------------------------------------------------
if (process.env.SEED_OK !== '1') {
  console.error('Refusing to run: set SEED_OK=1 to intentionally seed test data.');
  process.exit(1);
}
const secrets = JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf8'));
if (secrets.ENVIRONMENT !== 'local' || !String(secrets.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_')) {
  console.error('Refusing to run: secrets are not local + Stripe test mode.');
  process.exit(1);
}

// --- helpers ------------------------------------------------------------------------------------
const FIRST_NAMES = ['Ava', 'Ben', 'Carla', 'Dev', 'Elena', 'Felix', 'Grace', 'Hugo', 'Iris', 'Jonah', 'Kira', 'Liam', 'Mona', 'Nico', 'Opal', 'Pete', 'Quinn', 'Rosa', 'Sam', 'Tess', 'Uma', 'Vic', 'Wren', 'Ximena', 'Yuri', 'Zoe'];
const LAST_NAMES = ['Alvarez', 'Brooks', 'Chen', 'Diaz', 'Ellis', 'Fischer', 'Garcia', 'Hale', 'Ivanov', 'Jensen', 'Khan', 'Lopez', 'Meyer', 'Nakamura', 'Ortiz', 'Patel', 'Quiroga', 'Rivera', 'Silva', 'Tran', 'Ueda', 'Vega', 'Walsh', 'Xu', 'Young', 'Zimmer'];
const LOCATION_NAMES = ['Northside Clinic', 'Southgate Pediatrics', 'East End Urgent Care', 'Westview Family Health', 'Central Medical Plaza', 'Lakeshore Clinic', 'Hillcrest Health', 'Riverbend Care'];

const randomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(list: T[]): T => list[randomInt(0, list.length - 1)];
const randomPastISO = (maxDaysAgo: number): string =>
  new Date(Date.now() - randomInt(1, maxDaysAgo) * 86_400_000 - randomInt(0, 86_399_999)).toISOString();
const fakeStripeId = (prefix: string): string =>
  `${prefix}_seed${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;

async function workerPool<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const run = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      // retry Stripe rate limits with backoff; anything else surfaces
      for (let attempt = 0; ; attempt++) {
        try {
          await worker(items[index], index);
          break;
        } catch (err) {
          const rateLimited = (err as Stripe.errors.StripeError)?.type === 'StripeRateLimitError';
          if (rateLimited && attempt < 5) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          throw err;
        }
      }
      if ((index + 1) % 250 === 0) console.log(`  … ${index + 1}/${items.length}`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, run));
}

async function fhirBatchCreate<T extends { resourceType: string }>(oystehr: Oystehr, resources: T[]): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < resources.length; i += FHIR_BATCH_SIZE) {
    const batch = resources.slice(i, i + FHIR_BATCH_SIZE);
    const requests: BatchInputPostRequest<any>[] = batch.map((resource) => ({
      method: 'POST',
      url: `/${resource.resourceType}`,
      resource,
    }));
    const bundle = await oystehr.fhir.transaction<any>({ requests });
    for (const entry of bundle.entry ?? []) {
      const id = entry.resource?.id ?? entry.response?.location?.split('/')[1];
      if (id) ids.push(id);
    }
    if ((i / FHIR_BATCH_SIZE) % 10 === 0) console.log(`  … ${Math.min(i + FHIR_BATCH_SIZE, resources.length)}/${resources.length}`);
  }
  return ids;
}

// --- main ---------------------------------------------------------------------------------------
async function main(): Promise<void> {
  const token = await getAuth0Token(secrets);
  const oystehr = createBillingClient(token, secrets);
  const stripe = getStripeClient(secrets);

  // ── phase 1: FHIR base — locations + patients ────────────────────────────────────────────────
  let locationIds: string[] = [];
  let patientIds: string[] = [];
  if (process.env.SKIP_FHIR_BASE !== '1') {
    console.log(`\nPhase 1: ${LOCATION_COUNT} Locations + ${CUSTOMERS} Patients`);
    locationIds = await fhirBatchCreate<Location>(
      oystehr,
      LOCATION_NAMES.slice(0, LOCATION_COUNT).map((name) => ({ resourceType: 'Location', status: 'active', name }))
    );
    const patients: Patient[] = Array.from({ length: CUSTOMERS }, (_v, i) => ({
      resourceType: 'Patient',
      name: [{ given: [pick(FIRST_NAMES)], family: `${pick(LAST_NAMES)}-S${i}` }],
      birthDate: `${randomInt(1950, 2020)}-${String(randomInt(1, 12)).padStart(2, '0')}-${String(randomInt(1, 28)).padStart(2, '0')}`,
      identifier: [{ system: ottehrIdentifierSystem('synthetic'), value: SEED_MARKER }],
    }));
    patientIds = await fhirBatchCreate(oystehr, patients);
    console.log(`  created ${locationIds.length} locations, ${patientIds.length} patients`);
  } else {
    console.log('\nPhase 1 skipped: loading existing seed locations/patients');
    // FHIR name search is prefix-match, so query each seeded location name individually
    const locationBundles = await Promise.all(
      LOCATION_NAMES.slice(0, LOCATION_COUNT).map((name) =>
        oystehr.fhir.search<Location>({
          resourceType: 'Location',
          params: [
            { name: 'name', value: name },
            { name: '_count', value: '5' },
          ],
        })
      )
    );
    locationIds = [
      ...new Set(locationBundles.flatMap((bundle) => bundle.unbundle().map((location) => location.id!))),
    ].filter(Boolean);
    const bundle = await oystehr.fhir.search<Patient>({
      resourceType: 'Patient',
      params: [
        { name: 'identifier', value: `${ottehrIdentifierSystem('synthetic')}|${SEED_MARKER}` },
        { name: '_elements', value: 'id' },
        { name: '_count', value: '10000' },
      ],
    });
    patientIds = bundle.unbundle().map((p) => p.id!).filter(Boolean);
    console.log(`  loaded ${locationIds.length} locations, ${patientIds.length} patients`);
    if (locationIds.length === 0 || patientIds.length === 0) {
      throw new Error('No seeded locations/patients found; rerun without SKIP_FHIR_BASE');
    }
  }

  // ── phase 2: Stripe customers (+ cards for ~50%) ─────────────────────────────────────────────
  const customerIds: string[] = [];
  const cardCustomerIds = new Set<string>();
  if (process.env.SKIP_CUSTOMERS !== '1') {
    console.log(`\nPhase 2: ${CUSTOMERS} Stripe customers (~50% with a default card)`);
    await workerPool(patientIds.slice(0, CUSTOMERS), STRIPE_CONCURRENCY, async (patientId, index) => {
      const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      const customer = await stripe.customers.create({
        name,
        email: `seed-${index}@example.com`,
        metadata: { oystehr_patient_id: patientId, synthetic: SEED_MARKER },
      });
      customerIds.push(customer.id);
      if (index % 2 === 0) {
        const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id });
        await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } });
        cardCustomerIds.add(customer.id);
      }
    });
    console.log(`  created ${customerIds.length} customers (${cardCustomerIds.size} with cards)`);
  } else {
    console.log('\nPhase 2 skipped: loading existing seed customers');
    for await (const customer of stripe.customers.list({ limit: 100 })) {
      if (customer.metadata?.synthetic === SEED_MARKER) {
        customerIds.push(customer.id);
        if (customer.invoice_settings?.default_payment_method) cardCustomerIds.add(customer.id);
      }
    }
    console.log(`  loaded ${customerIds.length} customers (${cardCustomerIds.size} with cards)`);
  }

  // ── phase 3: visit graphs (Appointment + Encounter, then Claims) ─────────────────────────────
  console.log(`\nPhase 3: ${VISITS} visit graphs`);
  const visitPatientIds = Array.from({ length: VISITS }, () => pick(patientIds));
  const appointments: Appointment[] = visitPatientIds.map((patientId, i) => {
    const start = randomPastISO(180);
    return {
      resourceType: 'Appointment',
      status: 'fulfilled',
      start,
      end: new Date(new Date(start).getTime() + 30 * 60_000).toISOString(),
      participant: [
        { actor: { reference: `Patient/${patientId}` }, status: 'accepted' },
        { actor: { reference: `Location/${locationIds[i % locationIds.length]}` }, status: 'accepted' },
      ],
    };
  });
  const appointmentIds = await fhirBatchCreate(oystehr, appointments);
  const encounters: Encounter[] = appointmentIds.map((appointmentId, i) => ({
    resourceType: 'Encounter',
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
    subject: { reference: `Patient/${visitPatientIds[i]}` },
    appointment: [{ reference: `Appointment/${appointmentId}` }],
    period: { start: appointments[i].start, end: appointments[i].end },
  }));
  const encounterIds = await fhirBatchCreate(oystehr, encounters);
  const claims: Claim[] = encounterIds.map((encounterId, i) => ({
    resourceType: 'Claim',
    status: 'active',
    type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
    use: 'claim',
    created: appointments[i].start!,
    patient: { reference: `Patient/${visitPatientIds[i]}` },
    identifier: [{ system: CLAIM_ENCOUNTER_ID_SYSTEM, value: encounterId }],
    priority: { coding: [{ code: 'normal' }] },
    provider: { reference: `Organization/${secrets.ORGANIZATION_ID}` },
    insurance: [{ sequence: 1, focal: true, coverage: { display: 'self-pay' } }],
    total: { value: randomInt(50, 600), currency: 'USD' },
  }));
  const claimIds = await fhirBatchCreate(oystehr, claims);
  console.log(`  created ${appointmentIds.length} appointments, ${encounterIds.length} encounters, ${claimIds.length} claims`);

  // ── phase 4: Stripe invoices ─────────────────────────────────────────────────────────────────
  const paidInvoiceIds: string[] = [];
  if (process.env.SKIP_INVOICES !== '1') {
    console.log(`\nPhase 4: ${INVOICES} Stripe invoices (55% upcoming, 30% past-due-in-2min, 15% paid)`);
    const targets = Array.from({ length: INVOICES }, () => pick(customerIds));
    await workerPool(targets, STRIPE_CONCURRENCY, async (customerId, index) => {
      const visitIndex = index % encounterIds.length;
      const roll = index % 20;
      // Stripe rejects past due dates, so "past due" invoices come due 2 minutes from now
      const dueSeconds =
        roll < 11
          ? Math.floor(Date.now() / 1000) + randomInt(5, 30) * 86_400
          : Math.floor(Date.now() / 1000) + 120;
      // draft invoice first with the item pinned to it: concurrent workers hitting the same
      // customer must not steal each other's pending items (a $0 invoice auto-pays on finalize)
      const invoice = await stripe.invoices.create({
        customer: customerId,
        collection_method: 'send_invoice',
        due_date: dueSeconds,
        pending_invoice_items_behavior: 'exclude',
        metadata: {
          synthetic: SEED_MARKER,
          oystehr_encounter_id: encounterIds[visitIndex],
        },
      });
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        amount: randomInt(2500, 45000),
        currency: 'usd',
        description: 'Visit charges (synthetic)',
      });
      await stripe.invoices.finalizeInvoice(invoice.id);
      if (roll >= 17) {
        try {
          await stripe.invoices.pay(invoice.id, { paid_out_of_band: true });
          paidInvoiceIds.push(invoice.id);
        } catch (err) {
          // defensive: an SDK retry can race an already-applied payment
          if (!(err as Stripe.errors.StripeError)?.message?.includes('already paid')) throw err;
          paidInvoiceIds.push(invoice.id);
        }
      }
    });
    console.log(`  created ${targets.length} invoices (${paidInvoiceIds.length} paid)`);
  } else {
    console.log('\nPhase 4 skipped');
  }

  // ── phase 5: PaymentNotices ──────────────────────────────────────────────────────────────────
  if (process.env.SKIP_PAYMENTS !== '1') {
    console.log(`\nPhase 5: ${PAYMENTS} PaymentNotices over the past 6 months`);
    const orgRef = { reference: `Organization/${secrets.ORGANIZATION_ID}` };
    const methods = ['card', 'card', 'card', 'card', 'card', 'cash', 'cash', 'check', 'card-invoice', 'card-invoice'];
    const notices: PaymentNotice[] = Array.from({ length: PAYMENTS }, (_v, i) => {
      const visitIndex = randomInt(0, encounterIds.length - 1);
      const createdISO = randomPastISO(180);
      const isRefund = i % 20 === 19;
      const amountValue = randomInt(10, 300);
      const method = pick(methods);
      const invoiceLinked = method === 'card-invoice';
      const chargeId = fakeStripeId('ch');
      const identifiers = invoiceLinked
        ? [
            { system: STRIPE_PAYMENT_ID_SYSTEM, value: paidInvoiceIds.length > 0 ? pick(paidInvoiceIds) : fakeStripeId('in') },
            { system: STRIPE_PAYMENT_ID_SYSTEM, value: chargeId },
          ]
        : method === 'card'
          ? [
              { system: STRIPE_PAYMENT_ID_SYSTEM, value: fakeStripeId('pi') },
              { system: STRIPE_PAYMENT_ID_SYSTEM, value: chargeId },
            ]
          : [];
      const disposition = isRefund
        ? `Refund (synthetic) for charge ${chargeId}`
        : `Payment (synthetic) via ${method}`;
      const reconciliation: PaymentReconciliation = {
        resourceType: 'PaymentReconciliation',
        id: 'contained-reconciliation',
        status: 'active',
        created: createdISO,
        disposition,
        outcome: 'complete',
        paymentDate: createdISO.slice(0, 10),
        paymentAmount: { value: isRefund ? -amountValue : amountValue, currency: 'USD' },
      };
      return {
        resourceType: 'PaymentNotice',
        status: 'active',
        request: {
          reference: `Claim/${claimIds[visitIndex]}`,
          identifier: { system: CLAIM_ENCOUNTER_ID_SYSTEM, value: encounterIds[visitIndex] },
        },
        created: createdISO,
        amount: { value: isRefund ? -amountValue : amountValue, currency: 'USD' },
        ...(identifiers.length > 0 ? { identifier: identifiers } : {}),
        extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: method === 'card-invoice' ? 'card' : method }],
        contained: [reconciliation],
        payment: { reference: '#contained-reconciliation' },
        payee: orgRef,
        recipient: orgRef,
      };
    });
    await fhirBatchCreate(oystehr, notices);
    console.log(`  created ${notices.length} payment notices`);
  } else {
    console.log('\nPhase 5 skipped');
  }

  console.log('\n✅ Seeding complete.');
  console.log('Notes:');
  console.log('- "past due" invoices become past due ~2 minutes after seeding (Stripe rejects past due dates)');
  console.log('- aging trend history clusters in the current month (finalized_at cannot be backdated)');
  console.log(`- rerun with SKIP_FHIR_BASE=1 SKIP_CUSTOMERS=1 etc. to top up individual phases`);
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
