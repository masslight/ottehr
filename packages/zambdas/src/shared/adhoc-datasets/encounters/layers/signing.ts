import { Practitioner, Provenance } from 'fhir/r4b';
import {
  extractExtensionValue,
  findExtensionIndex,
  getProviderNameWithProfession,
  isAppointmentLocked,
  isEncounterLocked,
} from 'utils/lib/fhir/helpers';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { fetchScopedResources } from '../../../adhoc-report';
import { resolveEncounterSignatures } from '../../../pdf/get-encounter-signatures';
import { defineEncounterLayer } from '../context';
import { lastSignedAt, minutesBetween, SIGNED_VISIT_STATUSES, stripEnc } from '../helpers';

// Who signed the visit and when, supervisor approval, the lock.
export const signingLayer = defineEncounterLayer<{
  signatureProvenancesByEncounterId: Map<string, Provenance[]>;
  signerById: Map<string, Practitioner>;
}>({
  id: 'signing',
  fetch: async (ctx) => {
    // The author (provider signed) and verifier (supervisor approved) Provenances getEncounterSignatures reads.
    const provenancesAndAgents = await fetchScopedResources<Provenance | Practitioner>(
      ctx.oystehr,
      'Provenance',
      'target',
      ctx.encRefs,
      [
        { name: 'agent-role', value: 'author,verifier' },
        { name: '_include', value: 'Provenance:agent' },
      ]
    );
    const signatureProvenancesByEncounterId = new Map<string, Provenance[]>();
    const signerById = new Map<string, Practitioner>();

    for (const r of provenancesAndAgents) {
      if (r.resourceType === 'Practitioner') {
        if (r.id) signerById.set(r.id, r);
        continue;
      }
      for (const target of r.target ?? []) {
        const encId = target.reference?.startsWith('Encounter/') ? stripEnc(target.reference) : undefined;
        if (encId)
          signatureProvenancesByEncounterId.set(encId, [...(signatureProvenancesByEncounterId.get(encId) ?? []), r]);
      }
    }
    return { signatureProvenancesByEncounterId, signerById };
  },
  map: (input, out) => {
    const { encounter, appointment, attendingPractitioner, isFollowUpRow, visitStatus, statusHistory } = input;
    const { signatureProvenancesByEncounterId, signerById } = out;
    const row: Partial<AdHocEncounterRow> = {};
    const signatures = resolveEncounterSignatures(
      encounter.id ? signatureProvenancesByEncounterId.get(encounter.id) ?? [] : [],
      signerById
    );

    const signed = SIGNED_VISIT_STATUSES.includes(visitStatus);
    const signedAt = signed ? signatures.signedBy?.dateTimeISO ?? lastSignedAt(statusHistory) : null;

    // The visit note prints the author Provenance's signer and falls back to the provider of the visit —
    // written the same way the Provenance signer is, so one provider is one value.
    const fallbackSigner = attendingPractitioner ? getProviderNameWithProfession(attendingPractitioner) || null : null;

    const dischargedAt = statusHistory.filter((entry) => entry.status === 'discharged').at(-1)?.period.start;
    const awaitingIndex = findExtensionIndex(encounter.extension ?? [], 'awaiting-supervisor-approval');
    row.signed = signed;
    row.signedAt = signedAt;
    row.signedBy = signed ? signatures.signedBy?.name || fallbackSigner : null;
    row.dischargedToSignedMinutes = signedAt ? minutesBetween(dischargedAt, signedAt) : null;
    row.awaitingSupervisorApproval =
      awaitingIndex >= 0 && extractExtensionValue(encounter.extension?.[awaitingIndex]) === true;
    row.supervisorApprovedBy = signatures.approvedBy?.name || null;
    row.supervisorApprovedAt = signatures.approvedBy?.dateTimeISO ?? null;

    // Follow-up encounters have no Appointment of their own, so their lock lives on the Encounter.
    row.locked = isFollowUpRow ? isEncounterLocked(encounter) : isAppointmentLocked(appointment);
    return row;
  },
});
