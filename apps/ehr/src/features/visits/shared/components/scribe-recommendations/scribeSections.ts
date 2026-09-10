import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { sidebarMenuIcons } from '../sidebarMenuIcons';
import { ScribeRecommendation, ScribeSectionKey } from './types';

interface ScribeSectionMeta {
  label: string;
  iconKey: keyof typeof sidebarMenuIcons;
  /**
   * Visit route the section is charted on. These are the ROUTER_PATH values from
   * routesInPerson; they're repeated here because importing that module pulls in every visit
   * page, which the panel (and its tests) don't need.
   */
  route: string;
}

export const SCRIBE_SECTIONS: Record<ScribeSectionKey, ScribeSectionMeta> = {
  template: { label: 'Template', iconKey: 'History', route: 'history-of-present-illness-and-templates' },
  hpi: { label: 'HPI', iconKey: 'History', route: 'history-of-present-illness-and-templates' },
  ros: { label: 'Review of Systems', iconKey: 'Checklist', route: 'review-of-systems' },
  vitals: { label: 'Vitals', iconKey: 'Vitals', route: 'vitals' },
  allergies: { label: 'Allergies', iconKey: 'Allergies', route: 'allergies' },
  medications: { label: 'Medications', iconKey: 'Medications', route: 'medications' },
  assessment: { label: 'Assessment', iconKey: 'Prescription', route: 'assessment' },
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
  primary: string;
  secondary?: string;
}

export const describeRecommendation = (rec: ScribeRecommendation): RecommendationText => {
  switch (rec.kind) {
    case 'template':
      return {
        primary: `Apply template “${rec.templateName}”`,
        secondary:
          'Fills exam findings, MDM, patient instructions and codes; appends diagnoses. Leaves ROS and orders to the items below.',
      };
    case 'hpi':
      return { primary: rec.text, secondary: 'Added to History of Present Illness' };
    case 'ros':
      return { primary: `${rec.systemLabel}: ${rec.label}` };
    case 'vital-weight':
      return { primary: `Weight ${rec.weightLbs} lbs (${kgFromLbs(rec.weightLbs)} kg)` };
    case 'allergy':
      return { primary: rec.name, secondary: 'Added as a current allergy' };
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
        rec.isPrimary ? 'Primary if none is charted yet' : undefined,
      ];
      return { primary: `${rec.display} (${rec.code})`, secondary: details.filter(Boolean).join(' · ') };
    }
  }
};

export const rosFindingLabel = (finding: RosFindingState): string =>
  finding === RosFindingState.Reports ? 'Reports' : 'Denies';
