import { createCodingCode } from '../../api';
import { ExamItemConfig } from './exam-config.types';

export const InPersonExamConfig: ExamItemConfig = {
  general: {
    label: 'General',
    components: {
      normal: {
        'well-appearing': {
          label: 'Well appearing',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'well-nourished': {
          label: 'Well nourished',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'in-no-distress': {
          label: 'In no distress',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('69328002', 'Distress (finding)'),
        },
        'oriented-general': {
          label: 'Oriented x 3',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'general-normal-mood-and-affect': {
          label: 'Normal mood and affect',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('134417007', 'Level of mood - normal (finding)'),
        },
        'ambulating-without-difficulty': {
          label: 'Ambulating without difficulty',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-general': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'general-comment': {
          label: 'General comment',
          type: 'text',
          code: createCodingCode('38266002', 'Entire body as a whole (body structure)'),
        },
      },
    },
  },
  skin: {
    label: 'Skin',
    components: {
      normal: {
        'good-turgor': {
          label: 'Good turgor',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'no-rash-unusual-bruising-or-prominent-lesions': {
          label: 'No rash, unusual bruising or prominent lesions',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('225544001', 'Skin appearance normal (finding)'),
          bodySite: createCodingCode('225544001', 'Skin appearance normal (finding)'),
        },
      },
      abnormal: {
        'abnormal-skin': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'skin-comment': {
          label: 'Skin comment',
          type: 'text',
          code: createCodingCode('106076001', 'Skin finding (finding)'),
        },
      },
    },
  },
  hair: {
    label: 'Hair',
    components: {
      normal: {
        'normal-texture-and-distribution': {
          label: 'Normal texture and distribution',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-hair': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'hair-comment': {
          label: 'Hair comment',
          type: 'text',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
    },
  },
  nails: {
    label: 'Nails',
    components: {
      normal: {
        'normal-color-no-deformities': {
          label: 'Normal color, no deformities',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-nails': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'nails-comment': {
          label: 'Nails comment',
          type: 'text',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
    },
  },
  head: {
    label: 'Head',
    components: {
      normal: {
        normocephalic: {
          label: 'Normocephalic',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('17621005', 'Normal (qualifier value)'),
          bodySite: createCodingCode('17621005', 'Normal (qualifier value)'),
        },
        atraumatic: {
          label: 'Atraumatic',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('1149217004', 'No traumatic injury (situation)'),
          bodySite: createCodingCode('1149217004', 'No traumatic injury (situation)'),
        },
        'no-visible-or-palpable-masses-depressions-or-scaring': {
          label: 'No visible or palpable masses, depressions, or scaring',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-head': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'head-comment': {
          label: 'Head comment',
          type: 'text',
          code: createCodingCode('298364001', 'Finding of head region (finding)'),
        },
      },
    },
  },
  eyes: {
    label: 'Eyes',
    components: {
      normal: {
        'visual-acuity-intact': {
          label: 'Visual acuity intact',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'conjunctiva-clear': {
          label: 'Conjunctiva clear',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'sclera-non-icteric': {
          label: 'Sclera non-icteric',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'eom-intact': {
          label: 'EOM intact',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        perrl: {
          label: 'PERRL',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'fundi-have-normal-optic-discs-and-vessels': {
          label: 'Fundi have normal optic discs and vessels',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'no-exudates-or-hemorrhages': {
          label: 'No exudates or hemorrhages',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-eyes': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'eyes-comment': {
          label: 'Eyes comment',
          type: 'text',
          code: createCodingCode('118235002', 'Eye / vision finding (finding)'),
        },
      },
    },
  },
  ears: {
    label: 'Ears',
    components: {
      normal: {
        'eacs-clear': {
          label: 'EACs clear',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'tms-translucent-mobile': {
          label: 'TMs translucent & mobile',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'ossicles-nl-appearance': {
          label: 'Ossicles nl appearance',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'hearing-intact': {
          label: 'Hearing intact',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-ears': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'ears-comment': {
          label: 'Ears comment',
          type: 'text',
          code: createCodingCode('247234006', 'Ear finding (finding)'),
        },
      },
    },
  },
  nose: {
    label: 'Nose',
    components: {
      normal: {
        'no-external-lesions': {
          label: 'No external lesions',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'nose-mucosa-non-inflamed': {
          label: 'Mucosa non-inflamed',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'septum-and-turbinates-normal': {
          label: 'Septum and turbinates normal',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-nose': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'nose-comment': {
          label: 'Nose comment',
          type: 'text',
          code: createCodingCode('118237005', 'Nose finding (finding)'),
        },
      },
    },
  },
  mouth: {
    label: 'Mouth',
    components: {
      normal: {
        'mucous-membranes-moist': {
          label: 'Mucous membranes moist',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('276398005', 'Moist oral mucosa (finding)'),
          bodySite: createCodingCode('276398005', 'Moist oral mucosa (finding)'),
        },
        'no-mucosal-lesions': {
          label: 'No mucosal lesions',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-mouth': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'mouth-comment': {
          label: 'Mouth comment',
          type: 'text',
          code: createCodingCode('423066003', 'Finding of mouth region (finding)'),
        },
      },
    },
  },
  teeth: {
    label: 'Teeth',
    components: {
      normal: {
        'no-obvious-caries-or-periodontal-disease': {
          label: 'No obvious caries or periodontal disease',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'no-gingival-inflammation-or-significant-resorption': {
          label: 'No gingival inflammation or significant resorption',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-teeth': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'teeth-comment': {
          label: 'Teeth comment',
          type: 'text',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
    },
  },
  pharynx: {
    label: 'Pharynx',
    components: {
      normal: {
        'pharynx-mucosa-non-inflamed': {
          label: 'Mucosa non-inflamed',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'no-tonsillar-hypertrophy-or-exudate': {
          label: 'No tonsillar hypertrophy or exudate',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-pharynx': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'pharynx-comment': {
          label: 'Pharynx comment',
          type: 'text',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
    },
  },
  neck: {
    label: 'Neck',
    components: {
      normal: {
        supple: {
          label: 'Supple',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('48162006', 'Supple (qualifier value)'),
          bodySite: createCodingCode('48162006', 'Supple (qualifier value)'),
        },
        'without-lesions-bruits-or-adenopathy': {
          label: 'Without lesions, bruits, or adenopathy',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'thyroid-non-enlarged-and-non-tender': {
          label: 'Thyroid non-enlarged and non-tender',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-neck': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'neck-comment': {
          label: 'Neck comment',
          type: 'text',
          code: createCodingCode('298378000', 'Finding of neck region (finding)'),
        },
      },
    },
  },
  heart: {
    label: 'Heart',
    components: {
      normal: {
        'no-cardiomegaly-or-thrills': {
          label: 'No cardiomegaly or thrills',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'regular-rate-and-rhythm': {
          label: 'Regular rate and rhythm',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'no-murmur-or-gallop': {
          label: 'No murmur or gallop',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-heart': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'heart-comment': {
          label: 'Heart comment',
          type: 'text',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
    },
  },
  lungs: {
    label: 'Lungs',
    components: {
      normal: {
        'clear-to-auscultation-and-percussion': {
          label: 'Clear to auscultation and percussion',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'pulmonary-effort-is-normal': {
          label: 'Pulmonary effort is normal',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'no-respiratory-distress': {
          label: 'No respiratory distress',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'there-are-no-wheezing': {
          label: 'There are no wheezing',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'there-are-no-rales': {
          label: 'There are no rales',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-lungs': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'lungs-comment': {
          label: 'Lungs comment',
          type: 'text',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
    },
  },
  abdomen: {
    label: 'Abdomen',
    components: {
      normal: {
        'no-bloating': {
          label: 'No bloating',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'bowel-sounds-normal': {
          label: 'Bowel sounds normal',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'no-tenderness-organomegaly-masses-or-hernia': {
          label: 'No tenderness, organomegaly, masses, or hernia',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('297125009', 'Abdominal tenderness absent (situation)'),
          bodySite: createCodingCode('297125009', 'Abdominal tenderness absent (situation)'),
        },
      },
      abnormal: {
        'abnormal-abdomen': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'abdomen-comment': {
          label: 'Abdomen comment',
          type: 'text',
          code: createCodingCode('609624008', 'Finding of abdomen (finding)'),
        },
      },
    },
  },
  back: {
    label: 'Back',
    components: {
      normal: {
        'spine-normal-without-deformity-or-tenderness': {
          label: 'Spine normal without deformity or tenderness',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'no-cva-tenderness': {
          label: 'No CVA tenderness',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-back': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'back-comment': {
          label: 'Back comment',
          type: 'text',
          code: createCodingCode('414252009', 'Finding of back (finding)'),
        },
      },
    },
  },
  rectal: {
    label: 'Rectal',
    components: {
      normal: {
        'normal-sphincter-tone': {
          label: 'Normal sphincter tone',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'no-hemorrhoids-or-masses-palpable': {
          label: 'No hemorrhoids or masses palpable',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-rectal': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'rectal-comment': {
          label: 'Rectal comment',
          type: 'text',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
    },
  },
  extremities: {
    label: 'Extremities',
    components: {
      normal: {
        'no-amputations-or-deformities-cyanosis-edema-or-varicosities': {
          label: 'No amputations or deformities, cyanosis, edema or varicosities',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'peripheral-pulses-intact': {
          label: 'Peripheral pulses intact',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-extremities': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'extremities-comment': {
          label: 'Extremities comment',
          type: 'text',
          code: createCodingCode('106028002', 'Musculoskeletal finding (finding)'),
        },
      },
    },
  },
  musculoskeletal: {
    label: 'Musculoskeletal',
    components: {
      normal: {
        'normal-gait-and-station': {
          label: 'Normal gait and station',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('8117002', 'Gait normal (finding)'),
          bodySite: createCodingCode('8117002', 'Gait normal (finding)'),
        },
        'no-misalignment': {
          label:
            'No misalignment, asymmetry, crepitation, defects, tenderness, masses, effusions, decreased range of motion, instability, atrophy or abnormal strength or tone in the head, neck, spine, ribs, pelvis or extremities.',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-musculoskeletal': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'musculoskeletal-comment': {
          label: 'Musculoskeletal comment',
          type: 'text',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
    },
  },
  neurologic: {
    label: 'Neurologic',
    components: {
      normal: {
        'mental-status:-the-patient-is-alert': {
          label: 'Mental Status: The patient is alert',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('17326005', 'Well in self (finding)'),
        },
        'cn-2-12-normal': {
          label: 'CN 2-12 normal',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'sensation-to-pain-touch-and-proprioception-normal': {
          label: 'Sensation to pain, touch, and proprioception normal',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'dtrs-normal-in-upper-and-lower-extremities': {
          label: 'DTRs normal in upper and lower extremities',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'no-pathologic-reflexes': {
          label: 'No pathologic reflexes',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      abnormal: {
        'abnormal-neurologic': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'neurologic-comment': {
          label: 'Neurologic comment',
          type: 'text',
          code: createCodingCode('102957003', 'Neurological finding (finding)'),
        },
      },
    },
  },
  psychiatric: {
    label: 'Psychiatric',
    components: {
      normal: {
        'oriented-psychiatric': {
          label: 'Oriented X3',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'intact-recent-and-remote-memory-judgment-and-insight': {
          label: 'Intact recent and remote memory, judgment and insight',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
        'psychiatric-normal-mood-and-affect': {
          label: 'Normal mood and affect',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('134417007', 'Level of mood - normal (finding)'),
        },
      },
      abnormal: {
        'abnormal-psychiatric': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('000000001', 'Dummy SNOMED code'),
        },
      },
      comment: {
        'psychiatric-comment': {
          label: 'Psychiatric comment',
          type: 'text',
          code: createCodingCode('116367006', 'Psychological finding (finding)'),
        },
      },
    },
  },
};
