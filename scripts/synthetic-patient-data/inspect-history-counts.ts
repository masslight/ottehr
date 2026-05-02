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
  const queries = [
    { rt: 'AllergyIntolerance', tag: 'known-allergy', subj: 'patient' },
    { rt: 'MedicationStatement', tag: 'current-medication', subj: 'subject' },
    { rt: 'Condition', tag: 'medical-condition', subj: 'subject' },
    { rt: 'Procedure', tag: 'surgical-history', subj: 'subject' },
    { rt: 'EpisodeOfCare', tag: 'hospitalization', subj: 'patient' },
  ];
  for (const q of queries) {
    const r = (
      await oystehr.fhir.search({
        resourceType: q.rt as any,
        params: [
          { name: q.subj, value: `Patient/${patientId}` },
          { name: '_tag', value: q.tag },
        ],
      })
    ).unbundle();
    console.log(`${q.rt} (${q.tag}): ${r.length}`);
    for (const res of r as any[]) {
      const display =
        res.code?.coding?.[0]?.display ||
        res.code?.text ||
        res.medicationCodeableConcept?.coding?.[0]?.display ||
        res.type?.[0]?.text ||
        res.note?.[0]?.text ||
        '?';
      console.log(`  ${res.id} - ${display}`);
    }
  }
  const cers = (
    await oystehr.fhir.search({
      resourceType: 'CoverageEligibilityResponse',
      params: [{ name: 'patient', value: `Patient/${patientId}` }],
    })
  ).unbundle();
  console.log(`\nCoverageEligibilityResponse: ${cers.length}`);
  for (const r of cers as any[]) {
    console.log(`  ${r.id} status=${r.status} created=${r.created}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
