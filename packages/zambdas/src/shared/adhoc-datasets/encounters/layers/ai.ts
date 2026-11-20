import { DocumentReference } from 'fhir/r4b';
import { DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO, DOCUMENT_REFERENCE_SUMMARY_FROM_CHAT } from 'utils/lib/fhir/constants';
import { defineEncounterLayer } from '../context';

// Which AI summaries the visit has, from the visit's DocumentReferences.
export const aiLayer = defineEncounterLayer<Map<string, DocumentReference[]>>({
  id: 'ai',
  fetch: (ctx) => ctx.shared.docRefs(),
  map: ({ encounter }, docRefsByEncounterId) => {
    const descriptions = (encounter.id ? docRefsByEncounterId.get(encounter.id) ?? [] : []).map((d) => d.description);
    const hasAudio = descriptions.includes(DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO);
    const hasChat = descriptions.includes(DOCUMENT_REFERENCE_SUMMARY_FROM_CHAT);

    return {
      aiType:
        hasAudio && hasChat
          ? 'ambient scribe & patient HPI chatbot'
          : hasAudio
          ? 'ambient scribe'
          : hasChat
          ? 'patient HPI chatbot'
          : '',
    };
  },
});
