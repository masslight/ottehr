import { createCodeableConcept } from '../../api';

export const InPersonExamConfig = {
  general: {
    label: 'General',
    components: {
      normal: {
        'well-appearing': {
          label: 'Well appearing',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Well appearing'),
        },
        'well-nourished': {
          label: 'Well nourished',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Well nourished'),
        },
        'in-no-distress': {
          label: 'In no distress',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '69328002',
                display: 'Distress (finding)',
              },
            ],
            'Distress (finding)'
          ),
        },
        'oriented-general': {
          label: 'Oriented x 3',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Oriented x 3'),
        },
        'general-normal-mood-and-affect': {
          label: 'Normal mood and affect',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '134417007',
                display: 'Level of mood - normal (finding)',
              },
            ],
            'Level of mood - normal (finding)'
          ),
        },
        'ambulating-without-difficulty': {
          label: 'Ambulating without difficulty',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Ambulating without difficulty'),
        },
      },
      abnormal: {
        'abnormal-general': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'general-comment': {
          label: 'General comment',
          type: 'text',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '38266002',
                display: 'Entire body as a whole (body structure)',
              },
            ],
            'Entire body as a whole (body structure)'
          ),
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
          code: createCodeableConcept(undefined, 'Good turgor'),
        },
        'no-rash-unusual-bruising-or-prominent-lesions': {
          label: 'No rash, unusual bruising or prominent lesions',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '225544001',
                display: 'Skin appearance normal (finding)',
              },
            ],
            'Skin appearance normal (finding)'
          ),
          bodySite: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '225544001',
                display: 'Skin appearance normal (finding)',
              },
            ],
            'Skin appearance normal (finding)'
          ),
        },
      },
      abnormal: {
        'abnormal-skin': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'skin-comment': {
          label: 'Skin comment',
          type: 'text',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '106076001',
                display: 'Skin finding (finding)',
              },
            ],
            'Skin finding (finding)'
          ),
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
          code: createCodeableConcept(undefined, 'Normal texture and distribution'),
        },
      },
      abnormal: {
        'abnormal-hair': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'hair-comment': {
          label: 'Hair comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Hair comment'),
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
          code: createCodeableConcept(undefined, 'Normal color, no deformities'),
        },
      },
      abnormal: {
        'abnormal-nails': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'nails-comment': {
          label: 'Nails comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Nails comment'),
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
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '17621005',
                display: 'Normal (qualifier value)',
              },
            ],
            'Normal (qualifier value)'
          ),
          bodySite: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '17621005',
                display: 'Normal (qualifier value)',
              },
            ],
            'Normal (qualifier value)'
          ),
        },
        atraumatic: {
          label: 'Atraumatic',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '1149217004',
                display: 'No traumatic injury (situation)',
              },
            ],
            'No traumatic injury (situation)'
          ),
          bodySite: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '1149217004',
                display: 'No traumatic injury (situation)',
              },
            ],
            'No traumatic injury (situation)'
          ),
        },
        'no-visible-or-palpable-masses-depressions-or-scaring': {
          label: 'No visible or palpable masses, depressions, or scaring',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'No visible or palpable masses, depressions, or scaring'),
        },
      },
      abnormal: {
        'abnormal-head': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'head-comment': {
          label: 'Head comment',
          type: 'text',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '298364001',
                display: 'Finding of head region (finding)',
              },
            ],
            'Finding of head region (finding)'
          ),
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
          code: createCodeableConcept(undefined, 'Eyes'),
        },
        'conjunctiva-clear': {
          label: 'Conjunctiva clear',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Conjunctiva clear'),
        },
        'sclera-non-icteric': {
          label: 'Sclera non-icteric',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Sclera non-icteric'),
        },
        'eom-intact': {
          label: 'EOM intact',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'EOM intact'),
        },
        perrl: {
          label: 'PERRL',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'PERRL'),
        },
        'fundi-have-normal-optic-discs-and-vessels': {
          label: 'Fundi have normal optic discs and vessels',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Fundi have normal optic discs and vessels'),
        },
        'no-exudates-or-hemorrhages': {
          label: 'No exudates or hemorrhages',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'No exudates or hemorrhages'),
        },
      },
      abnormal: {
        'abnormal-eyes': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'eyes-comment': {
          label: 'Eyes comment',
          type: 'text',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '118235002',
                display: 'Eye / vision finding (finding)',
              },
            ],
            'Eye / vision finding (finding)'
          ),
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
          code: createCodeableConcept(undefined, 'Ears'),
        },
        'tms-translucent-mobile': {
          label: 'TMs translucent & mobile',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'TMs translucent & mobile'),
        },
        'ossicles-nl-appearance': {
          label: 'Ossicles nl appearance',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Ossicles nl appearance'),
        },
        'hearing-intact': {
          label: 'Hearing intact',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Hearing intact'),
        },
      },
      abnormal: {
        'abnormal-ears': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'ears-comment': {
          label: 'Ears comment',
          type: 'text',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '247234006',
                display: 'Ear finding (finding)',
              },
            ],
            'Ear finding (finding)'
          ),
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
          code: createCodeableConcept(undefined, 'Nose'),
        },
        'nose-mucosa-non-inflamed': {
          label: 'Mucosa non-inflamed',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Mucosa non-inflamed'),
        },
        'septum-and-turbinates-normal': {
          label: 'Septum and turbinates normal',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Septum and turbinates normal'),
        },
      },
      abnormal: {
        'abnormal-nose': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'nose-comment': {
          label: 'Nose comment',
          type: 'text',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '118237005',
                display: 'Nose finding (finding)',
              },
            ],
            'Nose finding (finding)'
          ),
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
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '276398005',
                display: 'Moist oral mucosa (finding)',
              },
            ],
            'Moist oral mucosa (finding)'
          ),
          bodySite: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '276398005',
                display: 'Moist oral mucosa (finding)',
              },
            ],
            'Moist oral mucosa (finding)'
          ),
        },
        'no-mucosal-lesions': {
          label: 'No mucosal lesions',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'No mucosal lesions'),
        },
      },
      abnormal: {
        'abnormal-mouth': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'mouth-comment': {
          label: 'Mouth comment',
          type: 'text',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '423066003',
                display: 'Finding of mouth region (finding)',
              },
            ],
            'Finding of mouth region (finding)'
          ),
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
          code: createCodeableConcept(undefined, 'Teeth'),
        },
        'no-gingival-inflammation-or-significant-resorption': {
          label: 'No gingival inflammation or significant resorption',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'No gingival inflammation or significant resorption'),
        },
      },
      abnormal: {
        'abnormal-teeth': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'teeth-comment': {
          label: 'Teeth comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Teeth comment'),
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
          code: createCodeableConcept(undefined, 'Pharynx'),
        },
        'no-tonsillar-hypertrophy-or-exudate': {
          label: 'No tonsillar hypertrophy or exudate',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'No tonsillar hypertrophy or exudate'),
        },
      },
      abnormal: {
        'abnormal-pharynx': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'pharynx-comment': {
          label: 'Pharynx comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Pharynx comment'),
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
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '48162006',
                display: 'Supple (qualifier value)',
              },
            ],
            'Supple (qualifier value)'
          ),
          bodySite: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '48162006',
                display: 'Supple (qualifier value)',
              },
            ],
            'Supple (qualifier value)'
          ),
        },
        'without-lesions-bruits-or-adenopathy': {
          label: 'Without lesions, bruits, or adenopathy',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Without lesions, bruits, or adenopathy'),
        },
        'thyroid-non-enlarged-and-non-tender': {
          label: 'Thyroid non-enlarged and non-tender',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Thyroid non-enlarged and non-tender'),
        },
      },
      abnormal: {
        'abnormal-neck': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'neck-comment': {
          label: 'Neck comment',
          type: 'text',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '298378000',
                display: 'Finding of neck region (finding)',
              },
            ],
            'Finding of neck region (finding)'
          ),
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
          code: createCodeableConcept(undefined, 'Heart'),
        },
        'regular-rate-and-rhythm': {
          label: 'Regular rate and rhythm',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Regular rate and rhythm'),
        },
        'no-murmur-or-gallop': {
          label: 'No murmur or gallop',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'No murmur or gallop'),
        },
      },
      abnormal: {
        'abnormal-heart': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'heart-comment': {
          label: 'Heart comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Heart comment'),
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
          code: createCodeableConcept(undefined, 'Lungs'),
        },
        'pulmonary-effort-is-normal': {
          label: 'Pulmonary effort is normal',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Pulmonary effort is normal'),
        },
        'no-respiratory-distress': {
          label: 'No respiratory distress',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'No respiratory distress'),
        },
        'there-are-no-wheezing': {
          label: 'There are no wheezing',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'There are no wheezing'),
        },
        'there-are-no-rales': {
          label: 'There are no rales',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'There are no rales'),
        },
      },
      abnormal: {
        'abnormal-lungs': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'lungs-comment': {
          label: 'Lungs comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Lungs comment'),
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
          code: createCodeableConcept(undefined, 'Abdomen'),
        },
        'bowel-sounds-normal': {
          label: 'Bowel sounds normal',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Bowel sounds normal'),
        },
        'no-tenderness-organomegaly-masses-or-hernia': {
          label: 'No tenderness, organomegaly, masses, or hernia',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '297125009',
                display: 'Abdominal tenderness absent (situation)',
              },
            ],
            'Abdominal tenderness absent (situation)'
          ),
          bodySite: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '297125009',
                display: 'Abdominal tenderness absent (situation)',
              },
            ],
            'Abdominal tenderness absent (situation)'
          ),
        },
      },
      abnormal: {
        'abnormal-abdomen': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'abdomen-comment': {
          label: 'Abdomen comment',
          type: 'text',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '609624008',
                display: 'Finding of abdomen (finding)',
              },
            ],
            'Finding of abdomen (finding)'
          ),
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
          code: createCodeableConcept(undefined, 'Back'),
        },
        'no-cva-tenderness': {
          label: 'No CVA tenderness',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'No CVA tenderness'),
        },
      },
      abnormal: {
        'abnormal-back': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'back-comment': {
          label: 'Back comment',
          type: 'text',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '414252009',
                display: 'Finding of back (finding)',
              },
            ],
            'Finding of back (finding)'
          ),
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
          code: createCodeableConcept(undefined, 'Rectal'),
        },
        'no-hemorrhoids-or-masses-palpable': {
          label: 'No hemorrhoids or masses palpable',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'No hemorrhoids or masses palpable'),
        },
      },
      abnormal: {
        'abnormal-rectal': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'rectal-comment': {
          label: 'Rectal comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Rectal comment'),
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
          code: createCodeableConcept(undefined, 'Extremities'),
        },
        'peripheral-pulses-intact': {
          label: 'Peripheral pulses intact',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Peripheral pulses intact'),
        },
      },
      abnormal: {
        'abnormal-extremities': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'extremities-comment': {
          label: 'Extremities comment',
          type: 'text',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '106028002',
                display: 'Musculoskeletal finding (finding)',
              },
            ],
            'Musculoskeletal finding (finding)'
          ),
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
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '8117002',
                display: 'Gait normal (finding)',
              },
            ],
            'Gait normal (finding)'
          ),
          bodySite: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '8117002',
                display: 'Gait normal (finding)',
              },
            ],
            'Gait normal (finding)'
          ),
        },
        'no-misalignment': {
          label:
            'No misalignment, asymmetry, crepitation, defects, tenderness, masses, effusions, decreased range of motion, instability, atrophy or abnormal strength or tone in the head, neck, spine, ribs, pelvis or extremities.',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Normal gait and station'),
        },
      },
      abnormal: {
        'abnormal-musculoskeletal': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'musculoskeletal-comment': {
          label: 'Musculoskeletal comment',
          type: 'text',
          code: createCodeableConcept(undefined, 'Musculoskeletal comment'),
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
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '17326005',
                display: 'Well in self (finding)',
              },
            ],
            'Well in self (finding)'
          ),
        },
        'cn-2-12-normal': {
          label: 'CN 2-12 normal',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'CN 2-12 normal'),
        },
        'sensation-to-pain-touch-and-proprioception-normal': {
          label: 'Sensation to pain, touch, and proprioception normal',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Sensation to pain, touch, and proprioception normal'),
        },
        'dtrs-normal-in-upper-and-lower-extremities': {
          label: 'DTRs normal in upper and lower extremities',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'DTRs normal in upper and lower extremities'),
        },
        'no-pathologic-reflexes': {
          label: 'No pathologic reflexes',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'No pathologic reflexes'),
        },
      },
      abnormal: {
        'abnormal-neurologic': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'neurologic-comment': {
          label: 'Neurologic comment',
          type: 'text',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '102957003',
                display: 'Neurological finding (finding)',
              },
            ],
            'Neurological finding (finding)'
          ),
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
          code: createCodeableConcept(undefined, 'Psychiatric'),
        },
        'intact-recent-and-remote-memory-judgment-and-insight': {
          label: 'Intact recent and remote memory, judgment and insight',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Intact recent and remote memory, judgment and insight'),
        },
        'psychiatric-normal-mood-and-affect': {
          label: 'Normal mood and affect',
          defaultValue: true,
          type: 'checkbox',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '134417007',
                display: 'Level of mood - normal (finding)',
              },
            ],
            'Level of mood - normal (finding)'
          ),
        },
      },
      abnormal: {
        'abnormal-psychiatric': {
          label: 'Abnormal',
          defaultValue: false,
          type: 'checkbox',
          code: createCodeableConcept(undefined, 'Abnormal'),
        },
      },
      comment: {
        'psychiatric-comment': {
          label: 'Psychiatric comment',
          type: 'text',
          code: createCodeableConcept(
            [
              {
                system: 'http://snomed.info/sct',
                code: '116367006',
                display: 'Psychological finding (finding)',
              },
            ],
            'Psychological finding (finding)'
          ),
        },
      },
    },
  },
};
