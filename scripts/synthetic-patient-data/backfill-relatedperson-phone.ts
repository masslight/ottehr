/**
 * Backfill: repair the messaging RelatedPerson SMS number for M2M-booked patients.
 *
 * create-appointment stamps the conversation RelatedPerson's phone from the booking USER. The synth
 * pipeline books via an M2M client, whose non-production `userMe()` mock phone is +11231231234
 * (packages/utils/lib/auth/user-me.helper.ts). So the EHR chat/SMS panel shows that mock number for
 * every synth patient, even though each Patient.telecom phone is correct (NANPA-reserved 555). This
 * one-time sweep finds every RelatedPerson whose phone is the mock and repoints it at the linked
 * Patient's own phone. Idempotent; safe to re-run.
 *
 * Run (DRY first):
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-patient-data/backfill-relatedperson-phone.ts --dry
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-patient-data/backfill-relatedperson-phone.ts
 */
import Oystehr from '@oystehr/sdk';
import { Patient, RelatedPerson } from 'fhir/r4b';

const MOCK_DIGITS = '1231231234'; // the +11231231234 mock, matched on digits only (format-agnostic)
const DRY = process.argv.includes('--dry');
const need = (n: string): string => {
  const v = process.env[n];
  if (!v) throw new Error(`missing env ${n}`);
  return v;
};
const digits = (s: string | undefined): string => (s ?? '').replace(/\D/g, '');
const isMock = (v: string | undefined): boolean => digits(v).includes(MOCK_DIGITS);

async function pump<T>(items: T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx]);
      }
    })
  );
}

(async () => {
  const tok = await (
    await fetch(need('AUTH0_ENDPOINT'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: need('AUTH0_CLIENT'),
        client_secret: need('AUTH0_SECRET'),
        audience: need('AUTH0_AUDIENCE'),
        grant_type: 'client_credentials',
      }),
    })
  ).json();
  const oystehr = new Oystehr({
    accessToken: (tok as { access_token: string }).access_token,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });
  console.log(`backfill-relatedperson-phone — project ${need('PROJECT_ID')}${DRY ? '  [DRY]' : ''}`);

  // 1. Page all RelatedPersons, keep those whose phone telecom is the mock.
  const broken: RelatedPerson[] = [];
  let offset = 0;
  let scanned = 0;
  for (;;) {
    const bundle = await oystehr.fhir.search<RelatedPerson>({
      resourceType: 'RelatedPerson',
      params: [
        { name: '_count', value: '1000' },
        { name: '_offset', value: String(offset) },
      ],
    });
    const page = bundle.unbundle();
    scanned += page.length;
    for (const rp of page) if ((rp.telecom ?? []).some((t) => t.system === 'phone' && isMock(t.value))) broken.push(rp);
    if (!bundle.link?.find((l) => l.relation === 'next')) break;
    offset += 1000;
  }
  console.log(`scanned ${scanned} RelatedPersons; ${broken.length} carry the mock number`);
  if (broken.length === 0) return;

  // 2. Resolve each linked Patient's real phone (batch by _id).
  const patientIds = [
    ...new Set(broken.map((rp) => rp.patient?.reference?.replace('Patient/', '')).filter(Boolean)),
  ] as string[];
  const phoneByPatient = new Map<string, string>();
  for (let i = 0; i < patientIds.length; i += 100) {
    const chunk = patientIds.slice(i, i + 100);
    const pb = await oystehr.fhir.search<Patient>({
      resourceType: 'Patient',
      params: [
        { name: '_id', value: chunk.join(',') },
        { name: '_count', value: '100' },
      ],
    });
    for (const p of pb.unbundle()) {
      const ph = (p.telecom ?? []).find((t) => t.system === 'phone')?.value;
      if (p.id && ph) phoneByPatient.set(p.id, ph);
    }
  }

  // 3. Patch each broken RelatedPerson to its patient's phone.
  let fixed = 0;
  let skippedNoPatientPhone = 0;
  let skippedPatientAlsoMock = 0;
  await pump(broken, 8, async (rp) => {
    const pid = rp.patient?.reference?.replace('Patient/', '');
    const newPhone = pid ? phoneByPatient.get(pid) : undefined;
    if (!newPhone) {
      skippedNoPatientPhone++;
      return;
    }
    if (isMock(newPhone)) {
      skippedPatientAlsoMock++;
      return;
    }
    const telecom = (rp.telecom ?? []).map((t) => (t.system === 'phone' ? { ...t, value: newPhone } : t));
    if (!DRY) await oystehr.fhir.update<RelatedPerson>({ ...rp, telecom });
    fixed++;
  });

  console.log(
    `${
      DRY ? 'WOULD FIX' : 'fixed'
    } ${fixed} RelatedPerson(s); skipped ${skippedNoPatientPhone} (patient has no phone), ${skippedPatientAlsoMock} (patient phone also mock)`
  );
})().catch((e) => {
  console.error('FAIL', e?.message ?? e);
  process.exit(1);
});
