import {
  ExamCardCheckboxWithModalComponent,
  ExamItemConfig,
  ExamModalCheckboxOption,
  ExamModalOptionColumn,
  ExamModalOptionGroup,
  ExamModalWithColumnsSection,
} from 'config-types';

type ColumnConfig = { key: string; header?: string; headerAbbreviation?: string };

export const NORMAL_LABELS = new Set([
  'Normal',
  'None',
  'Absent',
  'Intact',
  'Full',
  'Not present',
  'Neg',
  'Stable',
  'Midline',
  'No Hematoma',
  'Patent',
  '2+ normal',
  '<2s',
  '5/5',
  'No',
  'All non-tender',
]);

const LR_COLUMNS: ColumnConfig[] = [
  { key: 'left', header: 'Left', headerAbbreviation: 'L' },
  { key: 'right', header: 'Right', headerAbbreviation: 'R' },
];

const SINGLE_COLUMN: ColumnConfig[] = [{ key: 'single-column' }];

function opt(label: string, defaultValue = false): ExamModalCheckboxOption {
  return { label, defaultValue, abnormal: !NORMAL_LABELS.has(label) };
}

type SpecialTestsBuilder = (k: (suffix: string) => string) => Record<string, ExamModalOptionGroup>;

function createExtremityModalExam(
  partKey: string,
  partLabel: string,
  columns: ColumnConfig[],
  specialTestsBuilder?: SpecialTestsBuilder,
  inspectionPrefixBuilder?: (k: (suffix: string) => string) => Record<string, ExamModalOptionGroup>
): ExamCardCheckboxWithModalComponent {
  const makeColumnsForSection = (
    groupsBuilder: (ck: (suffix: string) => string) => Record<string, ExamModalOptionGroup>
  ): Record<string, ExamModalOptionColumn> =>
    Object.fromEntries(
      columns.map(({ key, header, headerAbbreviation }) => {
        const ck = (suffix: string): string => `${partKey}-${key}-${suffix}`;
        return [key, { header, headerAbbreviation, groups: groupsBuilder(ck) }];
      })
    );

  const modal: Record<string, ExamModalWithColumnsSection> = {
    inspection: {
      label: 'Inspection',
      columns: makeColumnsForSection((ck) => ({
        ...(inspectionPrefixBuilder ? inspectionPrefixBuilder(ck) : {}),
        appearance: {
          label: 'Appearance',
          options: {
            [ck('appearance-normal')]: opt('Normal'),
            [ck('appearance-swelling')]: opt('Swelling'),
            [ck('appearance-deformity')]: opt('Deformity'),
            [ck('appearance-atrophy')]: opt('Atrophy'),
          },
        },
        skin: {
          label: 'Skin',
          options: {
            [ck('skin-normal')]: opt('Normal'),
            [ck('skin-erythema')]: opt('Erythema'),
            [ck('skin-ecchymosis')]: opt('Ecchymosis'),
            [ck('skin-wound')]: opt('Wound'),
          },
        },
        alignment: {
          label: 'Alignment',
          options: {
            [ck('alignment-normal')]: opt('Normal'),
            [ck('alignment-angulation')]: opt('Angulation'),
            [ck('alignment-shortening')]: opt('Shortening'),
          },
        },
        'cast-splint': {
          label: 'Cast/splint',
          options: {
            [ck('cast-not-present')]: opt('Not present'),
            [ck('cast-splint-in-place')]: opt('Splint in place'),
            [ck('cast-cast-in-place')]: opt('Cast in place'),
          },
        },
      })),
    },
    palpation: {
      label: 'Palpation',
      columns: makeColumnsForSection((ck) => ({
        tenderness: {
          label: 'Tenderness',
          options: {
            [ck('tenderness-none')]: opt('None'),
            [ck('tenderness-bony')]: opt('Bony'),
            [ck('tenderness-joint')]: opt('Joint'),
            [ck('tenderness-soft-tissue')]: opt('Soft tissue'),
          },
        },
        crepitus: {
          label: 'Crepitus',
          options: {
            [ck('crepitus-absent')]: opt('Absent'),
            [ck('crepitus-present')]: opt('Present'),
          },
        },
        temperature: {
          label: 'Temperature',
          options: {
            [ck('temperature-normal')]: opt('Normal'),
            [ck('temperature-warm')]: opt('Warm'),
            [ck('temperature-cool')]: opt('Cool'),
          },
        },
        edema: {
          label: 'Edema',
          options: {
            [ck('edema-none')]: opt('None'),
            [ck('edema-pitting')]: opt('Pitting'),
            [ck('edema-non-pitting')]: opt('Non-pitting'),
          },
        },
      })),
    },
    'range-of-motion': {
      label: 'Range of Motion',
      columns: makeColumnsForSection((ck) => ({
        'active-rom': {
          label: 'Active ROM',
          options: {
            [ck('active-rom-full')]: opt('Full'),
            [ck('active-rom-limited')]: opt('Limited'),
            [ck('active-rom-unable')]: opt('Unable'),
          },
        },
        'passive-rom': {
          label: 'Passive ROM',
          options: {
            [ck('passive-rom-full')]: opt('Full'),
            [ck('passive-rom-limited')]: opt('Limited'),
            [ck('passive-rom-painful-arc')]: opt('Painful arc'),
          },
        },
        'pain-with-motion': {
          label: 'Pain with motion',
          options: {
            [ck('pain-motion-none')]: opt('None'),
            [ck('pain-motion-active-only')]: opt('Active only'),
            [ck('pain-motion-passive-only')]: opt('Passive only'),
            [ck('pain-motion-both')]: opt('Both'),
          },
        },
      })),
    },
    neurovascular: {
      label: 'Neurovascular',
      columns: makeColumnsForSection((ck) => ({
        pulses: {
          label: 'Pulses',
          options: {
            [ck('pulses-2-plus-normal')]: opt('2+ normal'),
            [ck('pulses-1-plus-diminished')]: opt('1+ diminished'),
            [ck('pulses-absent')]: opt('Absent'),
          },
        },
        'cap-refill': {
          label: 'Cap refill',
          options: {
            [ck('cap-refill-less-2s')]: opt('<2s'),
            [ck('cap-refill-2-3s')]: opt('2\u20133s'),
            [ck('cap-refill-greater-3s')]: opt('>3s'),
          },
        },
        sensation: {
          label: 'Sensation',
          options: {
            [ck('sensation-intact')]: opt('Intact'),
            [ck('sensation-decreased')]: opt('Decreased'),
            [ck('sensation-absent')]: opt('Absent'),
            [ck('sensation-paresthesia')]: opt('Paresthesia'),
          },
        },
        'motor-strength': {
          label: 'Motor strength',
          options: {
            [ck('motor-5-5')]: opt('5/5'),
            [ck('motor-4-5')]: opt('4/5'),
            [ck('motor-3-5')]: opt('3/5'),
            [ck('motor-lte-2-5')]: opt('\u22642/5'),
          },
        },
      })),
    },
  };

  if (specialTestsBuilder) {
    modal['special-tests'] = {
      label: 'Special Tests',
      columns: makeColumnsForSection((ck) => specialTestsBuilder(ck)),
    };
  }

  return {
    label: partLabel,
    defaultValue: false,
    type: 'checkbox-with-modal' as const,
    modal,
  };
}

const shoulderSpecialTests: SpecialTestsBuilder = (k) => ({
  'hawkins-kennedy': {
    label: 'Hawkins-Kennedy',
    options: {
      [k('hawkins-neg')]: opt('Neg'),
      [k('hawkins-pos')]: opt('Pos'),
    },
  },
  'empty-can': {
    label: 'Empty can',
    options: {
      [k('empty-can-neg')]: opt('Neg'),
      [k('empty-can-pos')]: opt('Pos'),
    },
  },
  speeds: {
    label: "Speed's",
    options: {
      [k('speeds-neg')]: opt('Neg'),
      [k('speeds-pos')]: opt('Pos'),
    },
  },
  'drop-arm': {
    label: 'Drop arm',
    options: {
      [k('drop-arm-neg')]: opt('Neg'),
      [k('drop-arm-pos')]: opt('Pos'),
    },
  },
  'ac-joint-tenderness': {
    label: 'AC joint tenderness',
    options: {
      [k('ac-joint-absent')]: opt('Absent'),
      [k('ac-joint-present')]: opt('Present'),
    },
  },
  instability: {
    label: 'Instability',
    options: {
      [k('instability-none')]: opt('None'),
      [k('instability-anterior')]: opt('Anterior'),
      [k('instability-posterior')]: opt('Posterior'),
      [k('instability-multidirectional')]: opt('Multidirectional'),
    },
  },
});

const elbowSpecialTests: SpecialTestsBuilder = (k) => ({
  'lateral-epicondyle': {
    label: 'Lateral epicondyle tenderness',
    options: {
      [k('lat-epicondyle-absent')]: opt('Absent'),
      [k('lat-epicondyle-present')]: opt('Present'),
    },
  },
  'medial-epicondyle': {
    label: 'Medial epicondyle tenderness',
    options: {
      [k('med-epicondyle-absent')]: opt('Absent'),
      [k('med-epicondyle-present')]: opt('Present'),
    },
  },
  'valgus-stress': {
    label: 'Valgus stress',
    options: {
      [k('valgus-stable')]: opt('Stable'),
      [k('valgus-lax')]: opt('Lax'),
    },
  },
  'carrying-angle': {
    label: 'Carrying angle',
    options: {
      [k('carrying-angle-normal')]: opt('Normal'),
      [k('carrying-angle-increased')]: opt('Increased'),
    },
  },
  'tinels-cubital': {
    label: "Tinel's at cubital tunnel",
    options: {
      [k('tinels-cubital-neg')]: opt('Neg'),
      [k('tinels-cubital-pos')]: opt('Pos'),
    },
  },
});

const handWristSpecialTests: SpecialTestsBuilder = (k) => ({
  'snuffbox-tenderness': {
    label: 'Anatomical snuffbox tenderness',
    options: {
      [k('snuffbox-absent')]: opt('Absent'),
      [k('snuffbox-present')]: opt('Present'),
    },
  },
  finkelstein: {
    label: 'Finkelstein',
    options: {
      [k('finkelstein-neg')]: opt('Neg'),
      [k('finkelstein-pos')]: opt('Pos'),
    },
  },
  phalens: {
    label: "Phalen's",
    options: {
      [k('phalens-neg')]: opt('Neg'),
      [k('phalens-pos')]: opt('Pos'),
    },
  },
  tinels: {
    label: "Tinel's at carpal tunnel",
    options: {
      [k('tinels-neg')]: opt('Neg'),
      [k('tinels-pos')]: opt('Pos'),
    },
  },
  'grip-strength': {
    label: 'Grip strength',
    options: {
      [k('grip-normal')]: opt('Normal'),
      [k('grip-reduced')]: opt('Reduced'),
    },
  },
  'extensor-tendon': {
    label: 'Extensor tendon integrity',
    options: {
      [k('extensor-intact')]: opt('Intact'),
      [k('extensor-suspected-rupture')]: opt('Suspected rupture'),
    },
  },
  'flexor-tendon': {
    label: 'Flexor tendon integrity',
    options: {
      [k('flexor-intact')]: opt('Intact'),
      [k('flexor-suspected-rupture')]: opt('Suspected rupture'),
    },
  },
  'subungual-hematoma': {
    label: 'Subungual hematoma',
    options: {
      [k('subungual-absent')]: opt('Absent'),
      [k('subungual-lt-25')]: opt('<25%'),
      [k('subungual-25-50')]: opt('25\u201350%'),
      [k('subungual-gt-50')]: opt('>50% nail bed'),
    },
  },
  trephination: {
    label: 'Trephination',
    options: {
      [k('trephination-no')]: opt('No'),
      [k('trephination-yes')]: opt('Yes'),
    },
  },
});

const fingerInspectionPrefix: (k: (suffix: string) => string) => Record<string, ExamModalOptionGroup> = (k) => ({
  'fingers-affected': {
    label: 'Finger(s) affected',
    options: {
      [k('finger-thumb')]: opt('Thumb'),
      [k('finger-index')]: opt('Index'),
      [k('finger-middle')]: opt('Middle'),
      [k('finger-ring')]: opt('Ring'),
      [k('finger-little')]: opt('Little'),
    },
  },
});

const fingerSpecialTests: SpecialTestsBuilder = (k) => ({
  'dip-tenderness': {
    label: 'DIP tenderness',
    options: {
      [k('dip-tenderness-none')]: opt('None'),
      [k('dip-tenderness-present')]: opt('Present'),
    },
  },
  'dip-swelling': {
    label: 'DIP swelling',
    options: {
      [k('dip-swelling-none')]: opt('None'),
      [k('dip-swelling-present')]: opt('Present'),
    },
  },
  'dip-rom': {
    label: 'DIP ROM',
    options: {
      [k('dip-rom-full')]: opt('Full'),
      [k('dip-rom-limited')]: opt('Limited'),
      [k('dip-rom-unable')]: opt('Unable'),
    },
  },
  'dip-stability': {
    label: 'DIP stability',
    options: {
      [k('dip-stability-stable')]: opt('Stable'),
      [k('dip-stability-lax-radial')]: opt('Lax \u2014 Radial'),
      [k('dip-stability-lax-ulnar')]: opt('Lax \u2014 Ulnar'),
    },
  },
  'dip-deformity': {
    label: 'DIP deformity',
    options: {
      [k('dip-deformity-none')]: opt('None'),
      [k('dip-deformity-mallet')]: opt('Mallet'),
      [k('dip-deformity-boutonniere')]: opt('Boutonni\u00e8re'),
    },
  },
  'pip-tenderness': {
    label: 'PIP tenderness',
    options: {
      [k('pip-tenderness-none')]: opt('None'),
      [k('pip-tenderness-present')]: opt('Present'),
    },
  },
  'pip-swelling': {
    label: 'PIP swelling',
    options: {
      [k('pip-swelling-none')]: opt('None'),
      [k('pip-swelling-present')]: opt('Present'),
    },
  },
  'pip-rom': {
    label: 'PIP ROM',
    options: {
      [k('pip-rom-full')]: opt('Full'),
      [k('pip-rom-limited')]: opt('Limited'),
      [k('pip-rom-unable')]: opt('Unable'),
    },
  },
  'pip-stability': {
    label: 'PIP stability',
    options: {
      [k('pip-stability-stable')]: opt('Stable'),
      [k('pip-stability-lax-radial')]: opt('Lax \u2014 Radial'),
      [k('pip-stability-lax-ulnar')]: opt('Lax \u2014 Ulnar'),
    },
  },
  'pip-deformity': {
    label: 'PIP deformity',
    options: {
      [k('pip-deformity-none')]: opt('None'),
      [k('pip-deformity-mallet')]: opt('Mallet'),
      [k('pip-deformity-boutonniere')]: opt('Boutonni\u00e8re'),
    },
  },
  'mcp-tenderness': {
    label: 'MCP tenderness',
    options: {
      [k('mcp-tenderness-none')]: opt('None'),
      [k('mcp-tenderness-present')]: opt('Present'),
    },
  },
  'mcp-swelling': {
    label: 'MCP swelling',
    options: {
      [k('mcp-swelling-none')]: opt('None'),
      [k('mcp-swelling-present')]: opt('Present'),
    },
  },
  'mcp-rom': {
    label: 'MCP ROM',
    options: {
      [k('mcp-rom-full')]: opt('Full'),
      [k('mcp-rom-limited')]: opt('Limited'),
      [k('mcp-rom-unable')]: opt('Unable'),
    },
  },
  'mcp-stability': {
    label: 'MCP stability',
    options: {
      [k('mcp-stability-stable')]: opt('Stable'),
      [k('mcp-stability-lax-radial')]: opt('Lax \u2014 Radial'),
      [k('mcp-stability-lax-ulnar')]: opt('Lax \u2014 Ulnar'),
    },
  },
  'mcp-deformity': {
    label: 'MCP deformity',
    options: {
      [k('mcp-deformity-none')]: opt('None'),
      [k('mcp-deformity-dislocation')]: opt('Dislocation'),
    },
  },
});

const kneeSpecialTests: SpecialTestsBuilder = (k) => ({
  lachman: {
    label: 'Lachman',
    options: {
      [k('lachman-neg')]: opt('Neg'),
      [k('lachman-pos')]: opt('Pos'),
    },
  },
  'anterior-drawer': {
    label: 'Anterior drawer',
    options: {
      [k('anterior-drawer-neg')]: opt('Neg'),
      [k('anterior-drawer-pos')]: opt('Pos'),
    },
  },
  'posterior-drawer': {
    label: 'Posterior drawer',
    options: {
      [k('posterior-drawer-neg')]: opt('Neg'),
      [k('posterior-drawer-pos')]: opt('Pos'),
    },
  },
  mcmurray: {
    label: 'McMurray',
    options: {
      [k('mcmurray-neg')]: opt('Neg'),
      [k('mcmurray-pos-medial')]: opt('Pos \u2014 Medial'),
      [k('mcmurray-pos-lateral')]: opt('Pos \u2014 Lateral'),
    },
  },
  'valgus-stress': {
    label: 'Valgus stress',
    options: {
      [k('valgus-stable')]: opt('Stable'),
      [k('valgus-lax')]: opt('Lax'),
    },
  },
  'varus-stress': {
    label: 'Varus stress',
    options: {
      [k('varus-stable')]: opt('Stable'),
      [k('varus-lax')]: opt('Lax'),
    },
  },
  'patellar-grind': {
    label: 'Patellar grind',
    options: {
      [k('patellar-grind-neg')]: opt('Neg'),
      [k('patellar-grind-pos')]: opt('Pos'),
    },
  },
  effusion: {
    label: 'Effusion',
    options: {
      [k('effusion-none')]: opt('None'),
      [k('effusion-present')]: opt('Present'),
      [k('effusion-ballottement')]: opt('Ballottement'),
      [k('effusion-bulge-sign')]: opt('Bulge sign'),
    },
  },
});

const hipSpecialTests: SpecialTestsBuilder = (k) => ({
  faber: {
    label: 'FABER',
    options: {
      [k('faber-neg')]: opt('Neg'),
      [k('faber-pos')]: opt('Pos'),
    },
  },
  fadir: {
    label: 'FADIR',
    options: {
      [k('fadir-neg')]: opt('Neg'),
      [k('fadir-pos')]: opt('Pos'),
    },
  },
  'log-roll': {
    label: 'Log roll',
    options: {
      [k('log-roll-neg')]: opt('Neg'),
      [k('log-roll-pos')]: opt('Pos'),
    },
  },
  trendelenburg: {
    label: 'Trendelenburg',
    options: {
      [k('trendelenburg-neg')]: opt('Neg'),
      [k('trendelenburg-pos')]: opt('Pos'),
    },
  },
  'greater-trochanter': {
    label: 'Greater trochanter tenderness',
    options: {
      [k('trochanter-absent')]: opt('Absent'),
      [k('trochanter-present')]: opt('Present'),
    },
  },
});

const ankleSpecialTests: SpecialTestsBuilder = (k) => ({
  'anterior-drawer': {
    label: 'Anterior drawer',
    options: {
      [k('anterior-drawer-neg')]: opt('Neg'),
      [k('anterior-drawer-pos')]: opt('Pos'),
    },
  },
  'talar-tilt': {
    label: 'Talar tilt',
    options: {
      [k('talar-tilt-neg')]: opt('Neg'),
      [k('talar-tilt-pos')]: opt('Pos'),
    },
  },
  'squeeze-test': {
    label: 'Squeeze test (syndesmosis)',
    options: {
      [k('squeeze-neg')]: opt('Neg'),
      [k('squeeze-pos')]: opt('Pos'),
    },
  },
  'thompson-test': {
    label: 'Thompson test',
    options: {
      [k('thompson-neg')]: opt('Neg'),
      [k('thompson-pos')]: opt('Pos'),
    },
  },
});

const footToeSpecialTests: SpecialTestsBuilder = (k) => ({
  'toes-affected': {
    label: 'Toe(s) affected',
    options: {
      [k('toe-hallux')]: opt('Hallux'),
      [k('toe-2nd')]: opt('2nd'),
      [k('toe-3rd')]: opt('3rd'),
      [k('toe-4th')]: opt('4th'),
      [k('toe-5th')]: opt('5th'),
    },
  },
  'midfoot-tenderness': {
    label: 'Midfoot tenderness',
    options: {
      [k('midfoot-none')]: opt('None'),
      [k('midfoot-navicular')]: opt('Navicular'),
      [k('midfoot-5th-met-base')]: opt('5th metatarsal base'),
    },
  },
  'plantar-fascia': {
    label: 'Plantar fascia',
    options: {
      [k('plantar-normal')]: opt('Normal'),
      [k('plantar-tender')]: opt('Tender'),
    },
  },
  'subungual-hematoma': {
    label: 'Subungual hematoma',
    options: {
      [k('subungual-absent')]: opt('Absent'),
      [k('subungual-lt-25')]: opt('<25%'),
      [k('subungual-25-50')]: opt('25\u201350%'),
      [k('subungual-gt-50')]: opt('>50% nail bed'),
    },
  },
  'nail-integrity': {
    label: 'Nail integrity',
    options: {
      [k('nail-intact')]: opt('Intact'),
      [k('nail-avulsion')]: opt('Avulsion'),
      [k('nail-partial-avulsion')]: opt('Partial avulsion'),
    },
  },
  'tuft-fracture': {
    label: 'Tuft fracture suspected',
    options: {
      [k('tuft-no')]: opt('No'),
      [k('tuft-yes-toe-series')]: opt('Yes \u2192 order: Toe series'),
    },
  },
});

function createLymphNodeModalExam(
  nodeKey: string,
  nodeLabel: string,
  columns: ColumnConfig[]
): ExamCardCheckboxWithModalComponent {
  const makeColumnsForSection = (
    groupsBuilder: (ck: (suffix: string) => string) => Record<string, ExamModalOptionGroup>
  ): Record<string, ExamModalOptionColumn> =>
    Object.fromEntries(
      columns.map(({ key, header, headerAbbreviation }) => {
        const ck = (suffix: string): string => `${nodeKey}-${key}-${suffix}`;
        return [key, { header, headerAbbreviation, groups: groupsBuilder(ck) }];
      })
    );

  return {
    label: nodeLabel,
    defaultValue: false,
    type: 'checkbox-with-modal' as const,
    modal: {
      status: {
        label: 'Status',
        columns: makeColumnsForSection((ck) => ({
          status: {
            label: 'Status',
            options: {
              [ck('normal')]: opt('Normal'),
              [ck('enlarged')]: opt('Enlarged'),
              [ck('tender')]: opt('Tender'),
            },
          },
        })),
      },
      'node-characteristics': {
        label: 'Node Characteristics',
        columns: makeColumnsForSection((ck) => ({
          size: {
            label: 'Size',
            options: {
              [ck('size-lt-1cm')]: opt('<1cm'),
              [ck('size-1-2cm')]: opt('1\u20132cm'),
              [ck('size-gt-2cm')]: opt('>2cm'),
            },
          },
          texture: {
            label: 'Texture',
            options: {
              [ck('texture-soft')]: opt('Soft'),
              [ck('texture-firm')]: opt('Firm'),
              [ck('texture-hard')]: opt('Hard'),
              [ck('texture-matted')]: opt('Matted'),
            },
          },
          mobility: {
            label: 'Mobility',
            options: {
              [ck('mobility-mobile')]: opt('Mobile'),
              [ck('mobility-fixed')]: opt('Fixed'),
            },
          },
          tenderness: {
            label: 'Tenderness',
            options: {
              [ck('char-tender')]: opt('Tender'),
              [ck('char-non-tender')]: opt('Non-tender'),
            },
          },
          'overlying-skin': {
            label: 'Overlying skin',
            options: {
              [ck('skin-normal')]: opt('Normal'),
              [ck('skin-erythema')]: opt('Erythema'),
              [ck('skin-fluctuant')]: opt('Fluctuant'),
            },
          },
        })),
      },
    },
  };
}

export const InPersonExamConfig: ExamItemConfig = {
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
          type: 'checkbox-with-modal' as const,
          modal: {
            'external-nose': {
              label: 'External Nose',
              columns: {
                'single-column': {
                  groups: {
                    appearance: {
                      label: 'Appearance',
                      options: {
                        'ext-nose-normal': opt('Normal'),
                        'ext-nose-erythema': opt('Erythema'),
                        'ext-nose-swelling': opt('Swelling'),
                        'ext-nose-deformity': opt('Deformity'),
                      },
                    },
                    tenderness: {
                      label: 'Tenderness',
                      options: {
                        'ext-nose-tenderness-none': opt('None'),
                        'ext-nose-tenderness-dorsum': opt('Dorsum'),
                        'ext-nose-tenderness-tip': opt('Tip'),
                        'ext-nose-tenderness-ala': opt('Ala'),
                      },
                    },
                    crepitus: {
                      label: 'Crepitus',
                      options: {
                        'ext-nose-crepitus-absent': opt('Absent'),
                        'ext-nose-crepitus-present': opt('Present'),
                      },
                    },
                  },
                },
              },
            },
          },
        },
        'anterior-rhinoscopy': {
          label: 'Anterior rhinoscopy',
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            rhinoscopy: {
              label: 'Anterior Rhinoscopy',
              columns: {
                left: {
                  header: 'Left',
                  headerAbbreviation: 'L',
                  groups: {
                    patency: {
                      label: 'Patency',
                      options: {
                        'rhinoscopy-l-patent': opt('Patent'),
                        'rhinoscopy-l-partial': opt('Partial'),
                        'rhinoscopy-l-obstructed': opt('Obstructed'),
                      },
                    },
                    mucosa: {
                      label: 'Mucosa',
                      options: {
                        'rhinoscopy-l-mucosa-normal': opt('Normal'),
                        'rhinoscopy-l-mucosa-pale-boggy': opt('Pale/boggy'),
                        'rhinoscopy-l-mucosa-erythematous': opt('Erythematous'),
                      },
                    },
                    'inf-turbinate': {
                      label: 'Inf. turbinate',
                      options: {
                        'rhinoscopy-l-turbinate-normal': opt('Normal'),
                        'rhinoscopy-l-turbinate-hypertrophied': opt('Hypertrophied'),
                      },
                    },
                    septum: {
                      label: 'Septum',
                      options: {
                        'rhinoscopy-l-septum-midline': opt('Midline'),
                        'rhinoscopy-l-septum-no-hematoma': opt('No Hematoma'),
                        'rhinoscopy-l-septum-dev-r': opt('Dev R'),
                        'rhinoscopy-l-septum-dev-l': opt('Dev L'),
                        'rhinoscopy-l-septum-hematoma': opt('Hematoma'),
                      },
                    },
                    discharge: {
                      label: 'Discharge',
                      options: {
                        'rhinoscopy-l-discharge-none': opt('None'),
                        'rhinoscopy-l-discharge-clear': opt('Clear'),
                        'rhinoscopy-l-discharge-mucopurulent': opt('Mucopurulent'),
                        'rhinoscopy-l-discharge-bloody': opt('Bloody'),
                      },
                    },
                    'polyps-fb': {
                      label: 'Polyps/FB',
                      options: {
                        'rhinoscopy-l-polyps-none': opt('None'),
                        'rhinoscopy-l-polyps-polyps': opt('Polyps'),
                        'rhinoscopy-l-fb-r': opt('FB \u2014 R'),
                        'rhinoscopy-l-fb-l': opt('FB \u2014 L'),
                      },
                    },
                  },
                },
                right: {
                  header: 'Right',
                  headerAbbreviation: 'R',
                  groups: {
                    patency: {
                      label: 'Patency',
                      options: {
                        'rhinoscopy-r-patent': opt('Patent'),
                        'rhinoscopy-r-partial': opt('Partial'),
                        'rhinoscopy-r-obstructed': opt('Obstructed'),
                      },
                    },
                    mucosa: {
                      label: 'Mucosa',
                      options: {
                        'rhinoscopy-r-mucosa-normal': opt('Normal'),
                        'rhinoscopy-r-mucosa-pale-boggy': opt('Pale/boggy'),
                        'rhinoscopy-r-mucosa-erythematous': opt('Erythematous'),
                      },
                    },
                    'inf-turbinate': {
                      label: 'Inf. turbinate',
                      options: {
                        'rhinoscopy-r-turbinate-normal': opt('Normal'),
                        'rhinoscopy-r-turbinate-hypertrophied': opt('Hypertrophied'),
                      },
                    },
                    septum: {
                      label: 'Septum',
                      options: {
                        'rhinoscopy-r-septum-midline': opt('Midline'),
                        'rhinoscopy-r-septum-no-hematoma': opt('No Hematoma'),
                        'rhinoscopy-r-septum-dev-r': opt('Dev R'),
                        'rhinoscopy-r-septum-dev-l': opt('Dev L'),
                        'rhinoscopy-r-septum-hematoma': opt('Hematoma'),
                      },
                    },
                    discharge: {
                      label: 'Discharge',
                      options: {
                        'rhinoscopy-r-discharge-none': opt('None'),
                        'rhinoscopy-r-discharge-clear': opt('Clear'),
                        'rhinoscopy-r-discharge-mucopurulent': opt('Mucopurulent'),
                        'rhinoscopy-r-discharge-bloody': opt('Bloody'),
                      },
                    },
                    'polyps-fb': {
                      label: 'Polyps/FB',
                      options: {
                        'rhinoscopy-r-polyps-none': opt('None'),
                        'rhinoscopy-r-polyps-polyps': opt('Polyps'),
                        'rhinoscopy-r-fb-r': opt('FB \u2014 R'),
                        'rhinoscopy-r-fb-l': opt('FB \u2014 L'),
                      },
                    },
                  },
                },
              },
            },
          },
        },
        epistaxis: {
          label: 'Epistaxis',
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            epistaxis: {
              label: 'Epistaxis',
              columns: {
                'single-column': {
                  groups: {
                    location: {
                      label: 'Location',
                      options: {
                        'epistaxis-not-present': opt('Not present'),
                        'epistaxis-anterior': opt('Anterior'),
                        'epistaxis-posterior': opt('Posterior'),
                      },
                    },
                    source: {
                      label: 'Source',
                      options: {
                        'epistaxis-source-kiesselbach': opt('Kiesselbach'),
                        'epistaxis-source-other': opt('Other'),
                      },
                    },
                    volume: {
                      label: 'Volume',
                      options: {
                        'epistaxis-volume-scant': opt('Scant'),
                        'epistaxis-volume-moderate': opt('Moderate'),
                        'epistaxis-volume-large': opt('Large'),
                      },
                    },
                  },
                },
              },
            },
          },
        },
        'sinus-tenderness': {
          label: 'Sinus tenderness',
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            'sinus-tenderness': {
              label: 'Sinus Tenderness',
              columns: {
                'single-column': {
                  groups: {
                    general: {
                      label: 'General',
                      options: {
                        'sinus-all-non-tender': opt('All non-tender'),
                      },
                    },
                    frontal: {
                      label: 'Frontal',
                      options: {
                        'sinus-frontal-r': opt('Right'),
                        'sinus-frontal-l': opt('Left'),
                      },
                    },
                    maxillary: {
                      label: 'Maxillary',
                      options: {
                        'sinus-maxillary-r': opt('Right'),
                        'sinus-maxillary-l': opt('Left'),
                      },
                    },
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
        'dental-caries': { label: 'Dental caries', defaultValue: false, type: 'checkbox' },
      },
      comment: { 'oral-comment': { label: 'Oral comment', type: 'text' } },
    },
  },
  neck: {
    label: 'Neck',
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
        'right-cervical-node-easily-mobile-non-tender-not-erythematous': {
          label: 'Right cervical node, easily mobile, non-tender, not erythematous',
          defaultValue: false,
          type: 'checkbox',
          legacy: true,
        },
        'left-cervical-node-easily-mobile-non-tender-not-erythematous': {
          label: 'Left cervical node, easily mobile, non-tender, not erythematous',
          defaultValue: false,
          type: 'checkbox',
          legacy: true,
        },
        'lymph-anterior-cervical': createLymphNodeModalExam('lymph-anterior-cervical', 'Anterior cervical', LR_COLUMNS),
        'lymph-posterior-cervical': createLymphNodeModalExam(
          'lymph-posterior-cervical',
          'Posterior cervical',
          LR_COLUMNS
        ),
        'lymph-submandibular': createLymphNodeModalExam('lymph-submandibular', 'Submandibular', LR_COLUMNS),
        'lymph-supraclavicular': createLymphNodeModalExam('lymph-supraclavicular', 'Supraclavicular', LR_COLUMNS),
        'lymph-submental': createLymphNodeModalExam('lymph-submental', 'Submental', SINGLE_COLUMN),
        'lymph-axillary': createLymphNodeModalExam('lymph-axillary', 'Axillary', LR_COLUMNS),
        'lymph-inguinal': createLymphNodeModalExam('lymph-inguinal', 'Inguinal', LR_COLUMNS),
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
          type: 'checkbox-with-modal' as const,
          modal: {
            'adult-findings': {
              label: 'Common Findings',
              columns: {
                'single-column': {
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
              },
            },
            'pediatric-findings': {
              label: 'Pediatric',
              columns: {
                'single-column': {
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
                          description:
                            'linear patches and clusters of erythematous-based vesicles, some dry, no burrows',
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
          },
        },
        'skin-location': {
          label: 'Location',
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            location: {
              label: 'Location(s)',
              columns: {
                'single-column': {
                  groups: {
                    'head-neck': {
                      label: 'Head & Neck',
                      options: {
                        'skin-loc-scalp': opt('Scalp'),
                        'skin-loc-face': opt('Face'),
                        'skin-loc-ears': opt('Ears'),
                        'skin-loc-lips-perioral': opt('Lips/perioral'),
                        'skin-loc-neck': opt('Neck'),
                        'skin-loc-mucous-membranes': opt('Mucous membranes'),
                      },
                    },
                    trunk: {
                      label: 'Trunk',
                      options: {
                        'skin-loc-chest': opt('Chest'),
                        'skin-loc-abdomen': opt('Abdomen'),
                        'skin-loc-back': opt('Back'),
                        'skin-loc-flank': opt('Flank'),
                        'skin-loc-groin': opt('Groin'),
                        'skin-loc-genitalia': opt('Genitalia'),
                      },
                    },
                    'upper-extremity': {
                      label: 'Upper Extremity',
                      options: {
                        'skin-loc-shoulder': opt('Shoulder'),
                        'skin-loc-upper-arm': opt('Upper arm'),
                        'skin-loc-elbow': opt('Elbow'),
                        'skin-loc-forearm': opt('Forearm'),
                        'skin-loc-wrist': opt('Wrist'),
                        'skin-loc-hand-fingers': opt('Hand/fingers'),
                      },
                    },
                    'lower-extremity': {
                      label: 'Lower Extremity',
                      options: {
                        'skin-loc-hip-buttock': opt('Hip/buttock'),
                        'skin-loc-thigh': opt('Thigh'),
                        'skin-loc-knee': opt('Knee'),
                        'skin-loc-lower-leg': opt('Lower leg'),
                        'skin-loc-ankle': opt('Ankle'),
                        'skin-loc-foot-toes': opt('Foot/toes'),
                      },
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
          type: 'checkbox-with-modal' as const,
          modal: {
            characteristics: {
              label: 'Lesion Characteristics',
              columns: {
                'single-column': {
                  groups: {
                    type: {
                      label: 'Type',
                      options: {
                        'skin-lesion-macule': opt('Macule'),
                        'skin-lesion-patch': opt('Patch'),
                        'skin-lesion-papule': opt('Papule'),
                        'skin-lesion-plaque': opt('Plaque'),
                        'skin-lesion-vesicle': opt('Vesicle'),
                        'skin-lesion-bulla': opt('Bulla'),
                        'skin-lesion-pustule': opt('Pustule'),
                        'skin-lesion-nodule': opt('Nodule'),
                        'skin-lesion-wheal': opt('Wheal'),
                        'skin-lesion-ulcer': opt('Ulcer'),
                      },
                    },
                    color: {
                      label: 'Color',
                      options: {
                        'skin-lesion-erythematous': opt('Erythematous'),
                        'skin-lesion-violaceous': opt('Violaceous'),
                        'skin-lesion-brown': opt('Brown'),
                        'skin-lesion-hypopigmented': opt('Hypopigmented'),
                        'skin-lesion-hyperpigmented': opt('Hyperpigmented'),
                        'skin-lesion-yellow': opt('Yellow'),
                        'skin-lesion-black': opt('Black'),
                      },
                    },
                    border: {
                      label: 'Border',
                      options: {
                        'skin-lesion-well-defined': opt('Well-defined'),
                        'skin-lesion-ill-defined': opt('Ill-defined'),
                        'skin-lesion-irregular': opt('Irregular'),
                      },
                    },
                    surface: {
                      label: 'Surface',
                      options: {
                        'skin-lesion-smooth': opt('Smooth'),
                        'skin-lesion-scaly': opt('Scaly'),
                        'skin-lesion-crusted': opt('Crusted'),
                        'skin-lesion-macerated': opt('Macerated'),
                      },
                    },
                    size: {
                      label: 'Size',
                      options: {
                        'skin-lesion-lt-1cm': opt('<1cm'),
                        'skin-lesion-1-5cm': opt('1\u20135cm'),
                        'skin-lesion-gt-5cm': opt('>5cm'),
                      },
                    },
                    blanching: {
                      label: 'Blanching',
                      options: {
                        'skin-lesion-blanching-yes': opt('Yes'),
                        'skin-lesion-blanching-no': opt('No'),
                      },
                    },
                  },
                },
              },
            },
          },
        },
        'skin-wound-laceration': {
          label: 'Wound / laceration',
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            wound: {
              label: 'Wound / Laceration',
              columns: {
                'single-column': {
                  groups: {
                    presence: {
                      label: 'Presence',
                      options: {
                        'skin-wound-not-present': opt('Not present'),
                      },
                    },
                    depth: {
                      label: 'Depth',
                      options: {
                        'skin-wound-superficial': opt('Superficial'),
                        'skin-wound-subcutaneous': opt('Subcutaneous'),
                        'skin-wound-deep-fascial': opt('Deep/fascial'),
                      },
                    },
                    edges: {
                      label: 'Edges',
                      options: {
                        'skin-wound-edges-clean': opt('Clean'),
                        'skin-wound-edges-jagged': opt('Jagged'),
                        'skin-wound-edges-avulsion': opt('Avulsion'),
                      },
                    },
                    contamination: {
                      label: 'Contamination',
                      options: {
                        'skin-wound-contam-none': opt('None'),
                        'skin-wound-contam-mild': opt('Mild'),
                        'skin-wound-contam-heavy': opt('Heavy'),
                      },
                    },
                    'neurovascular-distal': {
                      label: 'Neurovascular distal',
                      options: {
                        'skin-wound-nv-intact': opt('Intact'),
                        'skin-wound-nv-compromised': opt('Compromised'),
                      },
                    },
                    'tendon-bone': {
                      label: 'Tendon/bone visible',
                      options: {
                        'skin-wound-tendon-no': opt('No'),
                        'skin-wound-tendon-yes': opt('Yes'),
                      },
                    },
                  },
                },
              },
            },
          },
        },
        'skin-abscess-cellulitis': {
          label: 'Abscess / cellulitis',
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            abscess: {
              label: 'Abscess / Cellulitis',
              columns: {
                'single-column': {
                  groups: {
                    presence: {
                      label: 'Presence',
                      options: {
                        'skin-abscess-not-present': opt('Not present'),
                      },
                    },
                    abscess: {
                      label: 'Abscess',
                      options: {
                        'skin-abscess-fluctuant': opt('Fluctuant'),
                        'skin-abscess-non-fluctuant': opt('Non-fluctuant'),
                      },
                    },
                    cellulitis: {
                      label: 'Cellulitis',
                      options: {
                        'skin-cellulitis-absent': opt('Absent'),
                        'skin-cellulitis-present': opt('Present'),
                      },
                    },
                    'borders-marked': {
                      label: 'Borders marked',
                      options: {
                        'skin-cellulitis-borders-no': opt('No'),
                        'skin-cellulitis-borders-yes': opt('Yes'),
                      },
                    },
                    streaking: {
                      label: 'Streaking',
                      options: {
                        'skin-streaking-absent': opt('Absent'),
                        'skin-streaking-present': opt('Present'),
                      },
                    },
                  },
                },
              },
            },
          },
        },
        'skin-burn': {
          label: 'Burn',
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            burn: {
              label: 'Burn',
              columns: {
                'single-column': {
                  groups: {
                    presence: {
                      label: 'Presence',
                      options: {
                        'skin-burn-not-present': opt('Not present'),
                      },
                    },
                    degree: {
                      label: 'Degree',
                      options: {
                        'skin-burn-superficial-1st': opt('Superficial (1st)'),
                        'skin-burn-partial-2nd': opt('Partial thickness (2nd)'),
                        'skin-burn-full-3rd': opt('Full thickness (3rd)'),
                      },
                    },
                    tbsa: {
                      label: 'TBSA estimate',
                      options: {
                        'skin-burn-tbsa-lt-1': opt('<1%'),
                        'skin-burn-tbsa-1-5': opt('1\u20135%'),
                        'skin-burn-tbsa-6-10': opt('6\u201310%'),
                        'skin-burn-tbsa-gt-10': opt('>10%'),
                      },
                    },
                  },
                },
              },
            },
          },
        },
        'skin-bite-sting': {
          label: 'Bite / sting',
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            bite: {
              label: 'Bite / Sting',
              columns: {
                'single-column': {
                  groups: {
                    presence: {
                      label: 'Presence',
                      options: {
                        'skin-bite-not-present': opt('Not present'),
                      },
                    },
                    source: {
                      label: 'Source',
                      options: {
                        'skin-bite-human': opt('Human'),
                        'skin-bite-dog': opt('Dog'),
                        'skin-bite-cat': opt('Cat'),
                        'skin-bite-spider': opt('Spider'),
                        'skin-bite-insect': opt('Insect'),
                        'skin-bite-unknown': opt('Unknown'),
                      },
                    },
                    'wound-type': {
                      label: 'Wound type',
                      options: {
                        'skin-bite-puncture': opt('Puncture'),
                        'skin-bite-laceration': opt('Laceration'),
                        'skin-bite-crush': opt('Crush'),
                      },
                    },
                    'signs-of-infection': {
                      label: 'Signs of infection',
                      options: {
                        'skin-bite-infection-none': opt('None'),
                        'skin-bite-infection-early': opt('Early'),
                        'skin-bite-infection-established': opt('Established'),
                      },
                    },
                    'tick-attached': {
                      label: 'Tick attached',
                      options: {
                        'skin-bite-tick-no': opt('No'),
                        'skin-bite-tick-yes-removed': opt('Yes \u2014 removal performed'),
                        'skin-bite-tick-yes-not-removed': opt('Yes \u2014 not removed'),
                      },
                    },
                    'bullseye-rash': {
                      label: 'Bullseye rash',
                      options: {
                        'skin-bite-bullseye-absent': opt('Absent'),
                        'skin-bite-bullseye-present': opt('Present'),
                      },
                    },
                  },
                },
              },
            },
          },
        },
        'skin-associated-findings': {
          label: 'Associated findings',
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            associated: {
              label: 'Associated Findings',
              columns: {
                'single-column': {
                  groups: {
                    findings: {
                      label: 'Findings',
                      options: {
                        'skin-assoc-none': opt('None'),
                        'skin-assoc-angioedema': opt('Angioedema'),
                        'skin-assoc-desquamation': opt('Desquamation'),
                        'skin-assoc-nikolsky': opt('Nikolsky sign'),
                      },
                    },
                  },
                },
              },
            },
          },
        },
        'skin-distribution': {
          label: 'Distribution pattern',
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            distribution: {
              label: 'Distribution Pattern',
              columns: {
                'single-column': {
                  groups: {
                    pattern: {
                      label: 'Pattern',
                      options: {
                        'skin-dist-dermatomal': opt('Dermatomal'),
                        'skin-dist-flexural': opt('Flexural'),
                        'skin-dist-extensor': opt('Extensor'),
                        'skin-dist-sun-exposed': opt('Sun-exposed'),
                        'skin-dist-intertriginous': opt('Intertriginous'),
                        'skin-dist-palms-soles': opt('Palms/soles'),
                        'skin-dist-mucous-membranes': opt('Mucous membranes involved'),
                      },
                    },
                    side: {
                      label: 'Side',
                      options: {
                        'skin-side-r': opt('R'),
                        'skin-side-l': opt('L'),
                        'skin-side-bilateral': opt('Bilateral'),
                        'skin-side-midline': opt('Midline'),
                      },
                    },
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
          label: 'I-II/VI holosystolic murmur best at LLSB',
          defaultValue: false,
          type: 'checkbox',
        },
        tachycardia: { label: 'Tachycardia', defaultValue: false, type: 'checkbox' },
        'murmur-grade': {
          label: 'Murmur',
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            murmur: {
              label: 'Murmur',
              columns: {
                'single-column': {
                  groups: {
                    grade: {
                      label: 'Grade',
                      options: {
                        'murmur-i': opt('Grade I'),
                        'murmur-ii': opt('Grade II'),
                        'murmur-iii': opt('Grade III'),
                        'murmur-iv': opt('Grade IV'),
                        'murmur-v': opt('Grade V'),
                        'murmur-vi': opt('Grade VI'),
                      },
                    },
                  },
                },
              },
            },
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
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            wheezing: {
              label: 'Wheezing',
              columns: {
                'single-column': {
                  groups: {
                    location: {
                      label: 'Location',
                      options: {
                        'wheezing-left-upper': opt('Left upper'),
                        'wheezing-left-lower': opt('Left lower'),
                        'wheezing-right-upper': opt('Right upper'),
                        'wheezing-right-middle': opt('Right middle'),
                        'wheezing-right-lower': opt('Right lower'),
                      },
                    },
                  },
                },
              },
            },
          },
        },
        crackles: {
          label: 'Crackles',
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            crackles: {
              label: 'Crackles',
              columns: {
                'single-column': {
                  groups: {
                    location: {
                      label: 'Location',
                      options: {
                        'crackles-left-upper': opt('Left upper'),
                        'crackles-left-lower': opt('Left lower'),
                        'crackles-right-upper': opt('Right upper'),
                        'crackles-right-middle': opt('Right middle'),
                        'crackles-right-lower': opt('Right lower'),
                      },
                    },
                  },
                },
              },
            },
          },
        },
        'breath-sounds': {
          label: 'Decreased breath sounds',
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            'breath-sounds': {
              label: 'Decreased Breath Sounds',
              columns: {
                'single-column': {
                  groups: {
                    location: {
                      label: 'Location',
                      options: {
                        'breath-sounds-left-upper': opt('Left upper'),
                        'breath-sounds-left-lower': opt('Left lower'),
                        'breath-sounds-right-upper': opt('Right upper'),
                        'breath-sounds-right-middle': opt('Right middle'),
                        'breath-sounds-right-lower': opt('Right lower'),
                      },
                    },
                  },
                },
              },
            },
          },
        },
        retractions: {
          label: 'Retractions',
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            retractions: {
              label: 'Retractions',
              columns: {
                'single-column': {
                  groups: {
                    type: {
                      label: 'Type',
                      options: {
                        subcostal: opt('Subcostal'),
                        suprasternal: opt('Suprasternal'),
                        intercostal: opt('Intercostal'),
                      },
                    },
                  },
                },
              },
            },
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
          defaultValue: false,
          type: 'checkbox-with-modal' as const,
          modal: {
            tender: {
              label: 'Tender',
              columns: {
                'single-column': {
                  groups: {
                    location: {
                      label: 'Location',
                      options: {
                        diffusely: opt('Diffusely'),
                        ruq: opt('RUQ'),
                        rlq: opt('RLQ'),
                        luq: opt('LUQ'),
                        llq: opt('LLQ'),
                        'r-cva': opt('R CVA'),
                        'l-cva': opt('L CVA'),
                      },
                    },
                  },
                },
              },
            },
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
          legacy: true,
        },
        'limping-refusal-to-bear-weight': {
          label: 'Limping, refusal to bear weight',
          defaultValue: false,
          type: 'checkbox',
        },
        'point-tenderness-over-bone': {
          label: 'Point tenderness over bone',
          defaultValue: false,
          type: 'checkbox',
          legacy: true,
        },
        shoulder: createExtremityModalExam('shoulder', 'Shoulder', LR_COLUMNS, shoulderSpecialTests),
        elbow: createExtremityModalExam('elbow', 'Elbow', LR_COLUMNS, elbowSpecialTests),
        'hand-wrist': createExtremityModalExam('hand-wrist', 'Hand/Wrist', LR_COLUMNS, handWristSpecialTests),
        fingers: createExtremityModalExam('fingers', 'Fingers', LR_COLUMNS, fingerSpecialTests, fingerInspectionPrefix),
        hip: createExtremityModalExam('hip', 'Hip', LR_COLUMNS, hipSpecialTests),
        knee: createExtremityModalExam('knee', 'Knee', LR_COLUMNS, kneeSpecialTests),
        ankle: createExtremityModalExam('ankle', 'Ankle', LR_COLUMNS, ankleSpecialTests),
        'foot-toes': createExtremityModalExam('foot-toes', 'Foot/toes', LR_COLUMNS, footToeSpecialTests),
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
        'normal-testicular-exam': {
          label: 'Normal testicular exam, no tenderness, no erythema, cremasteric reflexes present',
          defaultValue: false,
          type: 'checkbox',
          legacy: true,
        },
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
        'scrotal-edema-swelling': {
          label: 'Scrotal edema / swelling',
          defaultValue: false,
          type: 'checkbox',
          legacy: true,
        },
        'right-side-scrotal-edema-swelling': {
          label: 'Right side - scrotal edema / swelling',
          defaultValue: false,
          type: 'checkbox',
        },
        'left-side-scrotal-edema-swelling': {
          label: 'Left side - scrotal edema / swelling',
          defaultValue: false,
          type: 'checkbox',
        },
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
        'right-side-hernia': { label: 'Right side - hernia', defaultValue: false, type: 'checkbox' },
        'left-side-hernia': { label: 'Left side - hernia', defaultValue: false, type: 'checkbox' },
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
      abnormal: {
        'external-hemorrhoids': { label: 'External hemorrhoids', defaultValue: false, type: 'checkbox' },
        'skin-tags': { label: 'Skin tags', defaultValue: false, type: 'checkbox' },
        'anal-fissure': { label: 'Anal fissure', defaultValue: false, type: 'checkbox' },
        'perianal-abscess': { label: 'Perianal abscess', defaultValue: false, type: 'checkbox' },
      },
      comment: { 'rectal-comment': { label: 'Rectal comment', type: 'text' } },
    },
  },
};
