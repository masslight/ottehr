export const TASK_PROGRESS_NOTE_SECTIONS = {
  'cc-and-intake-notes': 'Chief Complaint',
  'screening-questions': 'Screening Questions',
  questionnaires: 'Clinical Forms',
  vitals: 'Vitals',
  allergies: 'Allergies',
  medications: 'Medications',
  'medical-conditions': 'Medical Conditions',
  'surgical-history': 'Surgical History',
  hospitalization: 'Hospitalization',
  'history-of-present-illness-and-templates': 'HPI/MOI & Templates',
  'review-of-systems': 'Review of Systems',
  examination: 'Exam',
  assessment: 'Assessment',
  plan: 'Plan',
  erx: 'eRX',
  documents: 'Documents',
  'review-and-sign': 'Review & Sign',
} as const;

export type TaskProgressNoteSection = keyof typeof TASK_PROGRESS_NOTE_SECTIONS;

export const TASK_PROGRESS_NOTE_SECTION_KEYS = Object.keys(TASK_PROGRESS_NOTE_SECTIONS) as [
  TaskProgressNoteSection,
  ...TaskProgressNoteSection[],
];

export const isTaskProgressNoteSection = (value: string | undefined): value is TaskProgressNoteSection =>
  !!value && Object.prototype.hasOwnProperty.call(TASK_PROGRESS_NOTE_SECTIONS, value);
