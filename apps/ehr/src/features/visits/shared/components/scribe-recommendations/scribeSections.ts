import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { ScribeRecommendation, ScribeSectionKey } from './types';

interface ScribeSectionMeta {
  label: string;
  /** Fits the narrow vertical rail beside the group; the full label lives in the tooltip. */
  shortLabel: string;
  /** Colour-codes the rail so a section can be found without reading. */
  accent: string;
  /**
   * Visit route the section is charted on. These are the ROUTER_PATH values from
   * routesInPerson; they're repeated here because importing that module pulls in every visit
   * page, which the panel (and its tests) don't need.
   */
  route: string;
}

// Distinguishable hues rather than a semantic scale: they say "different section", nothing more.
// Kept clear of the red/green the Reports and Denies chips use on the other side of the row.
export const SCRIBE_SECTIONS: Record<ScribeSectionKey, ScribeSectionMeta> = {
  template: {
    label: 'Template',
    shortLabel: 'Template',
    accent: '#0F347C',
    route: 'history-of-present-illness-and-templates',
  },
  hpi: { label: 'HPI', shortLabel: 'HPI', accent: '#2169F5', route: 'history-of-present-illness-and-templates' },
  ros: { label: 'Review of Systems', shortLabel: 'ROS', accent: '#00897B', route: 'review-of-systems' },
  vitals: { label: 'Vitals', shortLabel: 'Vitals', accent: '#546E7A', route: 'vitals' },
  allergies: { label: 'Allergies', shortLabel: 'Allergies', accent: '#EF6C00', route: 'allergies' },
  medications: { label: 'Medications', shortLabel: 'Meds', accent: '#AD1457', route: 'medications' },
  assessment: { label: 'Assessment', shortLabel: 'Assessment', accent: '#7B1FA2', route: 'assessment' },
};

/** Display order of the groups in the panel: broad strokes first, then the granular findings. */
export const SCRIBE_SECTION_ORDER: ScribeSectionKey[] = [
  'template',
  'hpi',
  'assessment',
  'ros',
  'vitals',
  'allergies',
  'medications',
];

export const IN_HOUSE_MEDICATION_ORDER_ROUTE = 'in-house-medication/order/new';

/** `/in-person/<appointmentId>` for the visit currently on screen, or undefined off a visit. */
export const getVisitBasePath = (pathname: string): string | undefined => pathname.match(/.*?in-person\/[^/]+/)?.[0];

export const kgFromLbs = (lbs: number): number => Math.round((lbs / 2.20462) * 100) / 100;

export interface RecommendationText {
  /** The recommendation itself, always on screen. */
  primary: string;
  /** A short clinical qualifier that earns a permanent line of its own. */
  secondary?: string;
  /**
   * How the AI got here — kept out of the row and revealed on demand, alongside the transcript
   * quote, so a list of twenty recommendations stays scannable.
   */
  detail?: string;
}

export const describeRecommendation = (rec: ScribeRecommendation): RecommendationText => {
  switch (rec.kind) {
    case 'template':
      return {
        primary: `Apply template “${rec.templateName}”`,
        detail:
          'Fills exam findings, MDM, patient instructions and codes; appends diagnoses. Leaves ROS and orders to the items below.',
      };
    case 'hpi':
      return { primary: rec.text };
    case 'ros':
      return { primary: `${rec.systemLabel}: ${rec.label}` };
    case 'vital-weight':
      return { primary: `Weight ${rec.weightLbs} lbs (${kgFromLbs(rec.weightLbs)} kg)` };
    case 'allergy':
      return { primary: rec.name };
    case 'medication': {
      const details = [
        rec.type === 'as-needed' ? 'As needed' : 'Scheduled',
        rec.patientCouldNotConfirmDosage ? 'Dose not confirmed' : undefined,
      ].filter(Boolean);
      return { primary: rec.name, secondary: details.join(' · ') };
    }
    case 'diagnosis': {
      const details = [
        `Heard as “${rec.transcriptTerm}”`,
        rec.isPrimary ? 'Set as primary if no diagnosis is charted yet' : undefined,
      ].filter(Boolean);
      return { primary: `${rec.display} (${rec.code})`, detail: details.join(' · ') };
    }
  }
};

export const rosFindingLabel = (finding: RosFindingState): string =>
  finding === RosFindingState.Reports ? 'Reports' : 'Denies';
