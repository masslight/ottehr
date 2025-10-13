export const InPersonExamConfig = {
  general: {
    label: 'General Appearance',
    components: {
      normal: {
        alert: {
          label: 'Alert',
          defaultValue: true,
          type: 'checkbox',
        },
        active: { label: 'Active', defaultValue: true, type: 'checkbox' },
        'in-no-acute-distress': { label: 'In no acute distress', defaultValue: true, type: 'checkbox' },
        'well-hydrated': {
          label: 'Well-hydrated',
          defaultValue: true,
          type: 'checkbox',
        },
      },
      abnormal: {
        dehydrated: { label: 'Dehydrated', defaultValue: false, type: 'checkbox' },
        listless: { label: 'Listless', defaultValue: false, type: 'checkbox' },
      },
      comment: { 'general-comment': { label: 'General comment', type: 'text' } },
    },
  },
  head: {
    label: 'Head',
    components: {
      normal: {
        normocephalic: { label: 'Normocephalic', defaultValue: true, type: 'checkbox' },
        atraumatic: {
          label: 'Atraumatic',
          defaultValue: true,
          type: 'checkbox',
        },
      },
      abnormal: { 'scalp-laceration': { label: 'Scalp laceration', defaultValue: false, type: 'checkbox' } },
      comment: { 'head-comment': { label: 'Head comment', type: 'text' } },
    },
  },
  eyes: {
    label: 'Eyes',
    components: {
      normal: {
        'right-eye-conjunctiva-non-injected-no-discharge': {
          label: 'Right eye - conjunctiva non-injected, no discharge',
          defaultValue: true,
          type: 'checkbox',
        },
        'left-eye-conjunctiva-non-injected-no-discharge': {
          label: 'Left eye - conjunctiva non-injected, no discharge',
          defaultValue: true,
          type: 'checkbox',
        },
        'lids-and-lashes-normal': { label: 'Lids and lashes normal', defaultValue: true, type: 'checkbox' },
        'pupils-equal-round-reactive-to-light-and-accommodation': {
          label: 'Pupils equal, round, reactive to light and accommodation',
          defaultValue: false,
          type: 'checkbox',
        },
        'extra-ocular-movements-intact': {
          label: 'Extra-ocular movements intact',
          defaultValue: false,
          type: 'checkbox',
        },
      },
      abnormal: {
        'right-eye': {
          label: 'Right eye',
          type: 'column',
          components: {
            'right-eye-conjunctival-injection': {
              label: 'Conjunctival injection',
              defaultValue: false,
              type: 'checkbox',
            },
            'right-eye-discharge-present': { label: 'Discharge present', defaultValue: false, type: 'checkbox' },
            'right-eye-tender-erythematous-nodule-on-eyelid-margin': {
              label: 'Tender, erythematous nodule on eyelid margin',
              defaultValue: false,
              type: 'checkbox',
            },
          },
        },
        'left-eye': {
          label: 'Left eye',
          type: 'column',
          components: {
            'left-eye-conjunctival-injection': {
              label: 'Conjunctival injection',
              defaultValue: false,
              type: 'checkbox',
            },
            'left-eye-discharge-present': { label: 'Discharge present', defaultValue: false, type: 'checkbox' },
            'left-eye-tender-erythematous-nodule-on-eyelid-margin': {
              label: 'Tender, erythematous nodule on eyelid margin',
              defaultValue: false,
              type: 'checkbox',
            },
          },
        },
      },
      comment: { 'eyes-comment': { label: 'Eyes comment', type: 'text' } },
    },
  },
  ears: {
    label: 'Ears',
    components: {
      normal: {
        'right-tm-pearly-with-good-light-reflex-preserved-landmarks': {
          label: 'Right TM pearly with good light reflex, preserved landmarks',
          defaultValue: true,
          type: 'checkbox',
        },
        'left-tm-pearly-with-good-light-reflex-preserved-landmarks': {
          label: 'Left TM pearly with good light reflex, preserved landmarks',
          defaultValue: true,
          type: 'checkbox',
        },
        'no-effusion': { label: 'No effusion', defaultValue: true, type: 'checkbox' },
        'normal-canals': { label: 'Normal canals', defaultValue: true, type: 'checkbox' },
        'normal-external-ear': { label: 'Normal external ear', defaultValue: true, type: 'checkbox' },
        'tms-with-no-hemotympanum': { label: 'TMs with no hemotympanum', defaultValue: false, type: 'checkbox' },
      },
      abnormal: {
        'right-ear': {
          label: 'Right ear',
          type: 'column',
          components: {
            'right-ear-tm-bulging-erythematous': {
              label: 'TM bulging, erythematous',
              defaultValue: false,
              type: 'checkbox',
            },
            'right-ear-tm-with-fluid': { label: 'TM with fluid', defaultValue: false, type: 'checkbox' },
            'right-ear-canal-impacted-cerumen': {
              label: 'Canal impacted cerumen',
              defaultValue: false,
              type: 'checkbox',
            },
            'right-ear-canal-with-debris-and-inflamed': {
              label: 'Canal with debris and inflamed',
              defaultValue: false,
              type: 'checkbox',
            },
            'right-ear-tragus-tender': { label: 'Tragus tender', defaultValue: false, type: 'checkbox' },
          },
        },
        'left-ear': {
          label: 'Left ear',
          type: 'column',
          components: {
            'left-ear-tm-bulging-erythematous': {
              label: 'TM bulging, erythematous',
              defaultValue: false,
              type: 'checkbox',
            },
            'left-ear-tm-with-fluid': { label: 'TM with fluid', defaultValue: false, type: 'checkbox' },
            'left-ear-canal-impacted-cerumen': {
              label: 'Canal impacted cerumen',
              defaultValue: false,
              type: 'checkbox',
            },
            'left-ear-canal-with-debris-and-inflamed': {
              label: 'Canal with debris and inflamed',
              defaultValue: false,
              type: 'checkbox',
            },
            'left-ear-tragus-tender': { label: 'Tragus tender', defaultValue: false, type: 'checkbox' },
          },
        },
      },
      comment: { 'ears-comment': { label: 'Ears comment', type: 'text' } },
    },
  },
  nose: {
    label: 'Nose',
    components: {
      normal: { 'nasal-mucosa-normal': { label: 'Nasal mucosa normal', defaultValue: true, type: 'checkbox' } },
      abnormal: { 'congestion-rhinorrhea': { label: 'Congestion, rhinorrhea', defaultValue: false, type: 'checkbox' } },
      comment: { 'nose-comment': { label: 'Nose comment', type: 'text' } },
    },
  },
  oral: {
    label: 'Oral Cavity',
    components: {
      normal: {
        'moist-mucous-membranes': { label: 'Moist mucous membranes', defaultValue: true, type: 'checkbox' },
        'oropharynx-clear-with-no-erythema-lesions-or-exudate': {
          label: 'Oropharynx clear with no erythema, lesions, or exudate',
          defaultValue: true,
          type: 'checkbox',
        },
        'uvula-midline': {
          label: 'Uvula midline',
          defaultValue: true,
          type: 'checkbox',
        },
        'normal-dentition': { label: 'Normal dentition', defaultValue: false, type: 'checkbox' },
        'tongue-midline': { label: 'Tongue midline', defaultValue: false, type: 'checkbox' },
      },
      abnormal: {
        'erythematous-pharynx': { label: 'Erythematous pharynx', defaultValue: false, type: 'checkbox' },
        'tonsillar-exudate': { label: 'Tonsillar exudate', defaultValue: false, type: 'checkbox' },
        'poor-dentition': { label: 'Poor dentition', defaultValue: false, type: 'checkbox' },
        'dry-mucous-membranes': {
          label: 'Dry mucous membranes',
          defaultValue: false,
          type: 'checkbox',
        },
        'vesicles-or-shallow-ulcers-on-the-palate-posterior-oropharynx': {
          label: 'Vesicles or shallow ulcers on the palate/ posterior oropharynx',
          defaultValue: false,
          type: 'checkbox',
        },
      },
      comment: { 'oral-comment': { label: 'Oral comment', type: 'text' } },
    },
  },
  neck: {
    label: 'Neck, Thyroid',
    components: {
      normal: {
        'normal-appearance-of-neck': { label: 'Normal appearance of neck', defaultValue: true, type: 'checkbox' },
        'normal-range-of-motion': { label: 'Normal range of motion', defaultValue: true, type: 'checkbox' },
      },
      abnormal: {
        'limited-range-of-motion-when-turning-left': {
          label: 'Limited range of motion when turning left',
          defaultValue: false,
          type: 'checkbox',
        },
        'limited-range-of-motion-when-turning-right': {
          label: 'Limited range of motion when turning right',
          defaultValue: false,
          type: 'checkbox',
        },
      },
      comment: { 'neck-comment': { label: 'Neck comment', type: 'text' } },
    },
  },
  lymph: {
    label: 'Lymph Nodes',
    components: {
      normal: {
        'no-generalized-lymphadenopathy': {
          label: 'No generalized lymphadenopathy',
          defaultValue: true,
          type: 'checkbox',
        },
      },
      abnormal: {
        'right-cervical-node-easily-mobile-non-tender-not-erythematous': {
          label: 'Right cervical node, easily mobile, non-tender, not erythematous',
          defaultValue: false,
          type: 'checkbox',
        },
        'left-cervical-node-easily-mobile-non-tender-not-erythematous': {
          label: 'Left cervical node, easily mobile, non-tender, not erythematous',
          defaultValue: false,
          type: 'checkbox',
        },
      },
      comment: { 'lymph-comment': { label: 'Lymph comment', type: 'text' } },
    },
  },
  skin: {
    label: 'Skin, Hair, Nails',
    components: {
      normal: {
        'no-rash': { label: 'No rash', defaultValue: true, type: 'checkbox' },
        'warm-and-dry': { label: 'Warm and dry', defaultValue: true, type: 'checkbox' },
      },
      abnormal: {
        rash: {
          label: 'Rash',
          type: 'multi-select',
          options: {
            'cw-viral-exam': {
              label: 'C/w viral exam',
              defaultValue: false,
              description: 'erythematous, macular rash over trunk>extremities',
            },
            'cw-insect-bites': {
              label: 'C/w insect bites',
              defaultValue: false,
              description: 'erythematous-based papules/plaques with central punctate marks',
            },
            'cw-urticaria': {
              label: 'C/w urticaria',
              defaultValue: false,
              description: 'discrete, papular islands with surrounding erythema',
            },
            'cw-coxsackievirus': {
              label: 'C/w Coxsackievirus',
              defaultValue: false,
              description: '2-3 mm erythematous papules worse on hands and feet, including palms and soles',
            },
            'cw-irritant-diaper-rash': {
              label: 'C/w irritant diaper rash',
              defaultValue: false,
              description:
                'erythematous macular rash in diaper area that spares creases with no satellite lesions, erythematous, confluent papules in',
            },
            'cw-ringworm': {
              label: 'C/w ringworm',
              defaultValue: false,
              description: 'erythematous patch with serpiginous, raised border and central scale',
            },
            'cw-impetigo': {
              label: 'C/w impetigo',
              defaultValue: false,
              description: 'erythematous-based, honey-crusted, non-tender lesions',
            },
            'cw-fifths-disease': {
              label: "C/w Fifth's disease",
              defaultValue: false,
              description: 'diffuse, erythematous, maculopapular rash and erythematous cheeks sparing nasolabial folds',
            },
            'cw-atopic-dermatitis': {
              label: 'C/w atopic dermatitis',
              defaultValue: false,
              description: 'dry, scaly patches of skin with underlying erythema',
            },
            'cw-paronychia': {
              label: 'C/w paronychia',
              defaultValue: false,
              description: 'tender erythema along edge of nail with no lymphatic streaking',
            },
            'cw-poison-ivy-contact-dermatitis': {
              label: 'C/w poison ivy contact dermatitis',
              defaultValue: false,
              description: 'linear patches and clusters of erythematous-based vesicles, some dry, no burrows',
            },
            'cw-tinea-capitis': {
              label: 'C/w tinea capitis',
              defaultValue: false,
              description: 'flat area of broken hair shafts and overlying scale',
            },
            'cw-pityriasis-rosea': {
              label: 'C/w pityriasis rosea',
              defaultValue: false,
              description: '1-2 cm oval, erythematous, scaly papules with long axis along truncal dermatomal lines',
            },
            'cw-lyme-ecm': {
              label: 'C/w Lyme ECM',
              defaultValue: false,
              description: 'macular, blanching erythema in target shape',
            },
          },
        },
      },
      comment: { 'skin-comment': { label: 'Skin comment', type: 'text' } },
    },
  },
  heart: {
    label: 'Heart',
    components: {
      normal: {
        'regular-rate-and-rhythm-with-no-murmur': {
          label: 'Regular rate and rhythm with no murmur',
          defaultValue: true,
          type: 'checkbox',
        },
        'extremities-are-warm-and-well-perfused': {
          label: 'Extremities are warm and well perfused',
          defaultValue: true,
          type: 'checkbox',
        },
      },
      abnormal: {
        'holosystolic-murmur-best-at-lusb': {
          label: 'I-II/VI holosystolic murmur best at LUSB',
          defaultValue: false,
          type: 'checkbox',
        },
        tachycardia: { label: 'Tachycardia', defaultValue: false, type: 'checkbox' },
      },
      comment: { 'heart-comment': { label: 'Heart comment', type: 'text' } },
    },
  },
  lungs: {
    label: 'Lungs, Chest Wall',
    components: {
      normal: {
        'good-air-movement-throughout-lung-fields': {
          label: 'Good air movement throughout lung fields',
          defaultValue: true,
          type: 'checkbox',
        },
        'no-signs-of-respiratory-distress': {
          label: 'No signs of respiratory distress',
          defaultValue: true,
          type: 'checkbox',
        },
        'chest-is-clear-to-auscultation-bilaterally': {
          label: 'Chest is clear to auscultation bilaterally',
          defaultValue: true,
          type: 'checkbox',
        },
        'no-chest-wall-tenderness': { label: 'No chest wall tenderness', defaultValue: false, type: 'checkbox' },
      },
      abnormal: {
        wheezing: {
          label: 'Wheezing',
          type: 'multi-select',
          options: {
            'wheezing-left-upper': { label: 'Left upper', defaultValue: false },
            'wheezing-left-lower': { label: 'Left lower', defaultValue: false },
            'wheezing-right-upper': { label: 'Right upper', defaultValue: false },
            'wheezing-right-middle': { label: 'Right middle', defaultValue: false },
            'wheezing-right-lower': { label: 'Right lower', defaultValue: false },
          },
        },
        crackles: {
          label: 'Crackles',
          type: 'multi-select',
          options: {
            'crackles-left-upper': { label: 'Left upper', defaultValue: false },
            'crackles-left-lower': { label: 'Left lower', defaultValue: false },
            'crackles-right-upper': { label: 'Right upper', defaultValue: false },
            'crackles-right-middle': { label: 'Right middle', defaultValue: false },
            'crackles-right-lower': { label: 'Right lower', defaultValue: false },
          },
        },
        'breath-sounds': {
          label: 'Decreased breath sounds',
          type: 'multi-select',
          options: {
            'breath-sounds-left-upper': { label: 'Left upper', defaultValue: false },
            'breath-sounds-left-lower': { label: 'Left lower', defaultValue: false },
            'breath-sounds-right-upper': { label: 'Right upper', defaultValue: false },
            'breath-sounds-right-middle': { label: 'Right middle', defaultValue: false },
            'breath-sounds-right-lower': { label: 'Right lower', defaultValue: false },
          },
        },
        retractions: {
          label: 'Retractions',
          type: 'multi-select',
          options: {
            subcostal: { label: 'Subcostal', defaultValue: false },
            suprasternal: { label: 'Suprasternal', defaultValue: false },
            intercostal: { label: 'Intercostal', defaultValue: false },
          },
        },
        tachypnea: { label: 'Tachypnea', defaultValue: false, type: 'checkbox' },
        stridor: { label: 'Stridor', defaultValue: false, type: 'checkbox' },
        'chest-wall-tenderness': { label: 'Chest wall tenderness', defaultValue: false, type: 'checkbox' },
      },
      comment: { 'lungs-comment': { label: 'Lungs comment', type: 'text' } },
    },
  },
  abdomen: {
    label: 'Abdomen',
    components: {
      normal: {
        soft: { label: 'Soft', defaultValue: true, type: 'checkbox' },
        nondistended: { label: 'Nondistended', defaultValue: true, type: 'checkbox' },
        nontender: { label: 'Nontender', defaultValue: true, type: 'checkbox' },
        'no-cva-tenderness': { label: 'No CVA tenderness', defaultValue: false, type: 'checkbox' },
        'no-hepatosplenomegaly': { label: 'No hepatosplenomegaly', defaultValue: false, type: 'checkbox' },
        'hops-with-no-pain': {
          label:
            'Hops with no pain; negative Rovsing’s, psoas, and obturator signs; no rebound tenderness; no guarding',
          defaultValue: false,
          type: 'checkbox',
        },
      },
      abnormal: {
        tender: {
          label: 'Tender',
          type: 'multi-select',
          options: {
            diffusely: { label: 'Diffusely', defaultValue: false },
            ruq: { label: 'RUQ', defaultValue: false },
            rlq: { label: 'RLQ', defaultValue: false },
            luq: { label: 'LUQ', defaultValue: false },
            lll: { label: 'LLL', defaultValue: false },
          },
        },
        hepatomegaly: { label: 'Hepatomegaly', defaultValue: false, type: 'checkbox' },
        splenomegaly: { label: 'Splenomegaly', defaultValue: false, type: 'checkbox' },
        'pain-with-hopping': { label: 'Pain with hopping', defaultValue: false, type: 'checkbox' },
        rebound: { label: 'Rebound', defaultValue: false, type: 'checkbox' },
        guarding: { label: 'Guarding', defaultValue: false, type: 'checkbox' },
      },
      comment: { 'abdomen-comment': { label: 'Abdomen comment', type: 'text' } },
    },
  },
  extremities: {
    label: 'Extremities',
    components: {
      normal: {
        'moves-all-extremities-symmetrically': {
          label: 'Moves all extremities symmetrically',
          defaultValue: true,
          type: 'checkbox',
        },
        'no-obvious-injury-or-swelling': {
          label: 'No obvious injury or swelling',
          defaultValue: true,
          type: 'checkbox',
        },
      },
      abnormal: {
        'swelling-tenderness-decreased-rom': {
          label: 'Swelling, tenderness, decreased ROM',
          defaultValue: false,
          type: 'checkbox',
        },
        'limping-refusal-to-bear-weight': {
          label: 'Limping, refusal to bear weight',
          defaultValue: false,
          type: 'checkbox',
        },
        'point-tenderness-over-bone': { label: 'Point tenderness over bone', defaultValue: false, type: 'checkbox' },
      },
      comment: { 'extremities-comment': { label: 'Extremities comment', type: 'text' } },
    },
  },
  neurologic: {
    label: 'Neurologic',
    components: {
      normal: {
        'normal-mental-status': {
          label: 'Normal mental status',
          defaultValue: true,
          type: 'checkbox',
        },
        'normal-tone': { label: 'Normal tone', defaultValue: true, type: 'checkbox' },
        'oriented-x-3': { label: 'Oriented x 3', defaultValue: false, type: 'checkbox' },
        'normal-reflexes': { label: 'Normal reflexes', defaultValue: false, type: 'checkbox' },
        'cranial-nerves-ii-xii-grossly-intact': {
          label: 'Cranial nerves II-XII grossly intact',
          defaultValue: false,
          type: 'checkbox',
        },
        'normal-sensation': { label: 'Normal sensation', defaultValue: false, type: 'checkbox' },
        'normal-strength': { label: 'Normal strength', defaultValue: false, type: 'checkbox' },
        'follows-verbal-commands-appropriately': {
          label: 'Follows verbal commands appropriately',
          defaultValue: false,
          type: 'checkbox',
        },
      },
      abnormal: {
        confused: { label: 'Confused', defaultValue: false, type: 'checkbox' },
        'unsteady-gait': { label: 'Unsteady gait', defaultValue: false, type: 'checkbox' },
      },
      comment: { 'neurologic-comment': { label: 'Neurologic comment', type: 'text' } },
    },
  },
  psychiatric: {
    label: 'Psychiatric',
    components: {
      normal: {
        'denies-suicidal-homicidal-ideation': {
          label: 'Denies suicidal / homicidal ideation',
          defaultValue: false,
          type: 'checkbox',
        },
        'denies-hallucinations': { label: 'Denies hallucinations', defaultValue: false, type: 'checkbox' },
      },
      abnormal: {
        'suicidal-ideation': { label: 'Suicidal ideation', defaultValue: false, type: 'checkbox' },
        'poor-judgement': { label: 'Poor judgement', defaultValue: false, type: 'checkbox' },
      },
      comment: { 'psychiatric-comment': { label: 'Psychiatric comment', type: 'text' } },
    },
  },
  rectal: {
    label: 'GU, Rectal',
    components: {
      normal: {
        'normal-external-genital-exam': {
          label: 'Normal external genital exam, no lesions / redness / discharge',
          defaultValue: false,
          type: 'checkbox',
        },
        'normal-external-rectal-exam': { label: 'Normal external rectal exam', defaultValue: false, type: 'checkbox' },
        'normal-testicular-exam': {
          label: 'Normal testicular exam, no tenderness, no erythema, creamsteric reflexes present',
          defaultValue: false,
          type: 'checkbox',
        },
      },
      abnormal: {
        'scrotal-edema-swelling': { label: 'Scrotal edema / swelling', defaultValue: false, type: 'checkbox' },
        'right-side-absent-cremasteric-reflex': {
          label: 'Right side - absent cremasteric reflex',
          defaultValue: false,
          type: 'checkbox',
        },
        'left-side-absent-cremasteric-reflex': {
          label: 'Left side - absent cremasteric reflex',
          defaultValue: false,
          type: 'checkbox',
        },
      },
      comment: { 'rectal-comment': { label: 'Rectal comment', type: 'text' } },
    },
  },
};
