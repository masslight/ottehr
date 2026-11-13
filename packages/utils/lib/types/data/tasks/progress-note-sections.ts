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
  'follow-up-note': 'Follow-up Note',
} as const;

export type TaskProgressNoteSection = keyof typeof TASK_PROGRESS_NOTE_SECTIONS;

export const TASK_PROGRESS_NOTE_SECTION_KEYS = Object.keys(TASK_PROGRESS_NOTE_SECTIONS) as [
  TaskProgressNoteSection,
  ...TaskProgressNoteSection[],
];

export const TASK_MAIN_PROGRESS_NOTE_SECTIONS: TaskProgressNoteSection[] = [
  'cc-and-intake-notes',
  'screening-questions',
  'questionnaires',
  'vitals',
  'allergies',
  'medications',
  'medical-conditions',
  'surgical-history',
  'hospitalization',
  'history-of-present-illness-and-templates',
  'review-of-systems',
  'examination',
  'assessment',
  'plan',
  'erx',
  'documents',
  'review-and-sign',
];

export const TASK_FOLLOW_UP_PROGRESS_NOTE_SECTIONS: TaskProgressNoteSection[] = [
  'follow-up-note',
  'allergies',
  'medications',
  'medical-conditions',
  'surgical-history',
  'hospitalization',
  'plan',
  'erx',
  'documents',
];

export const isTaskProgressNoteSection = (value: string | undefined): value is TaskProgressNoteSection =>
  !!value && Object.prototype.hasOwnProperty.call(TASK_PROGRESS_NOTE_SECTIONS, value);
