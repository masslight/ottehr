import { createCodeableConcept } from '../../api';

export const TelemedExamConfig = {
  general: {
    label: 'General',
    components: {
      normal: {
        alert: {
          label: 'Alert',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Mental alertness (observable entity)'),
        },
        awake: {
          label: 'Awake',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Awake (finding)'),
        },
        calm: {
          label: 'Calm',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Feeling calm (finding)'),
        },
        'well-hydrated': {
          label: 'Well hydrated',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Hydration status (observable entity)'),
        },
        'moist-mucous-membrane': {
          label: 'MMM (Moist Mucous Membrane)',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Moist oral mucosa (finding)'),
        },
        'distress-none': {
          label: 'No distress',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Distress (finding)'),
        },
        'playful-and-active': {
          label: 'Playful and active',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Does play (finding)'),
        },
      },
      abnormal: {
        'tired-appearing': {
          label: 'Tired-appearing',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Tired (finding)'),
        },
        'ill-appearing': {
          label: 'Ill-appearing',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Illness (finding)'),
        },
        fussy: {
          label: 'Fussy',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Feeling irritable (finding)'),
        },
        'dry-mucous-membranes': {
          label: 'Dry mucous membranes',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Mucous membrane dryness (finding)'),
        },
        'sunken-eye': {
          label: 'Sunken eyes',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Sunken eyes (finding)'),
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
              code: createCodeableConcept(undefined, 'Distress (finding)'),
            },
            'moderate-distress': {
              label: 'Moderate',
              defaultValue: false,
              type: 'option',
              code: createCodeableConcept(undefined, 'Distress (finding)'),
            },
            'severe-distress': {
              label: 'Severe',
              defaultValue: false,
              type: 'option',
              code: createCodeableConcept(undefined, 'Distress (finding)'),
            },
          },
        },
      },
      comment: {
        'general-comment': {
          label: 'General comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Entire body as a whole (body structure)'),
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
          code: createCodeableConcept(undefined, 'Normal (qualifier value)'),
        },
        atraumatic: {
          label: 'Atraumatic',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'No traumatic injury (situation)'),
        },
      },
      abnormal: {},
      comment: {
        'head-comment': {
          label: 'Head comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Finding of head region (finding)'),
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
          code: createCodeableConcept(undefined, 'Pupils equal (finding)'),
        },
        eomi: {
          label: 'EOMI (Extra Ocular Movements Intact)',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Normal ocular motility (finding)'),
        },
        'right-eye-normal': {
          label: 'Right eye - normal',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Normal eye proper (finding)'),
        },
        'left-eye-normal': {
          label: 'Left eye - normal',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Normal eye proper (finding)'),
        },
      },
      abnormal: {
        'pupils-asymmetric': {
          label: 'Pupils asymmetric',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Pupil finding (finding)'),
        },
        'right-eye': {
          label: 'Right eye',
          type: 'column',
          components: {
            'right-eye-injected': {
              label: 'Injected',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Injection of caruncle of eye (finding)'),
            },
            'right-eye-discharge': {
              label: 'Discharge',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Discharge from eye (finding)'),
            },
            'right-eye-watering': {
              label: 'Watering',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Watery eye (finding)'),
            },
            'right-eye-puffy-eyelids': {
              label: 'Puffy eyelids',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Swelling of eyelid (finding)'),
            },
            'right-eye-small-round-mass-in-eyelid': {
              label: 'Small round mass in eyelid',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Lump in eyelid (finding)'),
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
              code: createCodeableConcept(undefined, 'Injection of caruncle of eye (finding)'),
            },
            'left-eye-discharge': {
              label: 'Discharge',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Discharge from eye (finding)'),
            },
            'left-eye-watering': {
              label: 'Watering',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Watery eye (finding)'),
            },
            'left-eye-puffy-eyelids': {
              label: 'Puffy eyelids',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Swelling of eyelid (finding)'),
            },
            'left-eye-small-round-mass-in-eyelid': {
              label: 'Small round mass in eyelid',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Lump in eyelid (finding)'),
            },
          },
        },
      },
      comment: {
        'eyes-comment': {
          label: 'Eyes comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Eye / vision finding (finding)'),
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
          code: createCodeableConcept(undefined, 'Nasal discharge (finding)'),
        },
      },
      abnormal: {
        'clear-rhinorrhea': {
          label: 'Clear rhinorrhea',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Nasal discharge (finding)'),
        },
        'purulent-discharge': {
          label: 'Purulent discharge',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Mucopurulent discharge from nose (finding)'),
        },
      },
      comment: {
        'nose-comment': {
          label: 'Nose comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Nose finding (finding)'),
        },
      },
    },
  },
  ears: {
    label: 'Ears',
    components: {
      normal: {
        'normal-ear-right': {
          label: 'Right ear - normal',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Ear normal (finding)'),
        },
        'normal-ear-left': {
          label: 'Left ear - normal',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Ear normal (finding)'),
        },
      },
      abnormal: {
        'right-ear': {
          label: 'Right ear',
          type: 'column',
          components: {
            'erythema-ear-right': {
              label: 'Erythema',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Erythema (finding)'),
            },
            'swelling-ear-right': {
              label: 'Swelling',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Swelling of ear (finding)'),
            },
            'pain-with-movement-of-pinna-ear-right': {
              label: 'Pain with movement of pinna',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Tenderness of ear structure (finding)'),
            },
            'drainage-from-ear-canal-right': {
              label: 'Drainage from ear canal',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Ear discharge (finding)'),
            },
            'clear-discharge-ear-right': {
              label: 'Clear discharge',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Ear discharge (finding)'),
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
              code: createCodeableConcept(undefined, 'Erythema (finding)'),
            },
            'swelling-ear-left': {
              label: 'Swelling',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Swelling of ear (finding)'),
            },
            'pain-with-movement-of-pinna-ear-left': {
              label: 'Pain with movement of pinna',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Tenderness of ear structure (finding)'),
            },
            'drainage-from-ear-canal-left': {
              label: 'Drainage from ear canal',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Ear discharge (finding)'),
            },
            'clear-discharge-ear-left': {
              label: 'Clear discharge',
              defaultValue: false,
              type: 'checkbox',
              code: createCodeableConcept(undefined, 'Ear discharge (finding)'),
            },
          },
        },
      },
      comment: {
        'ears-comment': {
          label: 'Ears comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Ear finding (finding)'),
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
          code: createCodeableConcept(undefined, 'No mouth problem (situation)'),
        },
        'mouth-moist-mucous-membrane': {
          label: 'MMM (Moist Mucous Membrane)',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Moist oral mucosa (finding)'),
        },
        'oropharynx-clear': {
          label: 'Oropharynx clear with no erythema, no lesions or exudate',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'No mouth problem (situation)'),
        },
        'uvula-midline': {
          label: 'Uvula midline',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Deviation of uvula (finding)'),
        },
        'tonsils-symmetric-and-not-enlarged': {
          label: 'Tonsils symmetric and not enlarged',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Tonsil asymmetry (finding)'),
        },
        'normal-voice': {
          label: 'Normal voice',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Normal voice (finding)'),
        },
      },
      abnormal: {
        'mouth-dry-mucous-membranes': {
          label: 'Dry mucous membranes',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Open mouth (finding)'),
        },
        'erythema-of-pharynx': {
          label: 'Erythema of pharynx',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Erythema (finding)'),
        },
        'white-patches-on-tongue-andor-buccal-mucosa-that-do-not-wipe-off': {
          label: 'White patches on tongue and/or buccal mucosa that do not wipe off',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Coating of mucous membrane of tongue (finding)'),
        },
        'strawberry-tongue': {
          label: 'Strawberry tongue',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Strawberry tongue (disorder)'),
        },
        'uvula-deviated': {
          label: 'Uvula deviated',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Deviation of uvula (finding)'),
        },
        'tonsils-erythematous': {
          label: 'Tonsils erythematous',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Acute erythematous tonsillitis (disorder)'),
        },
        'exudate-on-tonsils': {
          label: 'Exudate on tonsils',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Exudate on tonsils (finding)'),
        },
        'hoarse-voice': {
          label: 'Hoarse voice',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Hoarse (finding)'),
        },
        'hot-potato-voice': {
          label: 'Hot potato voice',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'NOT REAL CODE Hot potato voice (finding)'),
        },
      },
      comment: {
        'mouth-comment': {
          label: 'Mouth comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Finding of mouth region (finding)'),
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
          code: createCodeableConcept(undefined, 'Supple (qualifier value)'),
        },
        'moves-in-all-directions': {
          label: 'Moves in all directions',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Normal movement of neck (finding)'),
        },
      },
      abnormal: {},
      comment: {
        'neck-comment': {
          label: 'Neck comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Finding of neck region (finding)'),
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
          code: createCodeableConcept(undefined, 'Normal respiratory effort (finding)'),
        },
        'no-tachypnea': {
          label: 'No tachypnea',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Respiratory rate normal (finding)'),
        },
        'no-retractions': {
          label: 'No retractions',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Chest wall retraction (finding)'),
        },
        'no-conversational-dyspnea': {
          label: 'No conversational dyspnea',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'No breathlessness (situation)'),
        },
      },
      abnormal: {
        tachypnea: {
          label: 'Tachypnea',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Tachypnea (finding)'),
        },
        'suprasternal-retractions': {
          label: 'Suprasternal retractions',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Chest wall retraction (finding)'),
        },
        'intercostal-retractions': {
          label: 'Intercostal retractions',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Chest wall retraction (finding)'),
        },
        'subcostal-retractions': {
          label: 'Subcostal retractions',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Chest wall retraction (finding)'),
        },
        'abdominal-breathing': {
          label: 'Abdominal breathing',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Diaphragmatic breathing (finding)'),
        },
        grunting: {
          label: 'Grunting',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Grunting respiration (finding)'),
        },
        'nasal-flaring': {
          label: 'Nasal flaring',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Nasal flaring (finding)'),
        },
        wheeze: {
          label: 'Audible wheeze',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Wheezing (finding)'),
        },
        'barky-cough': {
          label: 'Barky cough',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Barking cough (finding)'),
        },
        'stridor-with-each-breath': {
          label: 'Stridor with each breath',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Stridor (finding)'),
        },
      },
      comment: {
        'chest-comment': {
          label: 'Chest comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Problem of chest (finding)'),
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
          code: createCodeableConcept(undefined, 'Normal (qualifier value)'),
        },
        'able-to-flex-and-extend-back-and-move-side-to-side': {
          label: 'Able to flex and extend back and twist side to side',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Range of joint movement (observable entity)'),
        },
      },
      abnormal: {
        'cva-tenderness': {
          label: 'CVA tenderness',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Renal angle tenderness (finding)'),
        },
      },
      comment: {
        'back-comment': {
          label: 'Back comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Finding of back (finding)'),
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
          code: createCodeableConcept(undefined, 'Skin appearance normal (finding)'),
        },
      },
      abnormal: {
        rashes: {
          label: 'Rashes',
          type: 'form',
          components: {
            consistentWithViralExam: {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Macular eruption (disorder)'),
            },
            consistentWithInsectBites: {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Insect bite - wound (disorder)'),
            },
            consistentWithUrticaria: {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Urticaria (disorder)'),
            },
            consistentWithCoxsackievirus: {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Coxsackie virus exanthem (disorder)'),
            },
            consistentWithIrritantDiaperRash: {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Diaper rash (disorder)'),
            },
            consistentWithRingworm: {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Dermatophytosis (disorder)'),
            },
            consistentWithImpetigo: {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Impetigo (disorder)'),
            },
            consistentWithFifthsDisease: {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Eruption of skin of face (disorder)'),
            },
            consistentWithAtopicDermatitis: {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Atopic dermatitis (disorder)'),
            },
            consistentWithParonychia: {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Paronychia (disorder)'),
            },
            consistentWithPoisonIvyContactDermatitis: {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Hedera helix poisoning (disorder)'),
            },
            consistentWithTineaCapitis: {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Tinea capitis (disorder)'),
            },
            consistentWithPityriasisRosea: {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Pityriasis rosea (disorder)'),
            },
            consistentWithLymeEcm: {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Lyme disease (disorder)'),
            },
          },
          fields: {
            rashes: {
              label: 'Rashes',
              type: 'dropdown',
              options: {
                consistentWithViralExam: {
                  label: 'consistent with viral exam',
                },
                consistentWithInsectBites: {
                  label: 'consistent with insect bites',
                },
                consistentWithUrticaria: {
                  label: 'consistent with urticaria',
                },
                consistentWithCoxsackievirus: {
                  label: 'consistent with Coxsackievirus',
                },
                consistentWithIrritantDiaperRash: {
                  label: 'consistent with irritant diaper rash',
                },
                consistentWithRingworm: {
                  label: 'consistent with ringworm',
                },
                consistentWithImpetigo: {
                  label: 'consistent with impetigo',
                },
                consistentWithFifthsDisease: {
                  label: "consistent with Fifth's disease",
                },
                consistentWithAtopicDermatitis: {
                  label: 'consistent with atopic dermatitis',
                },
                consistentWithParonychia: {
                  label: 'consistent with paronychia',
                },
                consistentWithPoisonIvyContactDermatitis: {
                  label: 'consistent with poison ivy contact dermatitis',
                },
                consistentWithTineaCapitis: {
                  label: 'consistent with tinea capitis',
                },
                consistentWithPityriasisRosea: {
                  label: 'consistent with pityriasis rosea',
                },
                consistentWithLymeEcm: {
                  label: 'consistent with Lyme ECM',
                },
              },
            },
            description: {
              label: 'Description',
              type: 'text',
            },
          },
        },
      },
      comment: {
        'skin-comment': {
          label: 'Skin comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Skin finding (finding)'),
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
          code: createCodeableConcept(undefined, 'Abdomen examined - no abnormality detected (finding)'),
        },
        'non-tender-on-parental-exam': {
          label: 'Non-tender on parental exam',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abdominal tenderness absent (situation)'),
        },
        'able-to-jump-up-down-without-abdominal-pain': {
          label: 'Able to jump up/down without abdominal pain',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Able to jump (finding)'),
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
              code: createCodeableConcept(undefined, 'Structure of left lower quadrant of abdomen (body structure)'),
            },
            'right-lower-quadrant-abdomen': {
              label: 'Right Lower Quadrant - Abdomen',
              defaultValue: false,
              type: 'option',
              code: createCodeableConcept(undefined, 'Structure of right lower quadrant of abdomen (body structure)'),
            },
            'right-upper-quadrant-abdomen': {
              label: 'Right Upper Quadrant - Abdomen',
              defaultValue: false,
              type: 'option',
              code: createCodeableConcept(undefined, 'Structure of right upper quadrant of abdomen (body structure)'),
            },
            'left-upper-quadrant-abdomen': {
              label: 'Left Upper Quadrant - Abdomen',
              defaultValue: false,
              type: 'option',
              code: createCodeableConcept(undefined, 'Structure of left upper quadrant of abdomen (body structure)'),
            },
            'epigastric-region-abdomen': {
              label: 'Epigastric Region - Abdomen',
              defaultValue: false,
              type: 'option',
              code: createCodeableConcept(undefined, 'Epigastric region structure (body structure)'),
            },
            'left-abdominal-lumbar-region-abdomen': {
              label: 'Left Abdominal Lumbar Region - Abdomen',
              defaultValue: false,
              type: 'option',
              code: createCodeableConcept(undefined, 'Structure of left abdominal lumbar region (body structure)'),
            },
            'right-abdominal-lumbar-region-abdomen': {
              label: 'Right Abdominal Lumbar Region - Abdomen',
              defaultValue: false,
              type: 'option',
              code: createCodeableConcept(undefined, 'Structure of right abdominal lumbar region (body structure)'),
            },
          },
        },
        'not-able-to-jump-up-down-due-to-abdominal-pain': {
          label: 'Not able to jump up/down due to abdominal pain',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Able to jump (finding)'),
        },
      },
      comment: {
        'abdomen-comment': {
          label: 'Abdomen comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Finding of abdomen (finding)'),
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
          code: createCodeableConcept(undefined, 'Normal muscle function (finding)'),
        },
        'normal-gait': {
          label: 'Normal gait',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Gait normal (finding)'),
        },
        'normal-rom': {
          label: 'Normal ROM',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Range of joint movement (observable entity)'),
        },
        'no-swelling': {
          label: 'No swelling',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Swelling (finding)'),
        },
        'no-bruising': {
          label: 'No bruising',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
        },
        'no-deformity': {
          label: 'No deformity',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Deformity (finding)'),
        },
      },
      abnormal: {
        abnormal: {
          label: 'Abnormal',
          type: 'form',
          components: {
            'left-finger-index-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-finger-index-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-finger-middle-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-finger-middle-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-finger-ring-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-finger-ring-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-finger-little-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-finger-little-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-finger-thumb-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-finger-thumb-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-hand-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-hand-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-foot-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-foot-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-toe-great-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-toe-great-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-toe-second-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-toe-second-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-toe-third-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-toe-third-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-toe-fourth-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-toe-fourth-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-toe-fifth-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-toe-fifth-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-wrist-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-wrist-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-forearm-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-forearm-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-elbow-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-elbow-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-upperarm-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-upperarm-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-shoulder-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-shoulder-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-knee-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-knee-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-lowerleg-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-lowerleg-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-ankle-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'right-ankle-swelling': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Swelling (finding)'),
            },
            'left-finger-index-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-finger-index-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-finger-middle-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-finger-middle-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-finger-ring-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-finger-ring-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-finger-little-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-finger-little-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-finger-thumb-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-finger-thumb-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-hand-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-hand-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-foot-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-foot-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-toe-great-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-toe-great-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-toe-second-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-toe-second-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-toe-third-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-toe-third-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-toe-fourth-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-toe-fourth-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-toe-fifth-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-toe-fifth-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-wrist-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-wrist-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-forearm-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-forearm-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-elbow-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-elbow-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-upperarm-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-upperarm-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-shoulder-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-shoulder-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-knee-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-knee-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-lowerleg-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-lowerleg-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-ankle-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'right-ankle-deformity': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Deformity (finding)'),
            },
            'left-finger-index-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-finger-index-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-finger-middle-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-finger-middle-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-finger-ring-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-finger-ring-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-finger-little-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-finger-little-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-finger-thumb-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-finger-thumb-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-hand-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-hand-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-foot-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-foot-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-toe-great-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-toe-great-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-toe-second-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-toe-second-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-toe-third-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-toe-third-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-toe-fourth-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-toe-fourth-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-toe-fifth-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-toe-fifth-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-wrist-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-wrist-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-forearm-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-forearm-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-elbow-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-elbow-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-upperarm-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-upperarm-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-shoulder-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-shoulder-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-knee-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-knee-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-lowerleg-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-lowerleg-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-ankle-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'right-ankle-bruising': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Finding related to bruising (finding)'),
            },
            'left-finger-index-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-finger-index-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-finger-middle-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-finger-middle-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-finger-ring-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-finger-ring-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-finger-little-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-finger-little-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-finger-thumb-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-finger-thumb-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-hand-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-hand-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-foot-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-foot-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-toe-great-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-toe-great-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-toe-second-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-toe-second-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-toe-third-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-toe-third-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-toe-fourth-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-toe-fourth-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-toe-fifth-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-toe-fifth-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-wrist-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-wrist-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-forearm-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-forearm-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-elbow-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-elbow-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-upperarm-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-upperarm-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-shoulder-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-shoulder-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-knee-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-knee-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-lowerleg-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-lowerleg-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-ankle-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'right-ankle-ableToBearWeight': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Weight-bearing (finding)'),
            },
            'left-finger-index-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of finger movement (finding)'),
            },
            'right-finger-index-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of finger movement (finding)'),
            },
            'left-finger-middle-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of finger movement (finding)'),
            },
            'right-finger-middle-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of finger movement (finding)'),
            },
            'left-finger-ring-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of finger movement (finding)'),
            },
            'right-finger-ring-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of finger movement (finding)'),
            },
            'left-finger-little-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of finger movement (finding)'),
            },
            'right-finger-little-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of finger movement (finding)'),
            },
            'left-finger-thumb-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of thumb movement (finding)'),
            },
            'right-finger-thumb-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of thumb movement (finding)'),
            },
            'left-hand-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'right-hand-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'left-foot-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of foot movement (finding)'),
            },
            'right-foot-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of foot movement (finding)'),
            },
            'left-toe-great-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'right-toe-great-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'left-toe-second-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'right-toe-second-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'left-toe-third-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'right-toe-third-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'left-toe-fourth-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'right-toe-fourth-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'left-toe-fifth-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'right-toe-fifth-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'left-wrist-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of wrist movement (finding)'),
            },
            'right-wrist-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of wrist movement (finding)'),
            },
            'left-forearm-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'right-forearm-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'left-elbow-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of elbow movement (finding)'),
            },
            'right-elbow-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of elbow movement (finding)'),
            },
            'left-upperarm-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'right-upperarm-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'left-shoulder-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'right-shoulder-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'left-knee-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'right-knee-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'left-lowerleg-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'right-lowerleg-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Limitation of joint movement (finding)'),
            },
            'left-ankle-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of ankle movement (finding)'),
            },
            'right-ankle-decreasedrom': {
              defaultValue: false,
              type: 'form-element',
              code: createCodeableConcept(undefined, 'Decreased range of ankle movement (finding)'),
            },
          },
          fields: {
            side: {
              label: 'Side',
              type: 'radio',
              options: {
                left: {
                  label: 'Left',
                },
                right: {
                  label: 'Right',
                },
              },
            },
            bodyPart: {
              label: 'Body part',
              type: 'dropdown',
              options: {
                finger: {
                  label: 'Finger',
                },
                hand: {
                  label: 'Hand',
                },
                wrist: {
                  label: 'Wrist',
                },
                forearm: {
                  label: 'Forearm',
                },
                elbow: {
                  label: 'Elbow',
                },
                upperarm: {
                  label: 'Upper arm',
                },
                shoulder: {
                  label: 'Shoulder',
                },
                knee: {
                  label: 'Knee',
                },
                lowerleg: {
                  label: 'Lower leg',
                },
                ankle: {
                  label: 'Ankle',
                },
                foot: {
                  label: 'Foot',
                },
                toe: {
                  label: 'Toe',
                },
              },
            },
            finger: {
              label: 'Finger',
              type: 'dropdown',
              enabledWhen: {
                field: 'bodyPart',
                value: 'finger',
              },
              options: {
                thumb: { label: 'Thumb' },
                index: { label: 'Index' },
                middle: { label: 'Middle' },
                ring: { label: 'Ring' },
                little: { label: 'Little' },
              },
            },
            toe: {
              label: 'Toe',
              type: 'dropdown',
              enabledWhen: {
                field: 'bodyPart',
                value: 'toe',
              },
              options: {
                great: { label: 'First' },
                second: { label: 'Second' },
                third: { label: 'Third' },
                fourth: { label: 'Fourth' },
                fifth: { label: 'Fifth' },
              },
            },
            abnormal: {
              label: 'Abnormal',
              type: 'dropdown',
              options: {
                swelling: { label: 'Swelling' },
                deformity: { label: 'Deformity' },
                bruising: { label: 'Bruising' },
                ableToBearWeight: { label: 'Able to bear weight' },
                decreasedrom: { label: 'Decreased ROM' },
              },
            },
          },
        },
      },
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
          code: createCodeableConcept(undefined, 'Well in self (finding)'),
        },
      },
      abnormal: {},
      comment: {
        'neurological-comment': {
          label: 'Neurological comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Neurological finding (finding)'),
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
          code: createCodeableConcept(undefined, 'Level of mood - normal (finding)'),
        },
        'good-eye-contact': {
          label: 'Good eye contact',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Maintains good eye contact (finding)'),
        },
      },
      abnormal: {
        'depressed-affect': {
          label: 'Depressed affect',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Depressed mood (finding)'),
        },
        'poor-eye-contact': {
          label: 'Poor eye contact',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Poor eye contact (finding)'),
        },
      },
      comment: {
        'psych-comment': {
          label: 'Psych comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Psychological finding (finding)'),
        },
      },
    },
  },
};
