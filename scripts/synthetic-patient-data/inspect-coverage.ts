import { createOystehrFromEnv } from './shared/oystehr-client';

const patientId = process.argv[2];
const encounterId = process.argv[3];

async function main(): Promise<void> {
  const oystehr = await createOystehrFromEnv();

  console.log('=== Coverage ===');
  const cov = (
    await oystehr.fhir.search({
      resourceType: 'Coverage',
      params: [{ name: 'patient', value: `Patient/${patientId}` }],
    })
  ).unbundle();
  for (const c of cov as any[]) {
    console.log(`  id=${c.id} status=${c.status} order=${c.order}`);
    console.log(`    payor=${JSON.stringify(c.payor)}`);
    console.log(`    subscriberId=${c.subscriberId}`);
    console.log(`    class=${JSON.stringify(c.class)}`);
    console.log(`    relationship=${JSON.stringify(c.relationship)}`);
    console.log(`    costToBeneficiary=${JSON.stringify(c.costToBeneficiary)}`);
  }

  console.log('\n=== Account ===');
  const acc = (
    await oystehr.fhir.search({
      resourceType: 'Account',
      params: [{ name: 'patient', value: `Patient/${patientId}` }],
    })
  ).unbundle();
  for (const a of acc as any[]) {
    console.log(`  id=${a.id} status=${a.status} type=${JSON.stringify(a.type?.coding)}`);
    console.log(`    coverage=${JSON.stringify(a.coverage)}`);
    console.log(`    guarantor=${JSON.stringify(a.guarantor)}`);
  }

  if (encounterId) {
    console.log('\n=== Encounter (payment-variant + account) ===');
    const enc = await (oystehr.fhir as any).get({ resourceType: 'Encounter', id: encounterId });
    console.log(`  id=${enc.id} status=${enc.status}`);
    console.log(`  account=${JSON.stringify(enc.account)}`);
    const variantExt = (enc.extension ?? []).find((e: any) => e.url?.includes('payment-variant'));
    console.log(`  payment-variant ext=${JSON.stringify(variantExt)}`);
  }

  console.log('\n=== CoverageEligibilityResponse ===');
  const cer = (
    await oystehr.fhir.search({
      resourceType: 'CoverageEligibilityResponse',
      params: [
        { name: 'patient', value: `Patient/${patientId}` },
        { name: '_count', value: '20' },
      ],
    })
  ).unbundle();
  console.log(`count: ${cer.length}`);
  for (const r of cer as any[]) {
    console.log(`  id=${r.id} status=${r.status} outcome=${r.outcome}`);
    console.log(`    purpose=${JSON.stringify(r.purpose)}`);
    console.log(`    insurance.length=${r.insurance?.length}`);
  }

  console.log('\n=== Organization payors referenced by coverages ===');
  const orgIds = (cov as any[]).map((c) => c.payor?.[0]?.reference?.split('/')[1]).filter(Boolean);
  for (const oid of orgIds) {
    try {
      const o = await (oystehr.fhir as any).get({ resourceType: 'Organization', id: oid });
      console.log(`  id=${o.id} name="${o.name}"`);
      console.log(`    type=${JSON.stringify(o.type)}`);
      console.log(`    identifier=${JSON.stringify(o.identifier)}`);
      console.log(`    telecom=${JSON.stringify(o.telecom)}`);
    } catch (e) {
      console.log(`  id=${oid} <fetch failed: ${(e as Error).message}>`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
