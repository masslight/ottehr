type ModalExamOption = { label: string; defaultValue: boolean };
type ModalExamGroup = { label: string; options: Record<string, ModalExamOption> };
type ModalExamSection = { label: string; groups: Record<string, ModalExamGroup> };

type SpecialTestsBuilder = (k: (suffix: string) => string) => Record<string, ModalExamGroup>;

function createExtremityModalExam(
  partKey: string,
  partLabel: string,
  specialTestsBuilder?: SpecialTestsBuilder
): {
  label: string;
  defaultValue: boolean;
  type: 'modal-exam';
  sections: Record<string, ModalExamSection>;
} {
  const k = (suffix: string): string => `${partKey}-${suffix}`;
  const sections: Record<string, ModalExamSection> = {
    inspection: {
      label: 'Inspection',
      groups: {
        appearance: {
          label: 'Appearance',
          options: {
            [k('appearance-normal')]: { label: 'Normal', defaultValue: false },
            [k('appearance-swelling')]: { label: 'Swelling', defaultValue: false },
            [k('appearance-deformity')]: { label: 'Deformity', defaultValue: false },
            [k('appearance-atrophy')]: { label: 'Atrophy', defaultValue: false },
          },
        },
        skin: {
          label: 'Skin',
          options: {
            [k('skin-normal')]: { label: 'Normal', defaultValue: false },
            [k('skin-erythema')]: { label: 'Erythema', defaultValue: false },
            [k('skin-ecchymosis')]: { label: 'Ecchymosis', defaultValue: false },
            [k('skin-wound')]: { label: 'Wound', defaultValue: false },
          },
        },
        alignment: {
          label: 'Alignment',
          options: {
            [k('alignment-normal')]: { label: 'Normal', defaultValue: false },
            [k('alignment-angulation')]: { label: 'Angulation', defaultValue: false },
            [k('alignment-shortening')]: { label: 'Shortening', defaultValue: false },
          },
        },
        'cast-splint': {
          label: 'Cast/splint',
          options: {
            [k('cast-not-present')]: { label: 'Not present', defaultValue: false },
            [k('cast-splint-in-place')]: { label: 'Splint in place', defaultValue: false },
            [k('cast-cast-in-place')]: { label: 'Cast in place', defaultValue: false },
          },
        },
      },
    },
    palpation: {
      label: 'Palpation',
      groups: {
        tenderness: {
          label: 'Tenderness',
          options: {
            [k('tenderness-none')]: { label: 'None', defaultValue: false },
            [k('tenderness-bony')]: { label: 'Bony', defaultValue: false },
            [k('tenderness-joint')]: { label: 'Joint', defaultValue: false },
            [k('tenderness-soft-tissue')]: { label: 'Soft tissue', defaultValue: false },
          },
        },
        crepitus: {
          label: 'Crepitus',
          options: {
            [k('crepitus-absent')]: { label: 'Absent', defaultValue: false },
            [k('crepitus-present')]: { label: 'Present', defaultValue: false },
          },
        },
        temperature: {
          label: 'Temperature',
          options: {
            [k('temperature-normal')]: { label: 'Normal', defaultValue: false },
            [k('temperature-warm')]: { label: 'Warm', defaultValue: false },
            [k('temperature-cool')]: { label: 'Cool', defaultValue: false },
          },
        },
        edema: {
          label: 'Edema',
          options: {
            [k('edema-none')]: { label: 'None', defaultValue: false },
            [k('edema-pitting')]: { label: 'Pitting', defaultValue: false },
            [k('edema-non-pitting')]: { label: 'Non-pitting', defaultValue: false },
          },
        },
      },
    },
    'range-of-motion': {
      label: 'Range of Motion',
      groups: {
        'active-rom': {
          label: 'Active ROM',
          options: {
            [k('active-rom-full')]: { label: 'Full', defaultValue: false },
            [k('active-rom-limited')]: { label: 'Limited', defaultValue: false },
            [k('active-rom-unable')]: { label: 'Unable', defaultValue: false },
          },
        },
        'passive-rom': {
          label: 'Passive ROM',
          options: {
            [k('passive-rom-full')]: { label: 'Full', defaultValue: false },
            [k('passive-rom-limited')]: { label: 'Limited', defaultValue: false },
            [k('passive-rom-painful-arc')]: { label: 'Painful arc', defaultValue: false },
          },
        },
        'pain-with-motion': {
          label: 'Pain with motion',
          options: {
            [k('pain-motion-none')]: { label: 'None', defaultValue: false },
            [k('pain-motion-active-only')]: { label: 'Active only', defaultValue: false },
            [k('pain-motion-passive-only')]: { label: 'Passive only', defaultValue: false },
            [k('pain-motion-both')]: { label: 'Both', defaultValue: false },
          },
        },
      },
    },
    neurovascular: {
      label: 'Neurovascular',
      groups: {
        pulses: {
          label: 'Pulses',
          options: {
            [k('pulses-2-plus-normal')]: { label: '2+ normal', defaultValue: false },
            [k('pulses-1-plus-diminished')]: { label: '1+ diminished', defaultValue: false },
            [k('pulses-absent')]: { label: 'Absent', defaultValue: false },
          },
        },
        'cap-refill': {
          label: 'Cap refill',
          options: {
            [k('cap-refill-less-2s')]: { label: '<2s', defaultValue: false },
            [k('cap-refill-2-3s')]: { label: '2\u20133s', defaultValue: false },
            [k('cap-refill-greater-3s')]: { label: '>3s', defaultValue: false },
          },
        },
        sensation: {
          label: 'Sensation',
          options: {
            [k('sensation-intact')]: { label: 'Intact', defaultValue: false },
            [k('sensation-decreased')]: { label: 'Decreased', defaultValue: false },
            [k('sensation-absent')]: { label: 'Absent', defaultValue: false },
            [k('sensation-paresthesia')]: { label: 'Paresthesia', defaultValue: false },
          },
        },
        'motor-strength': {
          label: 'Motor strength',
          options: {
            [k('motor-5-5')]: { label: '5/5', defaultValue: false },
            [k('motor-4-5')]: { label: '4/5', defaultValue: false },
            [k('motor-3-5')]: { label: '3/5', defaultValue: false },
            [k('motor-lte-2-5')]: { label: '\u22642/5', defaultValue: false },
          },
        },
      },
    },
  };
  if (specialTestsBuilder) {
    sections['special-tests'] = {
      label: 'Special Tests',
      groups: specialTestsBuilder(k),
    };
  }
  return {
    label: partLabel,
    defaultValue: false,
    type: 'modal-exam' as const,
    sections,
  };
}

const shoulderSpecialTests: SpecialTestsBuilder = (k) => ({
  'hawkins-kennedy': {
    label: 'Hawkins-Kennedy',
    options: {
      [k('hawkins-neg')]: { label: 'Neg', defaultValue: false },
      [k('hawkins-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
  'empty-can': {
    label: 'Empty can',
    options: {
      [k('empty-can-neg')]: { label: 'Neg', defaultValue: false },
      [k('empty-can-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
  speeds: {
    label: "Speed's",
    options: {
      [k('speeds-neg')]: { label: 'Neg', defaultValue: false },
      [k('speeds-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
  'drop-arm': {
    label: 'Drop arm',
    options: {
      [k('drop-arm-neg')]: { label: 'Neg', defaultValue: false },
      [k('drop-arm-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
  'ac-joint-tenderness': {
    label: 'AC joint tenderness',
    options: {
      [k('ac-joint-absent')]: { label: 'Absent', defaultValue: false },
      [k('ac-joint-present')]: { label: 'Present', defaultValue: false },
    },
  },
  instability: {
    label: 'Instability',
    options: {
      [k('instability-none')]: { label: 'None', defaultValue: false },
      [k('instability-anterior')]: { label: 'Anterior', defaultValue: false },
      [k('instability-posterior')]: { label: 'Posterior', defaultValue: false },
      [k('instability-multidirectional')]: { label: 'Multidirectional', defaultValue: false },
    },
  },
});

const elbowSpecialTests: SpecialTestsBuilder = (k) => ({
  'lateral-epicondyle': {
    label: 'Lateral epicondyle tenderness',
    options: {
      [k('lat-epicondyle-absent')]: { label: 'Absent', defaultValue: false },
      [k('lat-epicondyle-present')]: { label: 'Present', defaultValue: false },
    },
  },
  'medial-epicondyle': {
    label: 'Medial epicondyle tenderness',
    options: {
      [k('med-epicondyle-absent')]: { label: 'Absent', defaultValue: false },
      [k('med-epicondyle-present')]: { label: 'Present', defaultValue: false },
    },
  },
  'valgus-stress': {
    label: 'Valgus stress',
    options: {
      [k('valgus-stable')]: { label: 'Stable', defaultValue: false },
      [k('valgus-lax')]: { label: 'Lax', defaultValue: false },
    },
  },
  'carrying-angle': {
    label: 'Carrying angle',
    options: {
      [k('carrying-angle-normal')]: { label: 'Normal', defaultValue: false },
      [k('carrying-angle-increased')]: { label: 'Increased', defaultValue: false },
    },
  },
  'tinels-cubital': {
    label: "Tinel's at cubital tunnel",
    options: {
      [k('tinels-cubital-neg')]: { label: 'Neg', defaultValue: false },
      [k('tinels-cubital-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
});

const wristSpecialTests: SpecialTestsBuilder = (k) => ({
  'snuffbox-tenderness': {
    label: 'Anatomical snuffbox tenderness',
    options: {
      [k('snuffbox-absent')]: { label: 'Absent', defaultValue: false },
      [k('snuffbox-present')]: { label: 'Present', defaultValue: false },
    },
  },
  finkelstein: {
    label: 'Finkelstein',
    options: {
      [k('finkelstein-neg')]: { label: 'Neg', defaultValue: false },
      [k('finkelstein-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
  phalens: {
    label: "Phalen's",
    options: {
      [k('phalens-neg')]: { label: 'Neg', defaultValue: false },
      [k('phalens-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
  tinels: {
    label: "Tinel's at carpal tunnel",
    options: {
      [k('tinels-neg')]: { label: 'Neg', defaultValue: false },
      [k('tinels-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
  'grip-strength': {
    label: 'Grip strength',
    options: {
      [k('grip-normal')]: { label: 'Normal', defaultValue: false },
      [k('grip-reduced')]: { label: 'Reduced', defaultValue: false },
    },
  },
  'finger-rom': {
    label: 'Finger ROM',
    options: {
      [k('finger-rom-full')]: { label: 'Full', defaultValue: false },
      [k('finger-rom-limited')]: { label: 'Limited', defaultValue: false },
    },
  },
});

const handFingerSpecialTests: SpecialTestsBuilder = (k) => ({
  'fingers-affected': {
    label: 'Finger(s) affected',
    options: {
      [k('finger-thumb')]: { label: 'Thumb', defaultValue: false },
      [k('finger-index')]: { label: 'Index', defaultValue: false },
      [k('finger-middle')]: { label: 'Middle', defaultValue: false },
      [k('finger-ring')]: { label: 'Ring', defaultValue: false },
      [k('finger-little')]: { label: 'Little', defaultValue: false },
    },
  },
  'dip-tenderness': {
    label: 'DIP tenderness',
    options: {
      [k('dip-tenderness-none')]: { label: 'None', defaultValue: false },
      [k('dip-tenderness-present')]: { label: 'Present', defaultValue: false },
    },
  },
  'pip-tenderness': {
    label: 'PIP tenderness',
    options: {
      [k('pip-tenderness-none')]: { label: 'None', defaultValue: false },
      [k('pip-tenderness-present')]: { label: 'Present', defaultValue: false },
    },
  },
  'mcp-tenderness': {
    label: 'MCP tenderness',
    options: {
      [k('mcp-tenderness-none')]: { label: 'None', defaultValue: false },
      [k('mcp-tenderness-present')]: { label: 'Present', defaultValue: false },
    },
  },
  'dip-swelling': {
    label: 'DIP swelling',
    options: {
      [k('dip-swelling-none')]: { label: 'None', defaultValue: false },
      [k('dip-swelling-present')]: { label: 'Present', defaultValue: false },
    },
  },
  'pip-swelling': {
    label: 'PIP swelling',
    options: {
      [k('pip-swelling-none')]: { label: 'None', defaultValue: false },
      [k('pip-swelling-present')]: { label: 'Present', defaultValue: false },
    },
  },
  'mcp-swelling': {
    label: 'MCP swelling',
    options: {
      [k('mcp-swelling-none')]: { label: 'None', defaultValue: false },
      [k('mcp-swelling-present')]: { label: 'Present', defaultValue: false },
    },
  },
  'dip-rom': {
    label: 'DIP ROM',
    options: {
      [k('dip-rom-full')]: { label: 'Full', defaultValue: false },
      [k('dip-rom-limited')]: { label: 'Limited', defaultValue: false },
      [k('dip-rom-unable')]: { label: 'Unable', defaultValue: false },
    },
  },
  'pip-rom': {
    label: 'PIP ROM',
    options: {
      [k('pip-rom-full')]: { label: 'Full', defaultValue: false },
      [k('pip-rom-limited')]: { label: 'Limited', defaultValue: false },
      [k('pip-rom-unable')]: { label: 'Unable', defaultValue: false },
    },
  },
  'mcp-rom': {
    label: 'MCP ROM',
    options: {
      [k('mcp-rom-full')]: { label: 'Full', defaultValue: false },
      [k('mcp-rom-limited')]: { label: 'Limited', defaultValue: false },
      [k('mcp-rom-unable')]: { label: 'Unable', defaultValue: false },
    },
  },
  'dip-stability': {
    label: 'DIP stability',
    options: {
      [k('dip-stability-stable')]: { label: 'Stable', defaultValue: false },
      [k('dip-stability-lax-radial')]: { label: 'Lax \u2014 Radial', defaultValue: false },
      [k('dip-stability-lax-ulnar')]: { label: 'Lax \u2014 Ulnar', defaultValue: false },
    },
  },
  'pip-stability': {
    label: 'PIP stability',
    options: {
      [k('pip-stability-stable')]: { label: 'Stable', defaultValue: false },
      [k('pip-stability-lax-radial')]: { label: 'Lax \u2014 Radial', defaultValue: false },
      [k('pip-stability-lax-ulnar')]: { label: 'Lax \u2014 Ulnar', defaultValue: false },
    },
  },
  'mcp-stability': {
    label: 'MCP stability',
    options: {
      [k('mcp-stability-stable')]: { label: 'Stable', defaultValue: false },
      [k('mcp-stability-lax-radial')]: { label: 'Lax \u2014 Radial', defaultValue: false },
      [k('mcp-stability-lax-ulnar')]: { label: 'Lax \u2014 Ulnar', defaultValue: false },
    },
  },
  'dip-deformity': {
    label: 'DIP deformity',
    options: {
      [k('dip-deformity-none')]: { label: 'None', defaultValue: false },
      [k('dip-deformity-mallet')]: { label: 'Mallet', defaultValue: false },
      [k('dip-deformity-boutonniere')]: { label: 'Boutonni\u00e8re', defaultValue: false },
    },
  },
  'pip-deformity': {
    label: 'PIP deformity',
    options: {
      [k('pip-deformity-none')]: { label: 'None', defaultValue: false },
      [k('pip-deformity-mallet')]: { label: 'Mallet', defaultValue: false },
      [k('pip-deformity-boutonniere')]: { label: 'Boutonni\u00e8re', defaultValue: false },
    },
  },
  'mcp-deformity': {
    label: 'MCP deformity',
    options: {
      [k('mcp-deformity-none')]: { label: 'None', defaultValue: false },
      [k('mcp-deformity-dislocation')]: { label: 'Dislocation', defaultValue: false },
    },
  },
  'extensor-tendon': {
    label: 'Extensor tendon integrity',
    options: {
      [k('extensor-intact')]: { label: 'Intact', defaultValue: false },
      [k('extensor-suspected-rupture')]: { label: 'Suspected rupture', defaultValue: false },
    },
  },
  'flexor-tendon': {
    label: 'Flexor tendon integrity',
    options: {
      [k('flexor-intact')]: { label: 'Intact', defaultValue: false },
      [k('flexor-suspected-rupture')]: { label: 'Suspected rupture', defaultValue: false },
    },
  },
  'subungual-hematoma': {
    label: 'Subungual hematoma',
    options: {
      [k('subungual-absent')]: { label: 'Absent', defaultValue: false },
      [k('subungual-lt-25')]: { label: '<25%', defaultValue: false },
      [k('subungual-25-50')]: { label: '25\u201350%', defaultValue: false },
      [k('subungual-gt-50')]: { label: '>50% nail bed', defaultValue: false },
    },
  },
  trephination: {
    label: 'Trephination',
    options: {
      [k('trephination-no')]: { label: 'No', defaultValue: false },
      [k('trephination-yes')]: { label: 'Yes', defaultValue: false },
    },
  },
});

const kneeSpecialTests: SpecialTestsBuilder = (k) => ({
  lachman: {
    label: 'Lachman',
    options: {
      [k('lachman-neg')]: { label: 'Neg', defaultValue: false },
      [k('lachman-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
  'anterior-drawer': {
    label: 'Anterior drawer',
    options: {
      [k('anterior-drawer-neg')]: { label: 'Neg', defaultValue: false },
      [k('anterior-drawer-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
  'posterior-drawer': {
    label: 'Posterior drawer',
    options: {
      [k('posterior-drawer-neg')]: { label: 'Neg', defaultValue: false },
      [k('posterior-drawer-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
  mcmurray: {
    label: 'McMurray',
    options: {
      [k('mcmurray-neg')]: { label: 'Neg', defaultValue: false },
      [k('mcmurray-pos-medial')]: { label: 'Pos \u2014 Medial', defaultValue: false },
      [k('mcmurray-pos-lateral')]: { label: 'Pos \u2014 Lateral', defaultValue: false },
    },
  },
  'valgus-stress': {
    label: 'Valgus stress',
    options: {
      [k('valgus-stable')]: { label: 'Stable', defaultValue: false },
      [k('valgus-lax')]: { label: 'Lax', defaultValue: false },
    },
  },
  'varus-stress': {
    label: 'Varus stress',
    options: {
      [k('varus-stable')]: { label: 'Stable', defaultValue: false },
      [k('varus-lax')]: { label: 'Lax', defaultValue: false },
    },
  },
  'patellar-grind': {
    label: 'Patellar grind',
    options: {
      [k('patellar-grind-neg')]: { label: 'Neg', defaultValue: false },
      [k('patellar-grind-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
  effusion: {
    label: 'Effusion',
    options: {
      [k('effusion-none')]: { label: 'None', defaultValue: false },
      [k('effusion-present')]: { label: 'Present', defaultValue: false },
      [k('effusion-ballottement')]: { label: 'Ballottement', defaultValue: false },
      [k('effusion-bulge-sign')]: { label: 'Bulge sign', defaultValue: false },
    },
  },
});

const ankleSpecialTests: SpecialTestsBuilder = (k) => ({
  'anterior-drawer': {
    label: 'Anterior drawer',
    options: {
      [k('anterior-drawer-neg')]: { label: 'Neg', defaultValue: false },
      [k('anterior-drawer-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
  'talar-tilt': {
    label: 'Talar tilt',
    options: {
      [k('talar-tilt-neg')]: { label: 'Neg', defaultValue: false },
      [k('talar-tilt-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
  'squeeze-test': {
    label: 'Squeeze test (syndesmosis)',
    options: {
      [k('squeeze-neg')]: { label: 'Neg', defaultValue: false },
      [k('squeeze-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
  'thompson-test': {
    label: 'Thompson test',
    options: {
      [k('thompson-neg')]: { label: 'Neg', defaultValue: false },
      [k('thompson-pos')]: { label: 'Pos', defaultValue: false },
    },
  },
});

const footToeSpecialTests: SpecialTestsBuilder = (k) => ({
  'toes-affected': {
    label: 'Toe(s) affected',
    options: {
      [k('toe-hallux')]: { label: 'Hallux', defaultValue: false },
      [k('toe-2nd')]: { label: '2nd', defaultValue: false },
      [k('toe-3rd')]: { label: '3rd', defaultValue: false },
      [k('toe-4th')]: { label: '4th', defaultValue: false },
      [k('toe-5th')]: { label: '5th', defaultValue: false },
    },
  },
  'midfoot-tenderness': {
    label: 'Midfoot tenderness',
    options: {
      [k('midfoot-none')]: { label: 'None', defaultValue: false },
      [k('midfoot-navicular')]: { label: 'Navicular', defaultValue: false },
      [k('midfoot-5th-met-base')]: { label: '5th metatarsal base', defaultValue: false },
    },
  },
  'plantar-fascia': {
    label: 'Plantar fascia',
    options: {
      [k('plantar-normal')]: { label: 'Normal', defaultValue: false },
      [k('plantar-tender')]: { label: 'Tender', defaultValue: false },
    },
  },
  'subungual-hematoma': {
    label: 'Subungual hematoma',
    options: {
      [k('subungual-absent')]: { label: 'Absent', defaultValue: false },
      [k('subungual-lt-25')]: { label: '<25%', defaultValue: false },
      [k('subungual-25-50')]: { label: '25\u201350%', defaultValue: false },
      [k('subungual-gt-50')]: { label: '>50% nail bed', defaultValue: false },
    },
  },
  'nail-integrity': {
    label: 'Nail integrity',
    options: {
      [k('nail-intact')]: { label: 'Intact', defaultValue: false },
      [k('nail-avulsion')]: { label: 'Avulsion', defaultValue: false },
      [k('nail-partial-avulsion')]: { label: 'Partial avulsion', defaultValue: false },
    },
  },
  'tuft-fracture': {
    label: 'Tuft fracture suspected',
    options: {
      [k('tuft-no')]: { label: 'No', defaultValue: false },
      [k('tuft-yes-toe-series')]: { label: 'Yes \u2192 order: Toe series', defaultValue: false },
    },
  },
});

function createLymphNodeModalExam(
  nodeKey: string,
  nodeLabel: string
): {
  label: string;
  defaultValue: boolean;
  type: 'modal-exam';
  sections: Record<string, ModalExamSection>;
} {
  const k = (suffix: string): string => `${nodeKey}-${suffix}`;
  return {
    label: nodeLabel,
    defaultValue: false,
    type: 'modal-exam' as const,
    sections: {
      status: {
        label: 'Status',
        groups: {
          status: {
            label: 'Status',
            options: {
              [k('normal')]: { label: 'Normal', defaultValue: false },
              [k('enlarged')]: { label: 'Enlarged', defaultValue: false },
              [k('tender')]: { label: 'Tender', defaultValue: false },
            },
          },
        },
      },
      'node-characteristics': {
        label: 'Node Characteristics',
        groups: {
          size: {
            label: 'Size',
            options: {
              [k('size-lt-1cm')]: { label: '<1cm', defaultValue: false },
              [k('size-1-2cm')]: { label: '1\u20132cm', defaultValue: false },
              [k('size-gt-2cm')]: { label: '>2cm', defaultValue: false },
            },
          },
          texture: {
            label: 'Texture',
            options: {
              [k('texture-soft')]: { label: 'Soft', defaultValue: false },
              [k('texture-firm')]: { label: 'Firm', defaultValue: false },
              [k('texture-hard')]: { label: 'Hard', defaultValue: false },
              [k('texture-matted')]: { label: 'Matted', defaultValue: false },
            },
          },
          mobility: {
            label: 'Mobility',
            options: {
              [k('mobility-mobile')]: { label: 'Mobile', defaultValue: false },
              [k('mobility-fixed')]: { label: 'Fixed', defaultValue: false },
            },
          },
          tenderness: {
            label: 'Tenderness',
            options: {
              [k('char-tender')]: { label: 'Tender', defaultValue: false },
              [k('char-non-tender')]: { label: 'Non-tender', defaultValue: false },
            },
          },
          'overlying-skin': {
            label: 'Overlying skin',
            options: {
              [k('skin-normal')]: { label: 'Normal', defaultValue: false },
              [k('skin-erythema')]: { label: 'Erythema', defaultValue: false },
              [k('skin-fluctuant')]: { label: 'Fluctuant', defaultValue: false },
            },
          },
        },
      },
    },
  };
}

function createLymphNodePair(
  baseName: string,
  baseLabel: string
): Record<string, ReturnType<typeof createLymphNodeModalExam>> {
  return {
    [`lymph-${baseName}-l`]: createLymphNodeModalExam(`lymph-${baseName}-l`, `${baseLabel} L`),
    [`lymph-${baseName}-r`]: createLymphNodeModalExam(`lymph-${baseName}-r`, `${baseLabel} R`),
  };
}

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
        'mild-distress': { label: 'Mild distress', defaultValue: false, type: 'checkbox' },
        'moderate-distress': { label: 'Moderate distress', defaultValue: false, type: 'checkbox' },
        'severe-distress': { label: 'Severe distress', defaultValue: false, type: 'checkbox' },
        'ill-appearing': { label: 'Ill-appearing', defaultValue: false, type: 'checkbox' },
        'toxic-appearing': { label: 'Toxic-appearing', defaultValue: false, type: 'checkbox' },
        dehydrated: { label: 'Dehydrated', defaultValue: false, type: 'checkbox' },
        'dry-mucous-membranes-general': { label: 'Dry mucous membranes', defaultValue: false, type: 'checkbox' },
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
      abnormal: {
        'scalp-laceration': { label: 'Scalp laceration', defaultValue: false, type: 'checkbox' },
        'bony-tenderness': { label: 'Bony tenderness', defaultValue: false, type: 'checkbox' },
        hematoma: { label: 'Hematoma', defaultValue: false, type: 'checkbox' },
      },
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
            'right-eye-lid-erythema': { label: 'Lid erythema', defaultValue: false, type: 'checkbox' },
            'right-eye-lid-tenderness': { label: 'Lid tenderness', defaultValue: false, type: 'checkbox' },
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
            'left-eye-lid-erythema': { label: 'Lid erythema', defaultValue: false, type: 'checkbox' },
            'left-eye-lid-tenderness': { label: 'Lid tenderness', defaultValue: false, type: 'checkbox' },
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
      abnormal: {
        'congestion-rhinorrhea': { label: 'Congestion, rhinorrhea', defaultValue: false, type: 'checkbox' },
        'external-nose': {
          label: 'External nose',
          defaultValue: false,
          type: 'modal-exam' as const,
          sections: {
            'external-nose': {
              label: 'External Nose',
              groups: {
                appearance: {
                  label: 'Appearance',
                  options: {
                    'ext-nose-normal': { label: 'Normal', defaultValue: false },
                    'ext-nose-erythema': { label: 'Erythema', defaultValue: false },
                    'ext-nose-swelling': { label: 'Swelling', defaultValue: false },
                    'ext-nose-deformity': { label: 'Deformity', defaultValue: false },
                  },
                },
                tenderness: {
                  label: 'Tenderness',
                  options: {
                    'ext-nose-tenderness-none': { label: 'None', defaultValue: false },
                    'ext-nose-tenderness-dorsum': { label: 'Dorsum', defaultValue: false },
                    'ext-nose-tenderness-tip': { label: 'Tip', defaultValue: false },
                    'ext-nose-tenderness-ala': { label: 'Ala', defaultValue: false },
                  },
                },
                crepitus: {
                  label: 'Crepitus',
                  options: {
                    'ext-nose-crepitus-absent': { label: 'Absent', defaultValue: false },
                    'ext-nose-crepitus-present': { label: 'Present', defaultValue: false },
                  },
                },
              },
            },
          },
        },
        'anterior-rhinoscopy-l': {
          label: 'Anterior rhinoscopy L',
          defaultValue: false,
          type: 'modal-exam' as const,
          sections: {
            rhinoscopy: {
              label: 'Anterior Rhinoscopy',
              groups: {
                patency: {
                  label: 'Patency',
                  options: {
                    'rhinoscopy-l-patent': { label: 'Patent', defaultValue: false },
                    'rhinoscopy-l-partial': { label: 'Partial', defaultValue: false },
                    'rhinoscopy-l-obstructed': { label: 'Obstructed', defaultValue: false },
                  },
                },
                mucosa: {
                  label: 'Mucosa',
                  options: {
                    'rhinoscopy-l-mucosa-normal': { label: 'Normal', defaultValue: false },
                    'rhinoscopy-l-mucosa-pale-boggy': { label: 'Pale/boggy', defaultValue: false },
                    'rhinoscopy-l-mucosa-erythematous': { label: 'Erythematous', defaultValue: false },
                  },
                },
                'inf-turbinate': {
                  label: 'Inf. turbinate',
                  options: {
                    'rhinoscopy-l-turbinate-normal': { label: 'Normal', defaultValue: false },
                    'rhinoscopy-l-turbinate-hypertrophied': { label: 'Hypertrophied', defaultValue: false },
                  },
                },
                septum: {
                  label: 'Septum',
                  options: {
                    'rhinoscopy-l-septum-midline': { label: 'Midline', defaultValue: false },
                    'rhinoscopy-l-septum-no-hematoma': { label: 'No Hematoma', defaultValue: false },
                    'rhinoscopy-l-septum-dev-r': { label: 'Dev R', defaultValue: false },
                    'rhinoscopy-l-septum-dev-l': { label: 'Dev L', defaultValue: false },
                    'rhinoscopy-l-septum-hematoma': { label: 'Hematoma', defaultValue: false },
                  },
                },
                discharge: {
                  label: 'Discharge',
                  options: {
                    'rhinoscopy-l-discharge-none': { label: 'None', defaultValue: false },
                    'rhinoscopy-l-discharge-clear': { label: 'Clear', defaultValue: false },
                    'rhinoscopy-l-discharge-mucopurulent': { label: 'Mucopurulent', defaultValue: false },
                    'rhinoscopy-l-discharge-bloody': { label: 'Bloody', defaultValue: false },
                  },
                },
                'polyps-fb': {
                  label: 'Polyps/FB',
                  options: {
                    'rhinoscopy-l-polyps-none': { label: 'None', defaultValue: false },
                    'rhinoscopy-l-polyps-polyps': { label: 'Polyps', defaultValue: false },
                    'rhinoscopy-l-fb-r': { label: 'FB \u2014 R', defaultValue: false },
                    'rhinoscopy-l-fb-l': { label: 'FB \u2014 L', defaultValue: false },
                  },
                },
              },
            },
          },
        },
        'anterior-rhinoscopy-r': {
          label: 'Anterior rhinoscopy R',
          defaultValue: false,
          type: 'modal-exam' as const,
          sections: {
            rhinoscopy: {
              label: 'Anterior Rhinoscopy',
              groups: {
                patency: {
                  label: 'Patency',
                  options: {
                    'rhinoscopy-r-patent': { label: 'Patent', defaultValue: false },
                    'rhinoscopy-r-partial': { label: 'Partial', defaultValue: false },
                    'rhinoscopy-r-obstructed': { label: 'Obstructed', defaultValue: false },
                  },
                },
                mucosa: {
                  label: 'Mucosa',
                  options: {
                    'rhinoscopy-r-mucosa-normal': { label: 'Normal', defaultValue: false },
                    'rhinoscopy-r-mucosa-pale-boggy': { label: 'Pale/boggy', defaultValue: false },
                    'rhinoscopy-r-mucosa-erythematous': { label: 'Erythematous', defaultValue: false },
                  },
                },
                'inf-turbinate': {
                  label: 'Inf. turbinate',
                  options: {
                    'rhinoscopy-r-turbinate-normal': { label: 'Normal', defaultValue: false },
                    'rhinoscopy-r-turbinate-hypertrophied': { label: 'Hypertrophied', defaultValue: false },
                  },
                },
                septum: {
                  label: 'Septum',
                  options: {
                    'rhinoscopy-r-septum-midline': { label: 'Midline', defaultValue: false },
                    'rhinoscopy-r-septum-no-hematoma': { label: 'No Hematoma', defaultValue: false },
                    'rhinoscopy-r-septum-dev-r': { label: 'Dev R', defaultValue: false },
                    'rhinoscopy-r-septum-dev-l': { label: 'Dev L', defaultValue: false },
                    'rhinoscopy-r-septum-hematoma': { label: 'Hematoma', defaultValue: false },
                  },
                },
                discharge: {
                  label: 'Discharge',
                  options: {
                    'rhinoscopy-r-discharge-none': { label: 'None', defaultValue: false },
                    'rhinoscopy-r-discharge-clear': { label: 'Clear', defaultValue: false },
                    'rhinoscopy-r-discharge-mucopurulent': { label: 'Mucopurulent', defaultValue: false },
                    'rhinoscopy-r-discharge-bloody': { label: 'Bloody', defaultValue: false },
                  },
                },
                'polyps-fb': {
                  label: 'Polyps/FB',
                  options: {
                    'rhinoscopy-r-polyps-none': { label: 'None', defaultValue: false },
                    'rhinoscopy-r-polyps-polyps': { label: 'Polyps', defaultValue: false },
                    'rhinoscopy-r-fb-r': { label: 'FB \u2014 R', defaultValue: false },
                    'rhinoscopy-r-fb-l': { label: 'FB \u2014 L', defaultValue: false },
                  },
                },
              },
            },
          },
        },
        epistaxis: {
          label: 'Epistaxis',
          defaultValue: false,
          type: 'modal-exam' as const,
          sections: {
            epistaxis: {
              label: 'Epistaxis',
              groups: {
                location: {
                  label: 'Location',
                  options: {
                    'epistaxis-not-present': { label: 'Not present', defaultValue: false },
                    'epistaxis-anterior': { label: 'Anterior', defaultValue: false },
                    'epistaxis-posterior': { label: 'Posterior', defaultValue: false },
                  },
                },
                source: {
                  label: 'Source',
                  options: {
                    'epistaxis-source-kiesselbach': { label: 'Kiesselbach', defaultValue: false },
                    'epistaxis-source-other': { label: 'Other', defaultValue: false },
                  },
                },
                volume: {
                  label: 'Volume',
                  options: {
                    'epistaxis-volume-scant': { label: 'Scant', defaultValue: false },
                    'epistaxis-volume-moderate': { label: 'Moderate', defaultValue: false },
                    'epistaxis-volume-large': { label: 'Large', defaultValue: false },
                  },
                },
              },
            },
          },
        },
        'sinus-tenderness': {
          label: 'Sinus tenderness',
          defaultValue: false,
          type: 'modal-exam' as const,
          sections: {
            'sinus-tenderness': {
              label: 'Sinus Tenderness',
              groups: {
                general: {
                  label: 'General',
                  options: {
                    'sinus-all-non-tender': { label: 'All non-tender', defaultValue: false },
                  },
                },
                frontal: {
                  label: 'Frontal',
                  options: {
                    'sinus-frontal-r': { label: 'Right', defaultValue: false },
                    'sinus-frontal-l': { label: 'Left', defaultValue: false },
                  },
                },
                maxillary: {
                  label: 'Maxillary',
                  options: {
                    'sinus-maxillary-r': { label: 'Right', defaultValue: false },
                    'sinus-maxillary-l': { label: 'Left', defaultValue: false },
                  },
                },
              },
            },
          },
        },
      },
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
        meningismus: { label: 'Meningismus', defaultValue: false, type: 'checkbox' },
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
        ...createLymphNodePair('anterior-cervical', 'Anterior cervical'),
        ...createLymphNodePair('posterior-cervical', 'Posterior cervical'),
        ...createLymphNodePair('submandibular', 'Submandibular'),
        ...createLymphNodePair('supraclavicular', 'Supraclavicular'),
        'lymph-submental': createLymphNodeModalExam('lymph-submental', 'Submental'),
        ...createLymphNodePair('axillary', 'Axillary'),
        ...createLymphNodePair('inguinal', 'Inguinal'),
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
        'common-skin-findings': {
          label: 'Common skin findings',
          defaultValue: false,
          type: 'modal-exam' as const,
          sections: {
            'adult-findings': {
              label: 'Common Findings',
              groups: {
                rashes: {
                  label: 'Rashes & Eruptions',
                  options: {
                    'skin-contact-dermatitis': {
                      label: 'Contact dermatitis',
                      defaultValue: false,
                      description:
                        'well-demarcated erythematous plaque with vesicles and weeping in a geometric distribution corresponding to irritant or allergen exposure',
                    },
                    'skin-tinea': {
                      label: 'Tinea',
                      defaultValue: false,
                      description: 'annular scaly plaque with central clearing and a raised, well-defined border',
                    },
                    'skin-herpes-zoster': {
                      label: 'Herpes zoster',
                      defaultValue: false,
                      description:
                        'unilateral grouped vesicles on an erythematous base in a dermatomal distribution, not crossing the midline',
                    },
                    'skin-impetigo': {
                      label: 'Impetigo',
                      defaultValue: false,
                      description: 'erythematous-based, honey-crusted, non-tender lesions',
                    },
                    'skin-cellulitis': {
                      label: 'Cellulitis',
                      defaultValue: false,
                      description:
                        'poorly demarcated, warm, erythematous, tender plaque without a defined edge with regional lymphadenopathy',
                    },
                    'skin-urticaria': {
                      label: 'Urticaria',
                      defaultValue: false,
                      description: 'discrete, papular islands with surrounding erythema',
                    },
                    'skin-eczema': {
                      label: 'Eczema (atopic dermatitis)',
                      defaultValue: false,
                      description: 'dry, scaly patches of skin with underlying erythema',
                    },
                    'skin-psoriasis': {
                      label: 'Psoriasis',
                      defaultValue: false,
                      description:
                        'well-demarcated, thick, silvery-scaled erythematous plaques on extensor surfaces with pinpoint bleeding on scale removal (Auspitz sign)',
                    },
                    'skin-herpes-simplex': {
                      label: 'Herpes simplex',
                      defaultValue: false,
                      description:
                        'grouped vesicles on an erythematous base at a consistent anatomic site with perilesional edema',
                    },
                    'skin-scabies': {
                      label: 'Scabies',
                      defaultValue: false,
                      description:
                        'pruritic papules and excoriations with threadlike burrows in web spaces, wrists, belt line, and genitalia, worse at night',
                    },
                    'skin-drug-reaction': {
                      label: 'Drug reaction (morbilliform)',
                      defaultValue: false,
                      description:
                        'diffuse symmetric blanching maculopapular eruption originating on the trunk and spreading centrifugally',
                    },
                    'skin-pityriasis-rosea': {
                      label: 'Pityriasis rosea',
                      defaultValue: false,
                      description:
                        'herald patch with a subsequent diffuse symmetric eruption of oval salmon-colored plaques along skin cleavage lines in a Christmas tree pattern on the back',
                    },
                    'skin-rosacea': {
                      label: 'Rosacea',
                      defaultValue: false,
                      description:
                        'central facial erythema with telangiectasias, papules, and pustules on the cheeks, nose, and chin without comedones',
                    },
                    'skin-seborrheic-dermatitis': {
                      label: 'Seborrheic dermatitis',
                      defaultValue: false,
                      description:
                        'greasy, yellowish, poorly demarcated scaly plaques on the scalp, nasolabial folds, eyebrows, and central chest',
                    },
                    'skin-acne': {
                      label: 'Acne vulgaris',
                      defaultValue: false,
                      description:
                        'open and closed comedones, erythematous papules and pustules on the face, chest, and back with nodular and cystic lesions',
                    },
                    'skin-sunburn': {
                      label: 'Sunburn',
                      defaultValue: false,
                      description:
                        'diffuse, tender, warm erythema in a sun-exposed distribution with vesiculation and edema',
                    },
                    'skin-tinea-versicolor': {
                      label: 'Tinea versicolor',
                      defaultValue: false,
                      description:
                        'hypopigmented and hyperpigmented finely scaled macules and patches on the upper trunk and shoulders',
                    },
                    'skin-viral-exanthem': {
                      label: 'Viral exanthem',
                      defaultValue: false,
                      description: 'erythematous, macular rash over trunk>extremities',
                    },
                    'skin-fixed-drug-eruption': {
                      label: 'Fixed drug eruption',
                      defaultValue: false,
                      description:
                        'sharply demarcated dusky-red to violaceous round plaque at a consistent anatomic site with post-inflammatory hyperpigmentation at the border',
                    },
                    'skin-purpura-petechiae': {
                      label: 'Purpura / petechiae',
                      defaultValue: false,
                      description:
                        'non-blanching red to purple macules, petechiae <3mm and purpura >3mm, representing extravasated red cells',
                    },
                    'skin-erythema-migrans': {
                      label: 'Erythema migrans',
                      defaultValue: false,
                      description:
                        'expanding erythematous annular plaque with central clearing at the site of tick bite',
                    },
                    'skin-insect-bites': {
                      label: 'Insect bites',
                      defaultValue: false,
                      description: 'erythematous-based papules/plaques with central punctate marks',
                    },
                  },
                },
                'lesions-masses': {
                  label: 'Lesions & Masses',
                  options: {
                    'skin-sebaceous-cyst': {
                      label: 'Sebaceous cyst',
                      defaultValue: false,
                      description:
                        'flesh-colored, mobile, dome-shaped nodule with a central punctum, non-tender without surrounding erythema or induration',
                    },
                    'skin-folliculitis': {
                      label: 'Folliculitis',
                      defaultValue: false,
                      description:
                        'erythematous papules and pustules centered on hair follicles without confluence or fluctuance',
                    },
                    'skin-furuncle-carbuncle': {
                      label: 'Furuncle / carbuncle',
                      defaultValue: false,
                      description:
                        'deep, fluctuant, tender erythematous nodule (furuncle) or confluent cluster of infected follicles with multiple draining points (carbuncle)',
                    },
                  },
                },
              },
            },
            'pediatric-findings': {
              label: 'Pediatric',
              groups: {
                'pediatric-rashes': {
                  label: 'Pediatric-Specific',
                  options: {
                    'skin-coxsackievirus': {
                      label: 'Coxsackievirus (hand-foot-mouth)',
                      defaultValue: false,
                      description: '2-3 mm erythematous papules worse on hands and feet, including palms and soles',
                    },
                    'skin-irritant-diaper-rash': {
                      label: 'Irritant diaper rash',
                      defaultValue: false,
                      description:
                        'erythematous macular rash in diaper area that spares creases with no satellite lesions',
                    },
                    'skin-fifths-disease': {
                      label: "Fifth's disease",
                      defaultValue: false,
                      description:
                        'diffuse, erythematous, maculopapular rash and erythematous cheeks sparing nasolabial folds',
                    },
                    'skin-molluscum': {
                      label: 'Molluscum contagiosum',
                      defaultValue: false,
                      description:
                        'discrete, flesh-colored, dome-shaped papules with central umbilication, 2\u20135mm, in clustered distribution',
                    },
                    'skin-paronychia': {
                      label: 'Paronychia',
                      defaultValue: false,
                      description: 'tender erythema along edge of nail with no lymphatic streaking',
                    },
                    'skin-poison-ivy': {
                      label: 'Poison ivy contact dermatitis',
                      defaultValue: false,
                      description: 'linear patches and clusters of erythematous-based vesicles, some dry, no burrows',
                    },
                    'skin-tinea-capitis': {
                      label: 'Tinea capitis',
                      defaultValue: false,
                      description: 'flat area of broken hair shafts and overlying scale',
                    },
                  },
                },
              },
            },
          },
        },
        'skin-lesion-characteristics': {
          label: 'Lesion characteristics',
          defaultValue: false,
          type: 'modal-exam' as const,
          sections: {
            characteristics: {
              label: 'Lesion Characteristics',
              groups: {
                type: {
                  label: 'Type',
                  options: {
                    'skin-lesion-macule': { label: 'Macule', defaultValue: false },
                    'skin-lesion-patch': { label: 'Patch', defaultValue: false },
                    'skin-lesion-papule': { label: 'Papule', defaultValue: false },
                    'skin-lesion-plaque': { label: 'Plaque', defaultValue: false },
                    'skin-lesion-vesicle': { label: 'Vesicle', defaultValue: false },
                    'skin-lesion-bulla': { label: 'Bulla', defaultValue: false },
                    'skin-lesion-pustule': { label: 'Pustule', defaultValue: false },
                    'skin-lesion-nodule': { label: 'Nodule', defaultValue: false },
                    'skin-lesion-wheal': { label: 'Wheal', defaultValue: false },
                    'skin-lesion-ulcer': { label: 'Ulcer', defaultValue: false },
                  },
                },
                color: {
                  label: 'Color',
                  options: {
                    'skin-lesion-erythematous': { label: 'Erythematous', defaultValue: false },
                    'skin-lesion-violaceous': { label: 'Violaceous', defaultValue: false },
                    'skin-lesion-brown': { label: 'Brown', defaultValue: false },
                    'skin-lesion-hypopigmented': { label: 'Hypopigmented', defaultValue: false },
                    'skin-lesion-hyperpigmented': { label: 'Hyperpigmented', defaultValue: false },
                    'skin-lesion-yellow': { label: 'Yellow', defaultValue: false },
                    'skin-lesion-black': { label: 'Black', defaultValue: false },
                  },
                },
                border: {
                  label: 'Border',
                  options: {
                    'skin-lesion-well-defined': { label: 'Well-defined', defaultValue: false },
                    'skin-lesion-ill-defined': { label: 'Ill-defined', defaultValue: false },
                    'skin-lesion-irregular': { label: 'Irregular', defaultValue: false },
                  },
                },
                surface: {
                  label: 'Surface',
                  options: {
                    'skin-lesion-smooth': { label: 'Smooth', defaultValue: false },
                    'skin-lesion-scaly': { label: 'Scaly', defaultValue: false },
                    'skin-lesion-crusted': { label: 'Crusted', defaultValue: false },
                    'skin-lesion-macerated': { label: 'Macerated', defaultValue: false },
                  },
                },
                size: {
                  label: 'Size',
                  options: {
                    'skin-lesion-lt-1cm': { label: '<1cm', defaultValue: false },
                    'skin-lesion-1-5cm': { label: '1\u20135cm', defaultValue: false },
                    'skin-lesion-gt-5cm': { label: '>5cm', defaultValue: false },
                  },
                },
                blanching: {
                  label: 'Blanching',
                  options: {
                    'skin-lesion-blanching-yes': { label: 'Yes', defaultValue: false },
                    'skin-lesion-blanching-no': { label: 'No', defaultValue: false },
                  },
                },
              },
            },
          },
        },
        'skin-distribution': {
          label: 'Distribution pattern',
          defaultValue: false,
          type: 'modal-exam' as const,
          sections: {
            distribution: {
              label: 'Distribution Pattern',
              groups: {
                pattern: {
                  label: 'Pattern',
                  options: {
                    'skin-dist-dermatomal': { label: 'Dermatomal', defaultValue: false },
                    'skin-dist-flexural': { label: 'Flexural', defaultValue: false },
                    'skin-dist-extensor': { label: 'Extensor', defaultValue: false },
                    'skin-dist-sun-exposed': { label: 'Sun-exposed', defaultValue: false },
                    'skin-dist-intertriginous': { label: 'Intertriginous', defaultValue: false },
                    'skin-dist-palms-soles': { label: 'Palms/soles', defaultValue: false },
                    'skin-dist-mucous-membranes': { label: 'Mucous membranes involved', defaultValue: false },
                  },
                },
                side: {
                  label: 'Side',
                  options: {
                    'skin-side-r': { label: 'R', defaultValue: false },
                    'skin-side-l': { label: 'L', defaultValue: false },
                    'skin-side-bilateral': { label: 'Bilateral', defaultValue: false },
                    'skin-side-midline': { label: 'Midline', defaultValue: false },
                  },
                },
              },
            },
          },
        },
        'skin-wound-laceration': {
          label: 'Wound / laceration',
          defaultValue: false,
          type: 'modal-exam' as const,
          sections: {
            wound: {
              label: 'Wound / Laceration',
              groups: {
                presence: {
                  label: 'Presence',
                  options: {
                    'skin-wound-not-present': { label: 'Not present', defaultValue: false },
                  },
                },
                depth: {
                  label: 'Depth',
                  options: {
                    'skin-wound-superficial': { label: 'Superficial', defaultValue: false },
                    'skin-wound-subcutaneous': { label: 'Subcutaneous', defaultValue: false },
                    'skin-wound-deep-fascial': { label: 'Deep/fascial', defaultValue: false },
                  },
                },
                edges: {
                  label: 'Edges',
                  options: {
                    'skin-wound-edges-clean': { label: 'Clean', defaultValue: false },
                    'skin-wound-edges-jagged': { label: 'Jagged', defaultValue: false },
                    'skin-wound-edges-avulsion': { label: 'Avulsion', defaultValue: false },
                  },
                },
                contamination: {
                  label: 'Contamination',
                  options: {
                    'skin-wound-contam-none': { label: 'None', defaultValue: false },
                    'skin-wound-contam-mild': { label: 'Mild', defaultValue: false },
                    'skin-wound-contam-heavy': { label: 'Heavy', defaultValue: false },
                  },
                },
                'neurovascular-distal': {
                  label: 'Neurovascular distal',
                  options: {
                    'skin-wound-nv-intact': { label: 'Intact', defaultValue: false },
                    'skin-wound-nv-compromised': { label: 'Compromised', defaultValue: false },
                  },
                },
                'tendon-bone': {
                  label: 'Tendon/bone visible',
                  options: {
                    'skin-wound-tendon-no': { label: 'No', defaultValue: false },
                    'skin-wound-tendon-yes': { label: 'Yes', defaultValue: false },
                  },
                },
              },
            },
          },
        },
        'skin-abscess-cellulitis': {
          label: 'Abscess / cellulitis',
          defaultValue: false,
          type: 'modal-exam' as const,
          sections: {
            abscess: {
              label: 'Abscess / Cellulitis',
              groups: {
                presence: {
                  label: 'Presence',
                  options: {
                    'skin-abscess-not-present': { label: 'Not present', defaultValue: false },
                  },
                },
                abscess: {
                  label: 'Abscess',
                  options: {
                    'skin-abscess-fluctuant': { label: 'Fluctuant', defaultValue: false },
                    'skin-abscess-non-fluctuant': { label: 'Non-fluctuant', defaultValue: false },
                  },
                },
                cellulitis: {
                  label: 'Cellulitis',
                  options: {
                    'skin-cellulitis-absent': { label: 'Absent', defaultValue: false },
                    'skin-cellulitis-present': { label: 'Present', defaultValue: false },
                  },
                },
                'borders-marked': {
                  label: 'Borders marked',
                  options: {
                    'skin-cellulitis-borders-no': { label: 'No', defaultValue: false },
                    'skin-cellulitis-borders-yes': { label: 'Yes', defaultValue: false },
                  },
                },
                streaking: {
                  label: 'Streaking',
                  options: {
                    'skin-streaking-absent': { label: 'Absent', defaultValue: false },
                    'skin-streaking-present': { label: 'Present', defaultValue: false },
                  },
                },
              },
            },
          },
        },
        'skin-burn': {
          label: 'Burn',
          defaultValue: false,
          type: 'modal-exam' as const,
          sections: {
            burn: {
              label: 'Burn',
              groups: {
                presence: {
                  label: 'Presence',
                  options: {
                    'skin-burn-not-present': { label: 'Not present', defaultValue: false },
                  },
                },
                degree: {
                  label: 'Degree',
                  options: {
                    'skin-burn-superficial-1st': { label: 'Superficial (1st)', defaultValue: false },
                    'skin-burn-partial-2nd': { label: 'Partial thickness (2nd)', defaultValue: false },
                    'skin-burn-full-3rd': { label: 'Full thickness (3rd)', defaultValue: false },
                  },
                },
                tbsa: {
                  label: 'TBSA estimate',
                  options: {
                    'skin-burn-tbsa-lt-1': { label: '<1%', defaultValue: false },
                    'skin-burn-tbsa-1-5': { label: '1\u20135%', defaultValue: false },
                    'skin-burn-tbsa-6-10': { label: '6\u201310%', defaultValue: false },
                    'skin-burn-tbsa-gt-10': { label: '>10%', defaultValue: false },
                  },
                },
              },
            },
          },
        },
        'skin-bite-sting': {
          label: 'Bite / sting',
          defaultValue: false,
          type: 'modal-exam' as const,
          sections: {
            bite: {
              label: 'Bite / Sting',
              groups: {
                presence: {
                  label: 'Presence',
                  options: {
                    'skin-bite-not-present': { label: 'Not present', defaultValue: false },
                  },
                },
                source: {
                  label: 'Source',
                  options: {
                    'skin-bite-human': { label: 'Human', defaultValue: false },
                    'skin-bite-dog': { label: 'Dog', defaultValue: false },
                    'skin-bite-cat': { label: 'Cat', defaultValue: false },
                    'skin-bite-spider': { label: 'Spider', defaultValue: false },
                    'skin-bite-insect': { label: 'Insect', defaultValue: false },
                    'skin-bite-unknown': { label: 'Unknown', defaultValue: false },
                  },
                },
                'wound-type': {
                  label: 'Wound type',
                  options: {
                    'skin-bite-puncture': { label: 'Puncture', defaultValue: false },
                    'skin-bite-laceration': { label: 'Laceration', defaultValue: false },
                    'skin-bite-crush': { label: 'Crush', defaultValue: false },
                  },
                },
                'signs-of-infection': {
                  label: 'Signs of infection',
                  options: {
                    'skin-bite-infection-none': { label: 'None', defaultValue: false },
                    'skin-bite-infection-early': { label: 'Early', defaultValue: false },
                    'skin-bite-infection-established': { label: 'Established', defaultValue: false },
                  },
                },
                'tick-attached': {
                  label: 'Tick attached',
                  options: {
                    'skin-bite-tick-no': { label: 'No', defaultValue: false },
                    'skin-bite-tick-yes-removed': { label: 'Yes \u2014 removal performed', defaultValue: false },
                    'skin-bite-tick-yes-not-removed': { label: 'Yes \u2014 not removed', defaultValue: false },
                  },
                },
                'bullseye-rash': {
                  label: 'Bullseye rash',
                  options: {
                    'skin-bite-bullseye-absent': { label: 'Absent', defaultValue: false },
                    'skin-bite-bullseye-present': { label: 'Present', defaultValue: false },
                  },
                },
              },
            },
          },
        },
        'skin-associated-findings': {
          label: 'Associated findings',
          defaultValue: false,
          type: 'modal-exam' as const,
          sections: {
            associated: {
              label: 'Associated Findings',
              groups: {
                findings: {
                  label: 'Findings',
                  options: {
                    'skin-assoc-none': { label: 'None', defaultValue: false },
                    'skin-assoc-angioedema': { label: 'Angioedema', defaultValue: false },
                    'skin-assoc-desquamation': { label: 'Desquamation', defaultValue: false },
                    'skin-assoc-nikolsky': { label: 'Nikolsky sign', defaultValue: false },
                  },
                },
              },
            },
          },
        },
        'skin-location': {
          label: 'Location',
          defaultValue: false,
          type: 'modal-exam' as const,
          sections: {
            location: {
              label: 'Location(s)',
              groups: {
                'head-neck': {
                  label: 'Head & Neck',
                  options: {
                    'skin-loc-scalp': { label: 'Scalp', defaultValue: false },
                    'skin-loc-face': { label: 'Face', defaultValue: false },
                    'skin-loc-ears': { label: 'Ears', defaultValue: false },
                    'skin-loc-lips-perioral': { label: 'Lips/perioral', defaultValue: false },
                    'skin-loc-neck': { label: 'Neck', defaultValue: false },
                    'skin-loc-mucous-membranes': { label: 'Mucous membranes', defaultValue: false },
                  },
                },
                trunk: {
                  label: 'Trunk',
                  options: {
                    'skin-loc-chest': { label: 'Chest', defaultValue: false },
                    'skin-loc-abdomen': { label: 'Abdomen', defaultValue: false },
                    'skin-loc-back': { label: 'Back', defaultValue: false },
                    'skin-loc-flank': { label: 'Flank', defaultValue: false },
                    'skin-loc-groin': { label: 'Groin', defaultValue: false },
                    'skin-loc-genitalia': { label: 'Genitalia', defaultValue: false },
                  },
                },
                'upper-extremity': {
                  label: 'Upper Extremity',
                  options: {
                    'skin-loc-shoulder': { label: 'Shoulder', defaultValue: false },
                    'skin-loc-upper-arm': { label: 'Upper arm', defaultValue: false },
                    'skin-loc-elbow': { label: 'Elbow', defaultValue: false },
                    'skin-loc-forearm': { label: 'Forearm', defaultValue: false },
                    'skin-loc-wrist': { label: 'Wrist', defaultValue: false },
                    'skin-loc-hand-fingers': { label: 'Hand/fingers', defaultValue: false },
                  },
                },
                'lower-extremity': {
                  label: 'Lower Extremity',
                  options: {
                    'skin-loc-hip-buttock': { label: 'Hip/buttock', defaultValue: false },
                    'skin-loc-thigh': { label: 'Thigh', defaultValue: false },
                    'skin-loc-knee': { label: 'Knee', defaultValue: false },
                    'skin-loc-lower-leg': { label: 'Lower leg', defaultValue: false },
                    'skin-loc-ankle': { label: 'Ankle', defaultValue: false },
                    'skin-loc-foot-toes': { label: 'Foot/toes', defaultValue: false },
                  },
                },
              },
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
        'murmur-grade': {
          label: 'Murmur',
          type: 'multi-select',
          options: {
            'murmur-i': { label: 'Grade I', defaultValue: false },
            'murmur-ii': { label: 'Grade II', defaultValue: false },
            'murmur-iii': { label: 'Grade III', defaultValue: false },
            'murmur-iv': { label: 'Grade IV', defaultValue: false },
            'murmur-v': { label: 'Grade V', defaultValue: false },
            'murmur-vi': { label: 'Grade VI', defaultValue: false },
          },
        },
      },
      comment: { 'heart-comment': { label: 'Heart comment', type: 'text' } },
    },
  },
  vascular: {
    label: 'Vascular',
    components: {
      normal: {
        'capillary-refill-less-than-2-seconds': {
          label: 'Capillary refill <2 seconds',
          defaultValue: false,
          type: 'checkbox',
        },
        'extremities-warm-and-well-perfused': {
          label: 'Extremities warm and well-perfused',
          defaultValue: false,
          type: 'checkbox',
        },
        'no-edema': {
          label: 'No edema',
          defaultValue: false,
          type: 'checkbox',
        },
        'radial-posterior-tibial-and-dorsalis-pulses-2-bilaterally': {
          label: 'Radial, posterior tibial, and dorsalis pulses 2+ bilaterally',
          defaultValue: false,
          type: 'checkbox',
        },
        'no-calf-tenderness': {
          label: 'No calf tenderness',
          defaultValue: false,
          type: 'checkbox',
        },
      },
      abnormal: {
        'capillary-refill-greater-than-2-seconds': {
          label: 'Capillary refill >2 seconds',
          defaultValue: false,
          type: 'checkbox',
        },
        'cool-extremity-or-mottled-appearance-of-extremity': {
          label: 'Cool extremity or mottled appearance of extremity',
          defaultValue: false,
          type: 'checkbox',
        },
        edema: {
          label: 'Edema',
          defaultValue: false,
          type: 'checkbox',
        },
        'diminished-pulses': {
          label: 'Diminished pulses',
          defaultValue: false,
          type: 'checkbox',
        },
        'calf-tenderness': {
          label: 'Calf tenderness',
          defaultValue: false,
          type: 'checkbox',
        },
      },
      comment: {
        'vascular-comment': {
          label: 'Vascular comment',
          type: 'text',
        },
      },
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
        soft: {
          label: 'Soft',
          defaultValue: true,
          type: 'checkbox',
        },
        nondistended: {
          label: 'Nondistended',
          defaultValue: true,
          type: 'checkbox',
        },
        nontender: {
          label: 'Nontender',
          defaultValue: true,
          type: 'checkbox',
        },
        'normal-bowel-sounds': {
          label: 'Normal Bowel Sounds',
          defaultValue: false,
          type: 'checkbox',
        },
        'no-cva-tenderness': {
          label: 'No CVA tenderness',
          defaultValue: false,
          type: 'checkbox',
        },
        'no-hepatosplenomegaly': {
          label: 'No hepatosplenomegaly',
          defaultValue: false,
          type: 'checkbox',
        },
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
            'r-cva': { label: 'R CVA', defaultValue: false },
            'l-cva': { label: 'L CVA', defaultValue: false },
          },
        },
        hepatomegaly: {
          label: 'Hepatomegaly',
          defaultValue: false,
          type: 'checkbox',
        },
        splenomegaly: {
          label: 'Splenomegaly',
          defaultValue: false,
          type: 'checkbox',
        },
        'hypoactive-bowel-sounds': {
          label: 'Hypoactive Bowel Sounds',
          defaultValue: false,
          type: 'checkbox',
        },
        'hyperactive-bowel-sounds': {
          label: 'Hyperactive Bowel Sounds',
          defaultValue: false,
          type: 'checkbox',
        },
        'absent-bowel-sounds': {
          label: 'Absent Bowel Sounds',
          defaultValue: false,
          type: 'checkbox',
        },
        'pain-with-hopping': {
          label: 'Pain with hopping',
          defaultValue: false,
          type: 'checkbox',
        },
        rebound: {
          label: 'Rebound',
          defaultValue: false,
          type: 'checkbox',
        },
        guarding: {
          label: 'Guarding',
          defaultValue: false,
          type: 'checkbox',
        },
      },
      comment: {
        'abdomen-comment': {
          label: 'Abdomen comment',
          type: 'text',
        },
      },
    },
  },
  back: {
    label: 'Back',
    components: {
      normal: {
        'no-tenderness-to-palpation': {
          label: 'No tenderness to palpation',
          defaultValue: false,
          type: 'checkbox',
        },
        'full-range-of-motion': {
          label: 'Full range of motion',
          defaultValue: false,
          type: 'checkbox',
        },
        'no-visible-deformity': {
          label: 'No visible deformity',
          defaultValue: false,
          type: 'checkbox',
        },
        'normal-alignment': {
          label: 'Normal alignment',
          defaultValue: false,
          type: 'checkbox',
        },
        'no-paraspinal-muscle-spasm': {
          label: 'No paraspinal muscle spasm',
          defaultValue: false,
          type: 'checkbox',
        },
      },
      abnormal: {
        'midline-spinal-tenderness': {
          label: 'Midline spinal tenderness',
          defaultValue: false,
          type: 'checkbox',
        },
        'paraspinal-muscle-tenderness': {
          label: 'Paraspinal muscle tenderness',
          defaultValue: false,
          type: 'checkbox',
        },
        'limited-range-of-motion': {
          label: 'Limited range of motion',
          defaultValue: false,
          type: 'checkbox',
        },
        'visible-deformity-step-off': {
          label: 'Visible deformity, step-off',
          defaultValue: false,
          type: 'checkbox',
        },
        'scoliosis-kyphosis-lordosis': {
          label: 'Scoliosis/kyphosis/lordosis',
          defaultValue: false,
          type: 'checkbox',
        },
        'muscle-spasm': {
          label: 'Muscle spasm',
          defaultValue: false,
          type: 'checkbox',
        },
      },
      comment: {
        'back-comment': {
          label: 'Back comment',
          type: 'text',
        },
      },
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
        'no-point-tenderness-over-bone': {
          label: 'No point tenderness over bone',
          defaultValue: false,
          type: 'checkbox',
        },
        'normal-gait-weight-bearing': {
          label: 'Normal gait / weight bearing',
          defaultValue: false,
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
        'shoulder-l': createExtremityModalExam('shoulder-l', 'Shoulder L', shoulderSpecialTests),
        'shoulder-r': createExtremityModalExam('shoulder-r', 'Shoulder R', shoulderSpecialTests),
        'elbow-l': createExtremityModalExam('elbow-l', 'Elbow L', elbowSpecialTests),
        'elbow-r': createExtremityModalExam('elbow-r', 'Elbow R', elbowSpecialTests),
        'wrist-l': createExtremityModalExam('wrist-l', 'Wrist L', wristSpecialTests),
        'wrist-r': createExtremityModalExam('wrist-r', 'Wrist R', wristSpecialTests),
        'hand-fingers-l': createExtremityModalExam('hand-fingers-l', 'Hand/fingers L', handFingerSpecialTests),
        'hand-fingers-r': createExtremityModalExam('hand-fingers-r', 'Hand/fingers R', handFingerSpecialTests),
        'hip-l': createExtremityModalExam('hip-l', 'Hip L'),
        'hip-r': createExtremityModalExam('hip-r', 'Hip R'),
        'knee-l': createExtremityModalExam('knee-l', 'Knee L', kneeSpecialTests),
        'knee-r': createExtremityModalExam('knee-r', 'Knee R', kneeSpecialTests),
        'ankle-l': createExtremityModalExam('ankle-l', 'Ankle L', ankleSpecialTests),
        'ankle-r': createExtremityModalExam('ankle-r', 'Ankle R', ankleSpecialTests),
        'foot-toes-l': createExtremityModalExam('foot-toes-l', 'Foot/toes L', footToeSpecialTests),
        'foot-toes-r': createExtremityModalExam('foot-toes-r', 'Foot/toes R', footToeSpecialTests),
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
        'focal-deficit': { label: 'Focal deficit', defaultValue: false, type: 'checkbox' },
        'sensory-loss': { label: 'Sensory loss', defaultValue: false, type: 'checkbox' },
        tremor: { label: 'Tremor', defaultValue: false, type: 'checkbox' },
      },
      comment: { 'neurologic-comment': { label: 'Neurologic comment', type: 'text' } },
    },
  },
  psychiatric: {
    label: 'Psychiatric',
    components: {
      normal: {
        'normal-affect-calm-cooperative': {
          label: 'Normal affect; calm/cooperative',
          defaultValue: false,
          type: 'checkbox',
        },
        'denies-suicidal-homicidal-ideation': {
          label: 'Denies suicidal / homicidal ideation',
          defaultValue: false,
          type: 'checkbox',
        },
        'denies-hallucinations': { label: 'Denies hallucinations', defaultValue: false, type: 'checkbox' },
      },
      abnormal: {
        'anxious-status': { label: 'Anxious status', defaultValue: false, type: 'checkbox' },
        'suicidal-ideation': { label: 'Suicidal ideation', defaultValue: false, type: 'checkbox' },
        'poor-judgement': { label: 'Poor judgement', defaultValue: false, type: 'checkbox' },
      },
      comment: { 'psychiatric-comment': { label: 'Psychiatric comment', type: 'text' } },
    },
  },
  'gu-male': {
    label: 'GU (Male)',
    components: {
      normal: {
        'normal-external-genital-testicular-exam': {
          label: 'Normal external genital/testicular exam',
          defaultValue: false,
          type: 'checkbox',
        },
        'no-lesions-redness-discharge-male': {
          label: 'No lesions / redness / discharge',
          defaultValue: false,
          type: 'checkbox',
        },
        'cremasteric-reflexes-present': {
          label: 'Cremasteric reflexes present',
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
        hernia: { label: 'Hernia', defaultValue: false, type: 'checkbox' },
      },
      comment: { 'gu-male-comment': { label: 'GU (Male) comment', type: 'text' } },
    },
  },
  'gu-female': {
    label: 'GU (Female)',
    components: {
      normal: {
        'normal-external-genital-exam-female': {
          label: 'Normal external genital exam',
          defaultValue: false,
          type: 'checkbox',
        },
        'no-redness-or-discharge-female': {
          label: 'No redness or discharge',
          defaultValue: false,
          type: 'checkbox',
        },
      },
      abnormal: {
        'vaginal-discharge': { label: 'Vaginal discharge', defaultValue: false, type: 'checkbox' },
        'labial-lesions-erythema': { label: 'Labial lesions / erythema', defaultValue: false, type: 'checkbox' },
        'pelvic-adnexal-tenderness': { label: 'Pelvic / adnexal tenderness', defaultValue: false, type: 'checkbox' },
      },
      comment: { 'gu-female-comment': { label: 'GU (Female) comment', type: 'text' } },
    },
  },
  rectal: {
    label: 'Rectal',
    components: {
      normal: {
        'normal-external-rectal-exam': { label: 'Normal external rectal exam', defaultValue: false, type: 'checkbox' },
      },
      abnormal: {},
      comment: { 'rectal-comment': { label: 'Rectal comment', type: 'text' } },
    },
  },
};
