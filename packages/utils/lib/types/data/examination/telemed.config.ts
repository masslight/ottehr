import { createCodingCode } from '../../api';
import { ExamItemConfig } from './exam-config.types';

export const TelemedExamConfig: ExamItemConfig = {
  general: {
    label: 'General',
    components: {
      normal: {
        alert: {
          label: 'Alert',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('248233002', 'Mental alertness (observable entity)'),
        },
        awake: {
          label: 'Awake',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('248218005', 'Awake (finding)'),
        },
        calm: {
          label: 'Calm',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('102894008', 'Feeling calm (finding)'),
        },
        'well-hydrated': {
          label: 'Well hydrated',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('405006006', 'Hydration status (observable entity)'),
        },
        'moist-mucous-membrane': {
          label: 'MMM (Moist Mucous Membrane)',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('276398005', 'Moist oral mucosa (finding)'),
          bodySite: createCodingCode('276398005', 'Moist oral mucosa (finding)'),
        },
        'distress-none': {
          label: 'No distress',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('69328002', 'Distress (finding)'),
        },
        'playful-and-active': {
          label: 'Playful and active',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('300776002', 'Does play (finding)'),
        },
      },
      abnormal: {
        'tired-appearing': {
          label: 'Tired-appearing',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('224960004', 'Tired (finding)'),
        },
        'ill-appearing': {
          label: 'Ill-appearing',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('39104002', 'Illness (finding)'),
        },
        fussy: {
          label: 'Fussy',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('55929007', 'Feeling irritable (finding)'),
        },
        'dry-mucous-membranes': {
          label: 'Dry mucous membranes',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('123640000', 'Mucous membrane dryness (finding)'),
          bodySite: createCodingCode('123640000', 'Mucous membrane dryness (finding)'),
        },
        'sunken-eye': {
          label: 'Sunken eyes',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('246923005', 'Sunken eyes (finding)'),
          bodySite: createCodingCode('246923005', 'Sunken eyes (finding)'),
        },
        distress: {
          label: 'Distress',
          placeholder: 'Distress degree',
          type: 'dropdown',
          components: {
            'mild-distress': {
              label: 'Mild',
              defaultValue: false,
              type: 'option',
              code: createCodingCode('69328003', 'Distress (finding)'),
            },
            'moderate-distress': {
              label: 'Moderate',
              defaultValue: false,
              type: 'option',
              code: createCodingCode('69328004', 'Distress (finding)'),
            },
            'severe-distress': {
              label: 'Severe',
              defaultValue: false,
              type: 'option',
              code: createCodingCode('69328005', 'Distress (finding)'),
            },
          },
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
  head: {
    label: 'Head',
    components: {
      normal: {
        normocephaly: {
          label: 'Normocephaly',
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
      },
      abnormal: {},
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
        'pupils-symmetric': {
          label: 'Pupils symmetric',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('301943000', 'Pupils equal (finding)'),
          bodySite: createCodingCode('301943000', 'Pupils equal (finding)'),
        },
        eomi: {
          label: 'EOMI (Extra Ocular Movements Intact)',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('103251002', 'Normal ocular motility (finding)'),
          bodySite: createCodingCode('103251002', 'Normal ocular motility (finding)'),
        },
      },
      abnormal: {
        'pupils-asymmetric': {
          label: 'Pupils asymmetric',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('247010007', 'Pupil finding (finding)'),
          bodySite: createCodingCode('247010007', 'Pupil finding (finding)'),
        },
        'right-eye': {
          label: 'Right eye',
          type: 'column',
          components: {
            'right-eye-injected': {
              label: 'Injected',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('246806002', 'Injection of caruncle of eye (finding)'),
              bodySite: createCodingCode('246806002', 'Injection of caruncle of eye (finding)'),
            },
            'right-eye-discharge': {
              label: 'Discharge',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('246679005', 'Discharge from eye (finding)'),
              bodySite: createCodingCode('246679005', 'Discharge from eye (finding)'),
            },
            'right-eye-watering': {
              label: 'Watering',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('420103007', 'Watery eye (finding)'),
              bodySite: createCodingCode('420103007', 'Watery eye (finding)'),
            },
            'right-eye-puffy-eyelids': {
              label: 'Puffy eyelids',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('193967004', 'Swelling of eyelid (finding)'),
              bodySite: createCodingCode('193967004', 'Swelling of eyelid (finding)'),
            },
            'right-eye-small-round-mass-in-eyelid': {
              label: 'Small round mass in eyelid',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('248514008', 'Lump in eyelid (finding)'),
              bodySite: createCodingCode('248514008', 'Lump in eyelid (finding)'),
            },
          },
        },
        'left-eye': {
          label: 'Left eye',
          type: 'column',
          components: {
            'left-eye-injected': {
              label: 'Injected',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('246806002', 'Injection of caruncle of eye (finding)'),
              bodySite: createCodingCode('246806002', 'Injection of caruncle of eye (finding)'),
            },
            'left-eye-discharge': {
              label: 'Discharge',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('246679005', 'Discharge from eye (finding)'),
              bodySite: createCodingCode('246679005', 'Discharge from eye (finding)'),
            },
            'left-eye-watering': {
              label: 'Watering',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('420103007', 'Watery eye (finding)'),
              bodySite: createCodingCode('420103007', 'Watery eye (finding)'),
            },
            'left-eye-puffy-eyelids': {
              label: 'Puffy eyelids',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('193967004', 'Swelling of eyelid (finding)'),
              bodySite: createCodingCode('193967004', 'Swelling of eyelid (finding)'),
            },
            'left-eye-small-round-mass-in-eyelid': {
              label: 'Small round mass in eyelid',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('248514008', 'Lump in eyelid (finding)'),
              bodySite: createCodingCode('248514008', 'Lump in eyelid (finding)'),
            },
          },
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
  nose: {
    label: 'Nose',
    components: {
      normal: {
        'no-drainage': {
          label: 'No drainage',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('64531003', 'Nasal discharge (finding)'),
          bodySite: createCodingCode('64531003', 'Nasal discharge (finding)'),
        },
      },
      abnormal: {
        'clear-rhinorrhea': {
          label: 'Clear rhinorrhea',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('64531003', 'Nasal discharge (finding)'),
          bodySite: createCodingCode('64531003', 'Nasal discharge (finding)'),
        },
        'purulent-discharge': {
          label: 'Purulent discharge',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('836475004', 'Mucopurulent discharge from nose (finding)'),
          bodySite: createCodingCode('836475004', 'Mucopurulent discharge from nose (finding)'),
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
  ears: {
    label: 'Ears',
    components: {
      normal: {},
      abnormal: {
        'right-ear': {
          label: 'Right ear',
          type: 'column',
          components: {
            'erythema-ear-right': {
              label: 'Erythema',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('247441003', 'Erythema (finding)'),
              bodySite: createCodingCode('247441003', 'Erythema (finding)'),
            },
            'swelling-ear-right': {
              label: 'Swelling',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('300874009', 'Swelling of ear (finding)'),
              bodySite: createCodingCode('300874009', 'Swelling of ear (finding)'),
            },
            'pain-with-movement-of-pinna-ear-right': {
              label: 'Pain with movement of pinna',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('301388005', 'Tenderness of ear structure (finding)'),
              bodySite: createCodingCode('301388005', 'Tenderness of ear structure (finding)'),
            },
            'drainage-from-ear-canal-right': {
              label: 'Drainage from ear canal',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('300132001', 'Ear discharge (finding)'),
              bodySite: createCodingCode('300132001', 'Ear discharge (finding)'),
            },
            'clear-discharge-ear-right': {
              label: 'Clear discharge',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('300132001', 'Ear discharge (finding)'),
              bodySite: createCodingCode('300132001', 'Ear discharge (finding)'),
            },
          },
        },
        'left-ear': {
          label: 'Left ear',
          type: 'column',
          components: {
            'erythema-ear-left': {
              label: 'Erythema',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('247441003', 'Erythema (finding)'),
              bodySite: createCodingCode('247441003', 'Erythema (finding)'),
            },
            'swelling-ear-left': {
              label: 'Swelling',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('300874009', 'Swelling of ear (finding)'),
              bodySite: createCodingCode('300874009', 'Swelling of ear (finding)'),
            },
            'pain-with-movement-of-pinna-ear-left': {
              label: 'Pain with movement of pinna',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('301388005', 'Tenderness of ear structure (finding)'),
              bodySite: createCodingCode('301388005', 'Tenderness of ear structure (finding)'),
            },
            'drainage-from-ear-canal-left': {
              label: 'Drainage from ear canal',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('300132001', 'Ear discharge (finding)'),
              bodySite: createCodingCode('300132001', 'Ear discharge (finding)'),
            },
            'clear-discharge-ear-left': {
              label: 'Clear discharge',
              defaultValue: false,
              type: 'checkbox',
              code: createCodingCode('300132001', 'Ear discharge (finding)'),
              bodySite: createCodingCode('300132001', 'Ear discharge (finding)'),
            },
          },
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
  mouth: {
    label: 'Mouth',
    components: {
      normal: {
        'mouth-normal': {
          label: 'No visible abnormalities',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('162010006', 'No mouth problem (situation)'),
          bodySite: createCodingCode('162010006', 'No mouth problem (situation)'),
        },
        'mouth-moist-mucous-membrane': {
          label: 'MMM (Moist Mucous Membrane)',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('276398005', 'Moist oral mucosa (finding)'),
          bodySite: createCodingCode('276398005', 'Moist oral mucosa (finding)'),
        },
        'oropharynx-clear': {
          label: 'Oropharynx clear with no erythema, no lesions or exudate',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('162010006', 'No mouth problem (situation)'),
          bodySite: createCodingCode('162010006', 'No mouth problem (situation)'),
        },
        'uvula-midline': {
          label: 'Uvula midline',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('249884003', 'Deviation of uvula (finding)'),
        },
        'tonsils-symmetric-and-not-enlarged': {
          label: 'Tonsils symmetric and not enlarged',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('306962003', 'Tonsil asymmetry (finding)'),
          bodySite: createCodingCode('306962003', 'Tonsil asymmetry (finding)'),
        },
        'normal-voice': {
          label: 'Normal voice',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('10503001', 'Normal voice (finding)'),
          bodySite: createCodingCode('10503001', 'Normal voice (finding)'),
        },
      },
      abnormal: {
        'mouth-dry-mucous-membranes': {
          label: 'Dry mucous membranes',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('262016004', 'Open mouth (finding)'),
          bodySite: createCodingCode('262016004', 'Open mouth (finding)'),
        },
        'erythema-of-pharynx': {
          label: 'Erythema of pharynx',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('247441003', 'Erythema (finding)'),
          bodySite: createCodingCode('247441003', 'Erythema (finding)'),
        },
        'white-patches-on-tongue-andor-buccal-mucosa-that-do-not-wipe-off': {
          label: 'White patches on tongue and/or buccal mucosa that do not wipe off',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('698193000', 'Coating of mucous membrane of tongue (finding)'),
          bodySite: createCodingCode('698193000', 'Coating of mucous membrane of tongue (finding)'),
        },
        'strawberry-tongue': {
          label: 'Strawberry tongue',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('42631002', 'Strawberry tongue (disorder)'),
          bodySite: createCodingCode('42631002', 'Strawberry tongue (disorder)'),
        },
        'uvula-deviated': {
          label: 'Uvula deviated',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('249884003', 'Deviation of uvula (finding)'),
          bodySite: createCodingCode('249884003', 'Deviation of uvula (finding)'),
        },
        'tonsils-erythematous': {
          label: 'Tonsils erythematous',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('195666007', 'Acute erythematous tonsillitis (disorder)'),
        },
        'exudate-on-tonsils': {
          label: 'Exudate on tonsils',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('301791008', 'Exudate on tonsils (finding)'),
          bodySite: createCodingCode('301791008', 'Exudate on tonsils (finding)'),
        },
        'hoarse-voice': {
          label: 'Hoarse voice',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('50219008', 'Hoarse (finding)'),
          bodySite: createCodingCode('50219008', 'Hoarse (finding)'),
        },
        'hot-potato-voice': {
          label: 'Hot potato voice',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('100000000', 'NOT REAL CODE Hot potato voice (finding)'),
          bodySite: createCodingCode('100000000', 'NOT REAL CODE Hot potato voice (finding)'),
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
  neck: {
    label: 'Neck',
    components: {
      normal: {
        'supple-neck': {
          label: 'Supple',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('48162006', 'Supple (qualifier value)'),
          bodySite: createCodingCode('48162006', 'Supple (qualifier value)'),
        },
        'moves-in-all-directions': {
          label: 'Moves in all directions',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('298475003', 'Normal movement of neck (finding)'),
          bodySite: createCodingCode('298475003', 'Normal movement of neck (finding)'),
        },
      },
      abnormal: {},
      comment: {
        'neck-comment': {
          label: 'Neck comment',
          type: 'text',
          code: createCodingCode('298378000', 'Finding of neck region (finding)'),
        },
      },
    },
  },
  chest: {
    label: 'Chest',
    components: {
      normal: {
        'normal-respiratory-effort': {
          label: 'Normal respiratory effort',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('1290338002', 'Normal respiratory effort (finding)'),
          bodySite: createCodingCode('1290338002', 'Normal respiratory effort (finding)'),
        },
        'no-tachypnea': {
          label: 'No tachypnea',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('20716004', 'Respiratory rate normal (finding)'),
          bodySite: createCodingCode('20716004', 'Respiratory rate normal (finding)'),
        },
        'no-retractions': {
          label: 'No retractions',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('67909005', 'Chest wall retraction (finding)'),
          bodySite: createCodingCode('67909005', 'Chest wall retraction (finding)'),
        },
        'no-conversational-dyspnea': {
          label: 'No conversational dyspnea',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('161938003', 'No breathlessness (situation)'),
        },
      },
      abnormal: {
        tachypnea: {
          label: 'Tachypnea',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('271823003', 'Tachypnea (finding)'),
        },
        'suprasternal-retractions': {
          label: 'Suprasternal retractions',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('67909005', 'Chest wall retraction (finding)'),
          bodySite: createCodingCode('67909005', 'Chest wall retraction (finding)'),
        },
        'intercostal-retractions': {
          label: 'Intercostal retractions',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('67909005', 'Chest wall retraction (finding)'),
          bodySite: createCodingCode('67909005', 'Chest wall retraction (finding)'),
        },
        'subcostal-retractions': {
          label: 'Subcostal retractions',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('67909005', 'Chest wall retraction (finding)'),
          bodySite: createCodingCode('67909005', 'Chest wall retraction (finding)'),
        },
        'abdominal-breathing': {
          label: 'Abdominal breathing',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('57591009', 'Diaphragmatic breathing (finding)'),
          bodySite: createCodingCode('57591009', 'Diaphragmatic breathing (finding)'),
        },
        grunting: {
          label: 'Grunting',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('62085005', 'Grunting respiration (finding)'),
          bodySite: createCodingCode('62085005', 'Grunting respiration (finding)'),
        },
        'nasal-flaring': {
          label: 'Nasal flaring',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('248568003', 'Nasal flaring (finding)'),
          bodySite: createCodingCode('248568003', 'Nasal flaring (finding)'),
        },
        wheeze: {
          label: 'Audible wheeze',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('56018004', 'Wheezing (finding)'),
          bodySite: createCodingCode('56018004', 'Wheezing (finding)'),
        },
        'barky-cough': {
          label: 'Barky cough',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('17986004', 'Barking cough (finding)'),
          bodySite: createCodingCode('17986004', 'Barking cough (finding)'),
        },
        'stridor-with-each-breath': {
          label: 'Stridor with each breath',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('70407001', 'Stridor (finding)'),
          bodySite: createCodingCode('70407001', 'Stridor (finding)'),
        },
      },
      comment: {
        'chest-comment': {
          label: 'Chest comment',
          type: 'text',
          code: createCodingCode('724622000', 'Problem of chest (finding)'),
        },
      },
    },
  },
  back: {
    label: 'Back',
    components: {
      normal: {
        'back-normal': {
          label: 'Normal',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('17621005', 'Normal (qualifier value)'),
          bodySite: createCodingCode('17621005', 'Normal (qualifier value)'),
        },
        'able-to-flex-and-extend-back-and-move-side-to-side': {
          label: 'Able to flex and extend back and twist side to side',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('364564000', 'Range of joint movement (observable entity)'),
          bodySite: createCodingCode('364564000', 'Range of joint movement (observable entity)'),
        },
      },
      abnormal: {
        'cva-tenderness': {
          label: 'CVA tenderness',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('102830001', 'Renal angle tenderness (finding)'),
          bodySite: createCodingCode('102830001', 'Renal angle tenderness (finding)'),
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
  skin: {
    label: 'Skin',
    components: {
      normal: {
        'no-rashes': {
          label: 'No rashes',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('225544001', 'Skin appearance normal (finding)'),
          bodySite: createCodingCode('225544001', 'Skin appearance normal (finding)'),
        },
      },
      abnormal: {},
      comment: {
        'skin-comment': {
          label: 'Skin comment',
          type: 'text',
          code: createCodingCode('106076001', 'Skin finding (finding)'),
        },
      },
    },
  },
  abdomen: {
    label: 'Abdomen',
    components: {
      normal: {
        'normal-appearing-on-parental-exam': {
          label: 'Normal appearing on parental exam',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('163133003', 'Abdomen examined - no abnormality detected (finding)'),
          bodySite: createCodingCode('163133003', 'Abdomen examined - no abnormality detected (finding)'),
        },
        'non-tender-on-parental-exam': {
          label: 'Non-tender on parental exam',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('297125009', 'Abdominal tenderness absent (situation)'),
          bodySite: createCodingCode('297125009', 'Abdominal tenderness absent (situation)'),
        },
        'able-to-jump-up-down-without-abdominal-pain': {
          label: 'Able to jump up/down without abdominal pain',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('282600008', 'Able to jump (finding)'),
          bodySite: createCodingCode('282600008', 'Able to jump (finding)'),
        },
      },
      abnormal: {
        tender: {
          label: 'Tender',
          placeholder: 'Tender location',
          type: 'dropdown',
          components: {
            'left-lower-quadrant-abdomen': {
              label: 'Left Lower Quadrant - Abdomen',
              defaultValue: false,
              type: 'option',
              code: createCodingCode('68505006', 'Structure of left lower quadrant of abdomen (body structure)'),
            },
            'right-lower-quadrant-abdomen': {
              label: 'Right Lower Quadrant - Abdomen',
              defaultValue: false,
              type: 'option',
              code: createCodingCode('48544008', 'Structure of right lower quadrant of abdomen (body structure)'),
            },
            'right-upper-quadrant-abdomen': {
              label: 'Right Upper Quadrant - Abdomen',
              defaultValue: false,
              type: 'option',
              code: createCodingCode('50519007', 'Structure of right upper quadrant of abdomen (body structure)'),
            },
            'left-upper-quadrant-abdomen': {
              label: 'Left Upper Quadrant - Abdomen',
              defaultValue: false,
              type: 'option',
              code: createCodingCode('86367003', 'Structure of left upper quadrant of abdomen (body structure)'),
            },
            'epigastric-region-abdomen': {
              label: 'Epigastric Region - Abdomen',
              defaultValue: false,
              type: 'option',
              code: createCodingCode('27947004', 'Epigastric region structure (body structure)'),
            },
            'left-abdominal-lumbar-region-abdomen': {
              label: 'Left Abdominal Lumbar Region - Abdomen',
              defaultValue: false,
              type: 'option',
              code: createCodingCode('1017212007', 'Structure of left abdominal lumbar region (body structure)'),
            },
            'right-abdominal-lumbar-region-abdomen': {
              label: 'Right Abdominal Lumbar Region - Abdomen',
              defaultValue: false,
              type: 'option',
              code: createCodingCode('1017213002', 'Structure of right abdominal lumbar region (body structure)'),
            },
          },
        },
        'not-able-to-jump-up-down-due-to-abdominal-pain': {
          label: 'Not able to jump up/down due to abdominal pain',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('282600008', 'Able to jump (finding)'),
          bodySite: createCodingCode('282600008', 'Able to jump (finding)'),
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
  musculoskeletal: {
    label: 'Musculoskeletal',
    components: {
      normal: {
        'moving-extemities-equally': {
          label: 'Moving extemities equally',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('20658008', 'Normal muscle function (finding)'),
          bodySite: createCodingCode('20658008', 'Normal muscle function (finding)'),
        },
        'normal-gait': {
          label: 'Normal gait',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('8117002', 'Gait normal (finding)'),
          bodySite: createCodingCode('8117002', 'Gait normal (finding)'),
        },
        'normal-rom': {
          label: 'Normal ROM',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('364564000', 'Range of joint movement (observable entity)'),
          bodySite: createCodingCode('364564000', 'Range of joint movement (observable entity)'),
        },
        'no-swelling': {
          label: 'No swelling',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('65124004', 'Swelling (finding)'),
        },
        'no-bruising': {
          label: 'No bruising',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('297950006', 'Finding related to bruising (finding)'),
        },
        'no-deformity': {
          label: 'No deformity',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('417893002', 'Deformity (finding)'),
        },
      },
      abnormal: {},
      comment: { 'musculoskeletal-comment': { label: 'Musculoskeletal comment', type: 'text' } },
    },
  },
  neurological: {
    label: 'Neurological',
    components: {
      normal: {
        'normal-mental-status': {
          label: 'Normal mental status',
          defaultValue: true,
          type: 'checkbox',
          code: createCodingCode('17326005', 'Well in self (finding)'),
        },
      },
      abnormal: {},
      comment: {
        'neurological-comment': {
          label: 'Neurological comment',
          type: 'text',
          code: createCodingCode('102957003', 'Neurological finding (finding)'),
        },
      },
    },
  },
  psych: {
    label: 'Psych',
    components: {
      normal: {
        'normal-affect': {
          label: 'Normal affect',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('134417007', 'Level of mood - normal (finding)'),
        },
        'good-eye-contact': {
          label: 'Good eye contact',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('400968009', 'Maintains good eye contact (finding)'),
        },
      },
      abnormal: {
        'depressed-affect': {
          label: 'Depressed affect',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('366979004', 'Depressed mood (finding)'),
        },
        'poor-eye-contact': {
          label: 'Poor eye contact',
          defaultValue: false,
          type: 'checkbox',
          code: createCodingCode('412786000', 'Poor eye contact (finding)'),
        },
      },
      comment: {
        'psych-comment': {
          label: 'Psych comment',
          type: 'text',
          code: createCodingCode('116367006', 'Psychological finding (finding)'),
        },
      },
    },
  },
};
