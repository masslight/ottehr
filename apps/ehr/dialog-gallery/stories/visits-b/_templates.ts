import type { FetchMock } from '../../harness/story';

export const templateListMock: FetchMock = {
  url: 'list-templates',
  response: {
    status: 200,
    output: {
      templates: [
        { id: 'tmpl-1', title: 'Strep Pharyngitis', versionData: { isCurrentVersion: true } },
        { id: 'tmpl-2', title: 'Ankle Sprain', versionData: { isCurrentVersion: true } },
        { id: 'tmpl-3', title: 'Otitis Media', versionData: { isCurrentVersion: true } },
      ],
    },
  },
};

export const templateDetailMock: FetchMock = {
  url: 'admin-get-template-detail',
  response: {
    status: 200,
    output: {
      templateName: 'Strep Pharyngitis',
      templateId: 'tmpl-1',
      examVersion: 'v1',
      isCurrentVersion: true,
      sections: {
        hpiNote: 'Patient presents with sore throat and fever. Denies cough, rhinorrhea, or rash.',
        moiNote: null,
        rosNote: null,
        rosFindings: [
          { fieldName: 'ros-fever', label: 'Fever', findingState: 'reports', stale: false },
          { fieldName: 'ros-sore-throat', label: 'Sore throat', findingState: 'reports', stale: false },
          { fieldName: 'ros-cough', label: 'Cough', findingState: 'denies', stale: false },
        ],
        rosComments: [],
        examFindings: [
          { fieldName: 'oropharynx-erythema', label: 'Erythema of oropharynx', isAbnormal: true, note: '' },
          { fieldName: 'tonsillar-exudate', label: 'Tonsillar exudate', isAbnormal: true, note: '' },
          { fieldName: 'lungs-clear', label: 'Lungs clear to auscultation', isAbnormal: false, note: '' },
        ],
        mdm: 'Rapid strep positive. Treat with amoxicillin for 10 days. Supportive care discussed.',
        diagnoses: [{ code: 'J02.0', display: 'Streptococcal pharyngitis' }],
        patientInstructions: [
          {
            title: 'Strep throat',
            text: 'Finish the full course of antibiotics. Return to school after 24 hours of treatment.',
          },
        ],
        cptCodes: [{ code: '87880', display: 'Strep A assay w/optic', modifiers: [] }],
        emCode: { code: '99213', display: 'Office or other outpatient visit, established patient' },
        accident: null,
        inHouseLabs: [],
        externalLabs: [],
        procedures: [],
        inHouseMedications: [],
      },
    },
  },
};
