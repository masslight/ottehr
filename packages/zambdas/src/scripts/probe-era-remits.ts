// Dev probe: run the real ERA detail mappers over a live ERA and print what the detail screen
// would show. Usage: npx tsx src/scripts/probe-era-remits.ts <paymentReconciliationId>
import Oystehr from '@oystehr/sdk';
import { Claim, ClaimResponse, PaymentReconciliation } from 'fhir/r4b';
import * as fs from 'fs';
import { fetchClaimResponsesByPaymentReconciliations } from '../billing/claim-amounts';
import { buildEraClaimRemit, eraPatientAccountNumber, resolveEraPayee } from '../billing/era-remits';
import { getEraCheckNumber } from '../billing/shared';
import { getAuth0Token } from '../shared';

const ENV = process.env.ENV || 'local';
const secrets = JSON.parse(fs.readFileSync(`../../config/.env/${ENV}.json`, 'utf8'));

async function main(): Promise<void> {
  const prId = process.argv[2];
  if (!prId) throw new Error('usage: probe-era-remits.ts <paymentReconciliationId>');

  const token = await getAuth0Token(secrets);
  const oystehr = new Oystehr({
    accessToken: token,
    services: {
      fhirApiUrl: secrets.FHIR_API.replace(/\/r4/g, ''),
      projectApiUrl: secrets.PROJECT_API,
    },
  });

  const prBundle = await oystehr.fhir.search<PaymentReconciliation>({
    resourceType: 'PaymentReconciliation',
    params: [{ name: '_id', value: prId }],
  });
  const pr = prBundle.unbundle()[0];
  if (!pr) throw new Error('ERA not found');

  const claimResponses: ClaimResponse[] =
    (await fetchClaimResponsesByPaymentReconciliations(oystehr, [pr])).get(pr.id ?? '') ?? [];

  const matchedClaimIds = [
    ...new Set(
      claimResponses
        .map((cr) => cr.request?.reference ?? '')
        .filter((r) => r.startsWith('Claim/'))
        .map((r) => r.replace('Claim/', ''))
    ),
  ];
  let claims: Claim[] = [];
  if (matchedClaimIds.length) {
    const cb = await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [{ name: '_id', value: matchedClaimIds.join(',') }],
    });
    claims = cb.unbundle();
  }

  console.log('=== HEADER ===');
  console.log({
    checkNumber: getEraCheckNumber(pr),
    checkDate: pr.paymentDate,
    createdDate: pr.created,
    checkAmount: pr.paymentAmount?.value,
    paymentMethod: pr.paymentIdentifier?.type?.coding?.[0]?.code ?? '',
    payee: resolveEraPayee(claimResponses),
    claimResponses: claimResponses.length,
  });

  console.log('\n=== REMITS ===');
  for (const cr of claimResponses.slice(0, Number(process.argv[3] ?? 4))) {
    const matched = cr.request?.reference?.startsWith('Claim/') ?? false;
    const claim = matched ? claims.find((c) => c.id === cr.request?.reference?.replace('Claim/', '')) : undefined;
    const remit = buildEraClaimRemit(cr, claim);
    console.log('\n--- ClaimResponse', cr.id, matched ? '(matched)' : '(unmatched)', '---');
    console.log('patientAccountNumber:', eraPatientAccountNumber([cr], claim, matched));
    console.log({
      eraStatusCode: remit.eraStatusCode,
      payerClaimControlNumber: remit.payerClaimControlNumber,
      allowed: remit.allowed,
      paid: remit.paid,
      patientResp: remit.patientResp,
      patientRespAdjustments: remit.patientRespAdjustments,
      notes: remit.notes,
    });
    console.table(
      remit.serviceLines.map((l) => ({
        seq: l.itemSequence,
        cpt: l.cptCode || '—',
        mods: l.modifiers.join(',') || '—',
        units: l.units ?? '—',
        dos: l.serviceDate || '—',
        billed: l.billed ?? '—',
        allowed: l.allowed ?? '—',
        deduct: l.deductible,
        coins: l.coinsurance,
        copay: l.copay,
        paid: l.paid,
        adjustments: l.adjustments.map((a) => `${a.groupCode}-${a.reasonCode} ${a.amount}`).join(' ') || '—',
        claimLevel: l.isClaimLevel,
      }))
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
