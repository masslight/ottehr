import { DocumentReference, QuestionnaireResponse } from 'fhir/r4b';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { INSURANCE_CARD_CODE, PHOTO_ID_CARD_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { fetchScopedResources } from '../../../adhoc-report';
import { getPaperworkCompleteness } from '../../../paperwork-completeness';
import { defineEncounterLayer } from '../context';
import { paperworkAnswer } from '../helpers';

// Paperwork completeness of the visit, as the tracking board reads it, and the consent signer.
export const paperworkLayer = defineEncounterLayer<{
  paperworkQrByEncounterId: Map<string, QuestionnaireResponse>;
  identityDocRefsByPatient: Map<string, DocumentReference[]>;
}>({
  id: 'paperwork',
  fetch: async (ctx) => {
    // The tracking board's other paperwork input: the patient's current Photo ID / insurance card DocumentReferences.
    const [paperworkQrByEncounterId, docRefs] = await Promise.all([
      ctx.shared.paperwork(),
      ctx.rootLookups().then(() =>
        fetchScopedResources<DocumentReference>(
          ctx.oystehr,
          'DocumentReference',
          'related',
          ctx.encRefs.length ? Array.from(ctx.root.patientMap.keys()) : [],
          [
            { name: 'status', value: 'current' },
            { name: 'type', value: `${INSURANCE_CARD_CODE},${PHOTO_ID_CARD_CODE}` },
          ]
        )
      ),
    ]);

    const identityDocRefsByPatient = new Map<string, DocumentReference[]>();

    for (const docRef of docRefs) {
      for (const related of docRef.context?.related ?? []) {
        const ref = related.reference;

        if (ref?.startsWith('Patient/'))
          identityDocRefsByPatient.set(ref, [...(identityDocRefsByPatient.get(ref) ?? []), docRef]);
      }
    }

    return { paperworkQrByEncounterId, identityDocRefsByPatient };
  },
  map: (input, out) => {
    const { encounter, patient } = input;
    const { paperworkQrByEncounterId, identityDocRefsByPatient } = out;
    const row: Partial<AdHocEncounterRow> = {};
    const questionnaireResponse = encounter.id ? paperworkQrByEncounterId.get(encounter.id) : undefined;

    const paperwork = getPaperworkCompleteness({
      patient,
      encounter,
      questionnaireResponse,
      docRefs: patient?.id ? identityDocRefsByPatient.get(`Patient/${patient.id}`) ?? [] : [],
    });

    row.paperworkSubmittedAt = questionnaireResponse?.authored ?? null;
    row.demographicsComplete = paperwork.demographics;
    row.photoIdOnFile = paperwork.photoID;
    row.insuranceCardOnFile = paperwork.insuranceCard;
    row.consentComplete = paperwork.consent;

    row.consentMethod = paperwork.consentByPaperworkSignatures
      ? 'paperwork'
      : paperwork.consentByStaffAttestation
      ? 'staff attestation'
      : null;

    // The consent signer as the visit details face sheet prints it (composeConsentFormsData's full name /
    // relationship answers), only when the forms were signed in the paperwork.
    row.consentSignerName = paperwork.consentByPaperworkSignatures
      ? paperworkAnswer(questionnaireResponse, 'full-name')
      : '';

    row.consentSignerRelationship = paperwork.consentByPaperworkSignatures
      ? paperworkAnswer(questionnaireResponse, 'consent-form-signer-relationship')
      : '';
    return row;
  },
});
