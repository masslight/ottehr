import { toStoredVitalValue } from 'src/features/easy-chart/executor/handlers';
import { ExamLeaf } from 'utils/lib/config-helpers/exam-leaves';
import { NoteTextField } from 'utils/lib/easy-chart/actions';
import { NOTE_FIELD_LABELS } from 'utils/lib/easy-chart/note-fields';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { ExamRecommendation, ScribeRecommendation, ScribeSectionKey } from './types';

/** The comparison form of a name or code: case and surrounding spaces do not make a second item. */
export const normalizeName = (value: string | undefined): string => (value ?? '').trim().toLowerCase();

interface ScribeSectionMeta {
  label: string;
  /** Fits the narrow vertical rail beside the group; the full label lives in the tooltip. */
  shortLabel: string;
  /** Colour-codes the rail so a section can be found without reading. */
  accent: string;
  /** The visit route the section is charted on (ROUTER_PATH in routesInPerson, which imports every page). */
  route: string;
}

// Hues only tell sections apart, and stay clear of the red and green of the R/D findings.
export const SCRIBE_SECTIONS: Record<ScribeSectionKey, ScribeSectionMeta> = {
  template: {
    label: 'Template',
    shortLabel: 'Template',
    accent: '#0F347C',
    route: 'history-of-present-illness-and-templates',
  },
  hpi: { label: 'HPI', shortLabel: 'HPI', accent: '#2169F5', route: 'history-of-present-illness-and-templates' },
  assessment: { label: 'Assessment', shortLabel: 'Assessment', accent: '#7B1FA2', route: 'assessment' },
  ros: { label: 'Review of Systems', shortLabel: 'ROS', accent: '#00897B', route: 'review-of-systems' },
  exam: { label: 'Examination', shortLabel: 'Exam', accent: '#3949AB', route: 'examination' },
  vitals: { label: 'Vitals', shortLabel: 'Vitals', accent: '#546E7A', route: 'vitals' },
  allergies: { label: 'Allergies', shortLabel: 'Allergies', accent: '#EF6C00', route: 'allergies' },
  medications: { label: 'Medications', shortLabel: 'Meds', accent: '#AD1457', route: 'medications' },
  history: { label: 'Medical History', shortLabel: 'History', accent: '#795548', route: 'medical-conditions' },
  plan: { label: 'Plan', shortLabel: 'Plan', accent: '#F57F17', route: 'plan' },
};

/** Display order of the groups in the panel: broad strokes first, then the granular findings. */
export const SCRIBE_SECTION_ORDER: ScribeSectionKey[] = [
  'template',
  'hpi',
  'assessment',
  'ros',
  'exam',
  'vitals',
  'allergies',
  'medications',
  'history',
  'plan',
];

/** `/in-person/<appointmentId>` for the visit currently on screen, or undefined off a visit. */
export const getVisitBasePath = (pathname: string): string | undefined => pathname.match(/.*?in-person\/[^/]+/)?.[0];

export const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

interface RecommendationText {
  primary: string;
  /** A short qualifier on its own line. */
  secondary?: string;
  /** How the AI got here, shown on hover with the evidence. */
  detail?: string;
}

/** The detail line: whatever the kind has to say about itself, then the AI's own note on how it got here. */
const detailOf = (rec: ScribeRecommendation, ...parts: (string | undefined)[]): string | undefined => {
  const all = [...parts, rec.note].filter(Boolean);
  return all.length > 0 ? all.join(' · ') : undefined;
};

/** The note field an `hpi` recommendation targets when it names none. */
export const HPI_FIELD: NoteTextField = 'historyOfPresentIllness';

/** The leaf an exam row will tick: the confident match, or the provider's pick among near-equal ones. */
export const resolvedExamLeaf = (rec: ExamRecommendation): ExamLeaf | undefined => {
  const { resolution } = rec;
  if (resolution.kind === 'confident') return resolution.leaf;
  if (resolution.kind === 'ambiguous') return resolution.chosen;
  return undefined;
};

/** A leaf as the exam tab shows it: the card, then the path to the box. */
export const examLeafLabel = (leaf: ExamLeaf): string => `${leaf.sectionLabel}: ${leaf.label}`;

/** The second line of an exam row: the box it will tick, the choice to make, or where a miss goes. */
export const describeExamResolution = (rec: ExamRecommendation): string => {
  const { resolution } = rec;
  const leaf = resolvedExamLeaf(rec);
  if (leaf) return `→ ${examLeafLabel(leaf)}`;
  if (resolution.kind === 'ambiguous') {
    return `→ ${resolution.leaf.label} · ${resolution.alternatives.length} possible — choose`;
  }
  return resolution.kind === 'none' && resolution.sectionLabel
    ? `No checkbox matched — will be noted in ${resolution.sectionLabel} comments`
    : 'No checkbox matched, and this exam has no comment field to note it in';
};

export const describeRecommendation = (rec: ScribeRecommendation): RecommendationText => {
  switch (rec.kind) {
    case 'template':
      return {
        primary: `Apply template “${rec.templateName}”`,
        detail: detailOf(
          rec,
          'Opens the template preview, where you choose which sections to apply. The items below land on top of it.'
        ),
      };
    case 'hpi': {
      const field = rec.field ?? HPI_FIELD;
      // The group already says "HPI"; any other field names itself.
      return {
        primary: rec.text,
        secondary: field === HPI_FIELD ? undefined : NOTE_FIELD_LABELS[field],
        detail: detailOf(rec),
      };
    }
    case 'ros':
      return { primary: `${rec.systemLabel}: ${rec.label}`, detail: detailOf(rec) };
    case 'exam':
      return { primary: rec.display, secondary: describeExamResolution(rec), detail: detailOf(rec) };
    case 'vital-weight':
      return {
        primary: `Weight ${rec.weightLbs} lbs (${toStoredVitalValue(rec.weightLbs, 'lb')} kg)`,
        detail: detailOf(rec),
      };
    case 'allergy':
      return { primary: rec.name, detail: detailOf(rec) };
    case 'medication': {
      const details = [rec.strength, rec.doseForm].filter(Boolean);
      return {
        primary: rec.name,
        secondary: details.length > 0 ? details.join(' · ') : undefined,
        detail: detailOf(rec),
      };
    }
    case 'diagnosis':
      return {
        primary: `${rec.display} (${rec.code})`,
        detail: detailOf(
          rec,
          rec.transcriptTerm ? `Heard as “${rec.transcriptTerm}”` : undefined,
          rec.isPrimary ? 'Set as primary if no diagnosis is charted yet' : undefined
        ),
      };
    case 'action':
      return { primary: rec.label, secondary: rec.secondary, detail: detailOf(rec) };
  }
};

/** Reading order within a group: reported ROS findings before denials, the primary diagnosis first. */
export const sortForReview = (recommendations: ScribeRecommendation[]): ScribeRecommendation[] => {
  const weight = (rec: ScribeRecommendation): number => {
    if (rec.kind === 'ros') return rec.finding === RosFindingState.Denies ? 1 : 0;
    if (rec.kind === 'diagnosis') return rec.isPrimary ? 0 : 1;
    return 0;
  };
  return [...recommendations].sort((a, b) => weight(a) - weight(b));
};

/** How the Review of Systems screen writes a finding: one letter, R for reports, D for denies. */
export const rosFindingLetter = (finding: RosFindingState): string => (finding === RosFindingState.Reports ? 'R' : 'D');
