import Oystehr from '@oystehr/sdk';

const patientId = process.argv[2];

async function main(): Promise<void> {
  const tokenRes = await fetch(process.env.AUTH0_ENDPOINT!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.AUTH0_CLIENT,
      client_secret: process.env.AUTH0_SECRET,
      audience: process.env.AUTH0_AUDIENCE,
      grant_type: 'client_credentials',
    }),
  });
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const oystehr = new Oystehr({
    accessToken: access_token,
    projectId: process.env.PROJECT_ID!,
    services: { projectApiUrl: process.env.PROJECT_API! },
  });

  const cers = (
    await oystehr.fhir.search({
      resourceType: 'CoverageEligibilityResponse',
      params: [
        { name: 'patient', value: `Patient/${patientId}` },
        { name: '_sort', value: '-created' },
        { name: '_count', value: '5' },
      ],
    })
  ).unbundle();

  console.log(`CERs for Patient/${patientId}: ${cers.length}\n`);
  for (const cer of cers as any[]) {
    console.log(`  id=${cer.id} created=${cer.created} status=${cer.status} outcome=${cer.outcome}`);
    console.log(`    coverage=${cer.insurance?.[0]?.coverage?.reference}`);
    const rawResponseExt = cer.extension?.find((e: any) => e.url?.includes('raw-response'));
    if (rawResponseExt?.valueString) {
      const parsed = JSON.parse(rawResponseExt.valueString);
      const benefits = parsed?.elig?.benefit ?? [];
      const byBucket = new Map<
        string,
        { code: string; amount: number; period: string; level: string; net: string }[]
      >();
      for (const b of benefits) {
        const cc = b.benefit_coverage_code;
        const key =
          cc === '1'
            ? 'Active'
            : cc === 'A'
            ? 'Coinsurance'
            : cc === 'B'
            ? 'Copay'
            : cc === 'C'
            ? 'Deductible'
            : cc === 'G'
            ? 'OOP-Max'
            : `cc=${cc}`;
        if (!byBucket.has(key)) byBucket.set(key, []);
        byBucket.get(key)!.push({
          code: b.benefit_code,
          amount: b.benefit_amount,
          period: b.benefit_period_code,
          level: b.benefit_level_code,
          net: b.inplan_network,
        });
      }
      for (const [k, items] of byBucket) {
        console.log(`    ${k}: ${items.length}`);
        for (const i of items) {
          console.log(`      code=${i.code} amount=${i.amount} period=${i.period} level=${i.level} net=${i.net}`);
        }
      }
    }
    console.log('');
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
