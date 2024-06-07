import { DispositionDTO, DispositionFollowUpType, DispositionType } from 'ehr-utils';

export const mapDispositionTypeToLabel: Record<DispositionType, string> = {
  uc: 'Ottehr UC Transfer',
  'uc-lab': 'Ottehr UC Lab',
  pcp: 'Primary Care Physician',
  ed: 'ED Transfer',
  'uc-oth': 'Non-Ottehr UC Transfer',
};

export const dispositionFieldsPerType: { [key in DispositionType]: string[] } = {
  pcp: ['followUpIn', 'followUpType'],
  uc: ['bookVisit'],
  'uc-lab': ['labService', 'bookVisit', 'followUpType'],
  ed: [],
  'uc-oth': [],
};

export const DEFAULT_DISPOSITION_VALUES: DispositionFormValues = {
  type: 'pcp',
  note: '',
  followUpIn: '',
  labService: null,
  virusTest: null,
  dentistry: false,
  ent: false,
  ophthalmology: false,
  orthopedics: false,
  other: false,
  'lurie-ct': false,
  otherNote: '',
};

export type DispositionFormValues = Pick<DispositionDTO, 'type' | 'note'> & {
  [key in DispositionFollowUpType]: boolean;
} & {
  otherNote: string;
  followUpIn: number | '';
  labService: string | null;
  virusTest: string | null;
};

export const mapFormToDisposition = (values: DispositionFormValues): DispositionDTO => {
  const disposition: DispositionDTO = { type: values.type, note: values.note || 'N/A' };

  const fields = dispositionFieldsPerType[disposition.type];

  if (fields.includes('labService')) {
    disposition.labService = values.labService || undefined;
    disposition.virusTest = values.virusTest || undefined;
  }

  if (fields.includes('followUpIn')) {
    disposition.followUpIn = values.followUpIn === '' ? undefined : values.followUpIn;
  }

  if (fields.includes('followUpType')) {
    disposition.followUp = [];

    dispositionCheckboxOptions.forEach((option) => {
      if (values[option.name]) {
        disposition.followUp!.push({
          type: option.name,
          note: option.name === 'other' ? values.otherNote : undefined,
        });
      }
    });

    if (disposition.followUp.length === 0) {
      delete disposition.followUp;
    }
  }

  return disposition;
};

export const mapDispositionToForm = (disposition: DispositionDTO): DispositionFormValues => {
  const values = DEFAULT_DISPOSITION_VALUES;

  values.type = disposition.type;
  values.note = disposition.note === 'N/A' ? '' : disposition.note;

  const fields = dispositionFieldsPerType[disposition.type];

  if (fields.includes('labService')) {
    values.labService = disposition.labService || null;
    values.virusTest = disposition.virusTest || null;
  }

  if (fields.includes('followUpIn')) {
    values.followUpIn = typeof disposition.followUpIn === 'number' ? disposition.followUpIn : '';
  }

  if (fields.includes('followUpType')) {
    disposition.followUp?.forEach((followUp) => {
      values[followUp.type] = true;
      if (followUp.type === 'other') {
        values.otherNote = followUp.note || '';
      }
    });
  }

  return values;
};

export const followUpInOptions = [
  {
    label: '1 day',
    value: 1,
  },
  {
    label: '2 days',
    value: 2,
  },
  {
    label: '3 days',
    value: 3,
  },
  {
    label: '4 days',
    value: 4,
  },
  {
    label: '5 days',
    value: 5,
  },
  {
    label: '1 week',
    value: 7,
  },
  {
    label: '2 weeks',
    value: 14,
  },
  {
    label: 'as needed',
    value: 0,
  },
];

export const dispositionCheckboxOptions = [
  {
    label: 'Dentistry',
    name: 'dentistry',
  },
  {
    label: 'ENT',
    name: 'ent',
  },
  {
    label: 'Opthalmology',
    name: 'ophthalmology',
  },
  {
    label: 'Orthopedics',
    name: 'orthopedics',
  },
  {
    label: 'Other',
    name: 'other',
  },
  // {
  //   label: 'Lurie CT',
  //   name: 'lurie-ct',
  // },
] as const;

export const labServiceOptions = [
  {
    label: 'COVID PCR',
    note: 'Based on our medical evaluation, you will undergo COVID-19 PCR testing. You will be provided with additional instructions to access your patient portal and view test results during your in-person visit at our office. The Ottehr Telemedicine app is available daily beginning at 8AM to patients from birth through age 26 for all virtual urgent care needs. The Covid PCR test will be scheduled.',
  },
  {
    label: 'COVID Rapid Antigen only',
    note: 'Based on our medical evaluation, you will undergo a COVID-19 Rapid Antigen test. You will be provided with additional instructions to access your patient portal and view test results during your in-person visit at our office. The Ottehr Telemedicine app is available daily beginning at 8AM to patients from birth through age 26 for all virtual urgent care needs. Your Covid Rapid Antigen test will be scheduled.',
  },
  {
    label: 'COVID Rapid Antigen & Reflex PCR',
    note: 'Based on our medical evaluation, you will undergo a COVID-19 Rapid Antigen test. If this rapid test is negative, a more accurate confirmatory “PCR” will be sent to the lab. You will be provided with additional instructions to access your patient portal and view test results during your in-person visit at our office. The Ottehr Telemedicine app is available daily beginning at 8AM to patients from birth through age 26 for all virtual urgent care needs. The Covid Rapid Antigen Test will be scheduled.',
  },
  { label: 'Multiple Tests', note: 'For the following tests, please proceed to Ottehr Care.' },
  {
    label: 'Rapid Strep/Throat Culture',
    note: "Based on our medical evaluation, you will undergo a rapid Strep test. If the rapid test is positive, a provider at Ottehrs will be in contact with you within 2 hours and provide a prescription. If the rapid test is negative, a confirmatory test will be sent to the lab and we will notify you if the results indicate a need for treatment. Confirmatory lab results may take up to 5 days to return. All lab results and instructions from your child's provider can be found in your patient portal.",
  },
  {
    label: 'Rapid Strep/Throat Culture & COVID PCR',
    note: "Based on our medical evaluation, you will undergo a COVID-19 test. Based on our medical evaluation, you will ALSO undergo a rapid Strep test. If the rapid test is positive, a provider at Ottehrs will be in contact with you within 2 hours and provide a prescription. If the rapid test is negative, a confirmatory test will be sent to the lab and we will notify you if the results indicate a need for treatment. Confirmatory lab results may take up to 5 days to return. All lab results and instructions from your child's provider can be found in your patient portal.",
  },
  {
    label: 'UA/UCX',
    note: "Based on our medical evaluation, you will undergo a rapid urine test (urinalysis). Please go to Ottehrs to provide a urine sample. Be sure to drink plenty of fluids prior to coming to the office. The urine sample must be collected on site at Ottehr Care using a sterile urine cup. We are unable to accept urine samples taken at home. If the urinalysis is positive, a provider at Ottehrs will be in contact with you within 2 hours and provide a prescription. If the urinalysis is negative, a confirmatory test (urine culture) will be sent to the lab and we will notify you if the results indicate a need for treatment. Urine culture results may take up to 5 days to return. All lab results and instructions from your child's provider can be found in your patient portal.",
  },
  { label: 'Send out virus test' },
];

export const virusTestsOptions = ['Flu', 'RSV', 'COVID', 'Other'];
