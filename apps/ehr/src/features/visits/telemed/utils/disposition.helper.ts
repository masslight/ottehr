import {
  dispositionCheckboxOptions,
  DispositionDTO,
  DispositionFollowUpType,
  DispositionType,
  followUpInOptions,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  PROJECT_NAME,
} from 'utils';

export const dispositionFieldsPerType: { [key in DispositionType]: string[] } = {
  pcp: ['followUpIn', 'followUpType'],
  ip: ['bookVisit'],
  'ip-lab': ['labService', 'bookVisit', 'followUpType'],
  ed: [NOTHING_TO_EAT_OR_DRINK_FIELD],
  'ip-oth': [],
  'pcp-no-type': ['followUpIn'],
  another: ['reason'],
  specialty: ['followUpIn'],
};

export const DEFAULT_DISPOSITION_VALUES: DispositionFormValues = {
  type: 'pcp-no-type',
  note: '',
  followUpIn: '',
  reason: '',
  labService: [],
  virusTest: [],
  dentistry: false,
  ent: false,
  ophthalmology: false,
  orthopedics: false,
  other: false,
  'lurie-ct': false,
  otherNote: '',
  [NOTHING_TO_EAT_OR_DRINK_FIELD]: false,
};

export type DispositionFormValues = Pick<DispositionDTO, 'type' | 'note' | typeof NOTHING_TO_EAT_OR_DRINK_FIELD> & {
  [key in DispositionFollowUpType]: boolean;
} & {
  otherNote: string;
  followUpIn: number | '';
  labService: string[];
  virusTest: string[];
  reason: string;
};

export const mapFormToDisposition = (values: DispositionFormValues): DispositionDTO => {
  const disposition: DispositionDTO = { type: values.type, note: values.note || 'N/A' };

  const fields = dispositionFieldsPerType[disposition.type];

  if (fields.includes('labService')) {
    disposition.labService = values.labService || [];
    disposition.virusTest = values.virusTest || [];
  }

  if (fields.includes('followUpIn')) {
    disposition.followUpIn = values.followUpIn === '' ? undefined : values.followUpIn;
  }

  if (fields.includes('reason')) {
    disposition.reason = values.reason === '' ? undefined : values.reason;
  }

  if (fields.includes('followUpType')) {
    disposition.followUp = [];

    dispositionCheckboxOptions.forEach((option) => {
      const isOtherOption = option.name === 'other';
      const otherOptionValue = option.name === 'other' ? values.otherNote?.trim?.() : undefined;
      const isOtherOptionWithValue = isOtherOption && otherOptionValue;

      if ((!isOtherOption && values[option.name]) || isOtherOptionWithValue) {
        disposition.followUp!.push({
          type: option.name,
          note: option.name === 'other' ? otherOptionValue : undefined,
        });
      }
    });

    if (disposition.followUp.length === 0) {
      delete disposition.followUp;
    }
  }

  if (fields.includes(NOTHING_TO_EAT_OR_DRINK_FIELD)) {
    disposition[NOTHING_TO_EAT_OR_DRINK_FIELD] = values[NOTHING_TO_EAT_OR_DRINK_FIELD];
  }

  return disposition;
};

export const mapDispositionToForm = (disposition: DispositionDTO): DispositionFormValues => {
  const values = { ...DEFAULT_DISPOSITION_VALUES };

  values.type = disposition.type;
  values.note = disposition.note === 'N/A' ? '' : disposition.note;

  const fields = dispositionFieldsPerType[disposition.type];

  if (fields.includes('labService')) {
    values.labService = disposition.labService || [];
    values.virusTest = disposition.virusTest || [];
  }

  if (fields.includes('followUpIn')) {
    values.followUpIn = typeof disposition.followUpIn === 'number' ? disposition.followUpIn : '';
  }

  if (fields.includes('reason')) {
    values.reason = disposition.reason || '';
  }

  if (fields.includes('followUpType')) {
    disposition.followUp?.forEach((followUp) => {
      values[followUp.type] = true;
      if (followUp.type === 'other') {
        values.otherNote = followUp.note || '';
      }
    });
  }

  if (fields.includes(NOTHING_TO_EAT_OR_DRINK_FIELD)) {
    values[NOTHING_TO_EAT_OR_DRINK_FIELD] = disposition[NOTHING_TO_EAT_OR_DRINK_FIELD];
  }

  return values;
};

export { followUpInOptions };

export const SEND_OUT_VIRUS_TEST_LABEL = 'Send out virus test';

export const labServiceOptions = [
  {
    label: 'COVID PCR',
    note: `Based on our medical evaluation, you will undergo COVID-19 PCR testing. You will be provided with additional instructions to access your patient portal and view test results during your in-person visit at our office. The ${PROJECT_NAME} Telemedicine app is available daily beginning at 8AM to patients from birth through age 26 for all virtual urgent care needs. The Covid PCR test will be scheduled.`,
  },
  {
    label: 'COVID Rapid Antigen only',
    note: `Based on our medical evaluation, you will undergo a COVID-19 Rapid Antigen test. You will be provided with additional instructions to access your patient portal and view test results during your in-person visit at our office. The ${PROJECT_NAME} Telemedicine app is available daily beginning at 8AM to patients from birth through age 26 for all virtual urgent care needs. Your Covid Rapid Antigen test will be scheduled.`,
  },
  {
    label: 'COVID Rapid Antigen & Reflex PCR',
    note: `Based on our medical evaluation, you will undergo a COVID-19 Rapid Antigen test. If this rapid test is negative, a more accurate confirmatory “PCR” will be sent to the lab. You will be provided with additional instructions to access your patient portal and view test results during your in-person visit at our office. The ${PROJECT_NAME} Telemedicine app is available daily beginning at 8AM to patients from birth through age 26 for all virtual urgent care needs. The Covid Rapid Antigen Test will be scheduled.`,
  },
  { label: 'Multiple Tests', note: `For the following tests, please proceed to ${PROJECT_NAME}.` },
  {
    label: 'Rapid Strep/Throat Culture',
    note: `Based on our medical evaluation, you will undergo a rapid Strep test. If the rapid test is positive, a provider at ${PROJECT_NAME} will be in contact with you within 2 hours and provide a prescription. If the rapid test is negative, a confirmatory test will be sent to the lab and we will notify you if the results indicate a need for treatment. Confirmatory lab results may take up to 5 days to return. All lab results and instructions from your child's provider can be found in your patient portal.`,
  },
  {
    label: 'Rapid Strep/Throat Culture & COVID PCR',
    note: `Based on our medical evaluation, you will undergo a COVID-19 test. Based on our medical evaluation, you will ALSO undergo a rapid Strep test. If the rapid test is positive, a provider at ${PROJECT_NAME} will be in contact with you within 2 hours and provide a prescription. If the rapid test is negative, a confirmatory test will be sent to the lab and we will notify you if the results indicate a need for treatment. Confirmatory lab results may take up to 5 days to return. All lab results and instructions from your child's provider can be found in your patient portal.`,
  },
  {
    label: 'UA/UCX',
    note: `Based on our medical evaluation, you will undergo a rapid urine test (urinalysis). Please go to ${PROJECT_NAME} to provide a urine sample. Be sure to drink plenty of fluids prior to coming to the office. The urine sample must be collected on site at ${PROJECT_NAME} using a sterile urine cup. We are unable to accept urine samples taken at home. If the urinalysis is positive, a provider at ${PROJECT_NAME} will be in contact with you within 2 hours and provide a prescription. If the urinalysis is negative, a confirmatory test (urine culture) will be sent to the lab and we will notify you if the results indicate a need for treatment. Urine culture results may take up to 5 days to return. All lab results and instructions from your child's provider can be found in your patient portal.`,
  },
  { label: SEND_OUT_VIRUS_TEST_LABEL },
];

export const virusTestsOptions = ['Flu', 'RSV', 'COVID', 'Other'];

export const reasonsForTransferOptions = ['Equipment availability', 'Procedure or advanced care', 'Xray'];
