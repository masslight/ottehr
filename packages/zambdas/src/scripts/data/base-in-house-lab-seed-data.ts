import { TestItem } from '../labs/load-in-house-labs-tests';

// seed data for base ottehr and UK
export const testItems: TestItem[] = [
  {
    name: 'Rapid Strep A',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
    },
    method: 'Manual',
    device: 'Strip Test (reagent strip)',
    cptCode: ['87880'],
    loincCode: ['78012-2'],
    repeatTest: false,
    components: [
      {
        componentName: 'Rapid Strep A',
        loincCode: ['78012-2'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Rapid Influenza A',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87804'],
    loincCode: ['80382-5'],
    repeatTest: false,
    components: [
      {
        componentName: 'Rapid Influenza A',
        loincCode: ['80382-5'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Rapid Influenza B',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87804'],
    loincCode: ['80381-7'],
    repeatTest: false,
    components: [
      {
        componentName: 'Rapid Influenza B',
        loincCode: ['80381-7'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Rapid RSV',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87807'],
    loincCode: ['72885-7'],
    repeatTest: false,
    components: [
      {
        componentName: 'Rapid RSV',
        loincCode: ['72885-7'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Rapid COVID-19 Antigen',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87426'],
    loincCode: ['94558-4'],
    repeatTest: false,
    components: [
      {
        componentName: 'Rapid COVID-19 Antigen',
        loincCode: ['94558-4'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Flu-Vid',
    methods: {
      analyzer: { device: 'Sofia' },
    },
    method: 'Analyzer',
    device: 'Sofia',
    cptCode: ['87428'],
    loincCode: ['80382-5', '94558-4'],
    repeatTest: false,
    components: [
      {
        componentName: 'Flu-Vid',
        loincCode: ['80382-5', '94558-4'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Stool Guaiac',
    methods: {
      manual: { device: 'None' },
    },
    method: 'Manual',
    device: '',
    cptCode: ['82270'],
    loincCode: ['50196-5'],
    repeatTest: true,
    components: [
      {
        componentName: 'Stool Guaiac',
        loincCode: ['50196-5'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Monospot test',
    methods: {
      manual: { device: 'Test well / tube' },
    },
    method: 'Manual',
    device: 'Test well / tube',
    cptCode: ['86308'],
    loincCode: ['31418-7'],
    repeatTest: false,
    components: [
      {
        componentName: 'Monospot test',
        loincCode: ['31418-7'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Glucose Finger/Heel Stick',
    methods: {
      manual: { device: 'Stick & glucometer' },
    },
    method: 'Manual with stick & glucometer',
    device: 'Glucometer brand unknown',
    cptCode: ['82962'],
    loincCode: ['32016-8'],
    repeatTest: true,
    components: [
      {
        componentName: 'Glucose',
        loincCode: ['32016-8'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 70,
          high: 140,
          unit: 'mg/dL',
        },
        display: {
          type: 'Numeric',
          nullOption: false,
        },
      },
    ],
  },
  {
    name: 'Urinalysis (UA)',
    methods: {
      analyzer: { device: 'Clinitek / Multitsix' },
    },
    method: 'Clinitek/ Multitsix',
    device: 'Clinitek',
    cptCode: ['81003'],
    loincCode: ['24356-8'],
    repeatTest: true,
    components: [
      {
        componentName: 'Glucose',
        loincCode: ['2350-7'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Not detected', display: 'Not detected' },
          { code: 'Trace', display: 'Trace' },
          { code: '1+', display: '1+' },
          { code: '2+', display: '2+' },
          { code: '3+', display: '3+' },
          { code: '4+', display: '4+' },
        ],
        abnormalValues: [
          { code: 'Trace', display: 'Trace' },
          { code: '1+', display: '1+' },
          { code: '2+', display: '2+' },
          { code: '3+', display: '3+' },
          { code: '4+', display: '4+' },
        ],
        unit: 'mg/dL',
        // currently quantitativeReference is not being mapped into the fhir resource
        // in the future, if we want we could map into the valueSet like "1+ 100 mg/dL" but not needed at the moment
        quantitativeReference: {
          Trace: '<100 mg/dL',
          '1+': '100 mg/dL',
          '2+': '250 mg/dL',
          '3+': '500 mg/dL',
          '4+': '≥1000 mg/dL',
        },
        display: {
          type: 'Select',
          nullOption: false,
        },
      },
      {
        componentName: 'Bilirubin',
        loincCode: ['1977-8'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Negative', display: 'Negative' },
          { code: 'Small (+)', display: 'Small (+)' },
          { code: 'Moderate (++)', display: 'Moderate (++)' },
          { code: 'Large (+++)', display: 'Large (+++)' },
        ],
        abnormalValues: [
          { code: 'Small (+)', display: 'Small (+)' },
          { code: 'Moderate (++)', display: 'Moderate (++)' },
          { code: 'Large (+++)', display: 'Large (+++)' },
        ],
        quantitativeReference: {
          '1+': 'small',
          '2+': 'moderate',
          '3+': 'large',
        },
        display: {
          type: 'Select',
          nullOption: false,
        },
      },
      {
        componentName: 'Ketone',
        loincCode: ['49779-2'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Negative', display: 'Negative' },
          { code: '5 mg/dL (trace)', display: '5 mg/dL (trace)' },
          { code: '15 mg/dL (small)', display: '15 mg/dL (small)' },
          { code: '40 mg/dL (moderate)', display: '40 mg/dL (moderate)' },
          { code: '80-160 mg/dL (large)', display: '80-160 mg/dL (large)' },
        ],
        abnormalValues: [
          { code: '5 mg/dL (trace)', display: '5 mg/dL (trace)' },
          { code: '15 mg/dL (small)', display: '15 mg/dL (small)' },
          { code: '40 mg/dL (moderate)', display: '40 mg/dL (moderate)' },
          { code: '80-160 mg/dL (large)', display: '80-160 mg/dL (large)' },
        ],
        unit: 'mg/dL',
        quantitativeReference: {
          Trace: '5 mg/dL',
          Small: '15 mg/dL',
          Moderate: '40 mg/dL',
          Large: '80-160 mg/dL',
        },
        display: {
          type: 'Select',
          nullOption: false,
        },
      },
      {
        componentName: 'Specific gravity',
        loincCode: ['2965-2'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 1.005,
          high: 1.03,
          unit: '', // specific gravity has no unit
          precision: 3,
        },
        display: {
          type: 'Numeric',
          nullOption: false,
        },
      },
      {
        componentName: 'Blood',
        loincCode: ['105906-2'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Not detected', display: 'Not detected' },
          { code: 'Trace', display: 'Trace' },
          { code: 'Small', display: 'Small' },
          { code: 'Moderate', display: 'Moderate' },
          { code: 'Large', display: 'Large' },
        ],
        abnormalValues: [
          { code: 'Trace', display: 'Trace' },
          { code: 'Small', display: 'Small' },
          { code: 'Moderate', display: 'Moderate' },
          { code: 'Large', display: 'Large' },
        ],
        display: {
          type: 'Select',
          nullOption: false,
        },
      },
      {
        componentName: 'pH',
        loincCode: ['2756-5'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 5.0,
          high: 8.0,
          unit: '', // ph has no unit
          precision: 1,
        },
        display: {
          type: 'Numeric',
          nullOption: false,
        },
      },
      {
        componentName: 'Protein',
        loincCode: ['2888-6'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Not detected', display: 'Not detected' },
          { code: 'Trace', display: 'Trace' },
          { code: '1+', display: '1+' },
          { code: '2+', display: '2+' },
          { code: '3+', display: '3+' },
          { code: '4+', display: '4+' },
        ],
        abnormalValues: [
          { code: 'Trace', display: 'Trace' },
          { code: '1+', display: '1+' },
          { code: '2+', display: '2+' },
          { code: '3+', display: '3+' },
          { code: '4+', display: '4+' },
        ],
        unit: 'mg/dL',
        quantitativeReference: {
          Trace: '10 mg/dL',
          '1+': '30 mg/dL',
          '2+': '100 mg/dL',
          '3+': '300 mg/dL',
          '4+': '≥2000 mg/dL',
        },
        display: {
          type: 'Select',
          nullOption: false,
        },
      },
      {
        componentName: 'Urobilinogen',
        loincCode: ['32727-0'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 0.2,
          high: 1.0,
          unit: 'EU/dL',
          precision: 1,
        },
        display: {
          type: 'Numeric',
          nullOption: false,
        },
      },
      {
        componentName: 'Nitrite',
        loincCode: ['32710-6'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Not detected', display: 'Not detected' },
          { code: 'Detected', display: 'Detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Select',
          nullOption: false,
        },
      },
      {
        componentName: 'Leukocytes',
        loincCode: ['105105-1'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Not detected', display: 'Not detected' },
          { code: 'Trace', display: 'Trace' },
          { code: 'Small', display: 'Small' },
          { code: 'Moderate', display: 'Moderate' },
          { code: 'Large', display: 'Large' },
        ],
        abnormalValues: [
          { code: 'Trace', display: 'Trace' },
          { code: 'Small', display: 'Small' },
          { code: 'Moderate', display: 'Moderate' },
          { code: 'Large', display: 'Large' },
        ],
        display: {
          type: 'Select',
          nullOption: false,
        },
      },
    ],
  },
  {
    name: 'Urine Pregnancy Test (HCG)',
    methods: {
      manual: { device: 'Strip/stick' },
    },
    method: 'Manual/Strip',
    device: 'Strip/stick',
    cptCode: ['81025'],
    loincCode: ['2106-3'],
    repeatTest: false,
    components: [
      {
        componentName: 'Urine Pregnancy Test (HCG)',
        loincCode: ['2106-3'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [], // empty array, because both results are normal in the context of the test
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'ID Now Strep',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbott ID Now',
    device: 'Abbott ID Now',
    cptCode: ['87651'],
    loincCode: ['104724-0'],
    repeatTest: false,
    components: [
      {
        componentName: 'ID Now Strep',
        loincCode: ['104724-0'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Flu A',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbott ID Now',
    device: 'Abbott ID Now',
    cptCode: ['87501'],
    loincCode: ['104730-7'],
    repeatTest: false,
    note: 'Same CPT as Flu B, same test sample/test as B, but separate result',
    components: [
      {
        componentName: 'Flu A',
        loincCode: ['104730-7'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Flu B',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbott ID Now',
    device: 'Abbott ID Now',
    cptCode: ['87501'],
    loincCode: ['106618-2'],
    repeatTest: false,
    note: 'Same CPT as Flu A, same test sample/test as A, but separate result',
    components: [
      {
        componentName: 'Flu B',
        loincCode: ['106618-2'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'RSV',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbott ID Now',
    device: 'Abbott ID Now',
    cptCode: ['87634'],
    loincCode: ['33045-6', '31949-1'],
    repeatTest: false,
    components: [
      {
        componentName: 'RSV',
        loincCode: ['33045-6', '31949-1'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'COVID-19 Antigen',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbott ID Now',
    device: 'Abbott ID Now',
    cptCode: ['87635'],
    loincCode: ['96119-3'],
    repeatTest: false,
    components: [
      {
        componentName: 'COVID-19 Antigen',
        loincCode: ['96119-3'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected' },
          { code: 'Not detected', display: 'Not detected' },
        ],
        abnormalValues: [{ code: 'Detected', display: 'Detected' }],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  {
    name: 'Snellen Test',
    methods: {
      manual: { device: 'Snellen Chart' },
      analyzer: { device: 'Unknown' },
    },
    method: 'Manual',
    device: 'Snellen Chart',
    cptCode: ['99173'],
    loincCode: ['98497-1'], // Visual Acuity Panel
    repeatTest: false,
    components: [
      {
        componentName: 'Left Eye',
        loincCode: ['79883-5'], // Visual acuity uncorrected Left eye by Snellen eye chart
        dataType: 'string' as const,
        display: {
          type: 'Free Text',
          validations: {
            format: { value: '^\\d+\\/\\d+(?:.\\d+)?(?:-\\d+\\/\\d+)?$', display: '#/#' },
          },
        },
      },
      {
        componentName: 'Right Eye',
        loincCode: ['79882-7'], // Visual acuity uncorrected Right eye by Snellen eye chart
        dataType: 'string' as const,
        display: {
          type: 'Free Text',
          validations: {
            format: { value: '^\\d+\\/\\d+(?:.\\d+)?(?:-\\d+\\/\\d+)?$', display: '#/#' },
          },
        },
      },
    ],
  },
];

// console.log('testItems in module:', testItems);
