import { AdminInHouseLabItemDefinition } from 'utils';

export const adminTestItemConfigs: Record<string, AdminInHouseLabItemDefinition> = {
  urinalysis: {
    name: 'Urinalysis (UA)',
    methods: {
      analyzer: { device: 'Clinitek / Multitsix' },
    },
    device: 'Clinitek',
    cptCode: [{ code: '81003' }],
    loincCode: ['24356-8'],
    repeatTest: true,
    components: [
      {
        componentName: 'Glucose',
        loincCode: ['2350-7'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Not detected', display: 'Not detected', isAbnormal: false },
          { code: 'Trace', display: 'Trace', isAbnormal: true },
          { code: '1+', display: '1+', isAbnormal: true },
          { code: '2+', display: '2+', isAbnormal: true },
          { code: '3+', display: '3+', isAbnormal: true },
          { code: '4+', display: '4+', isAbnormal: true },
        ],
        unit: 'mg/dL',
        // currently quantitativeReference is not being mapped into the fhir resource
        // in the future, if we want we could map into the valueSet like "1+ 100 mg/dL" but not needed at the moment
        // quantitativeReference: {
        //   Trace: '<100 mg/dL',
        //   '1+': '100 mg/dL',
        //   '2+': '250 mg/dL',
        //   '3+': '500 mg/dL',
        //   '4+': '≥1000 mg/dL',
        // },
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
          { code: 'Negative', display: 'Negative', isAbnormal: false },
          { code: 'Small (+)', display: 'Small (+)', isAbnormal: true },
          { code: 'Moderate (++)', display: 'Moderate (++)', isAbnormal: true },
          { code: 'Large (+++)', display: 'Large (+++)', isAbnormal: true },
        ],
        // quantitativeReference: {
        //   '1+': 'small',
        //   '2+': 'moderate',
        //   '3+': 'large',
        // },
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
          { code: 'Negative', display: 'Negative', isAbnormal: false },
          { code: '5 mg/dL (trace)', display: '5 mg/dL (trace)', isAbnormal: true },
          { code: '15 mg/dL (small)', display: '15 mg/dL (small)', isAbnormal: true },
          { code: '40 mg/dL (moderate)', display: '40 mg/dL (moderate)', isAbnormal: true },
          { code: '80-160 mg/dL (large)', display: '80-160 mg/dL (large)', isAbnormal: true },
        ],
        unit: 'mg/dL',
        // quantitativeReference: {
        //   Trace: '5 mg/dL',
        //   Small: '15 mg/dL',
        //   Moderate: '40 mg/dL',
        //   Large: '80-160 mg/dL',
        // },
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
          unit: '', // specific gravity has no unit // ATHENA TODO: not sure how this will get handled so leaving
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
          { code: 'Not detected', display: 'Not detected', isAbnormal: false },
          { code: 'Trace', display: 'Trace', isAbnormal: true },
          { code: 'Small', display: 'Small', isAbnormal: true },
          { code: 'Moderate', display: 'Moderate', isAbnormal: true },
          { code: 'Large', display: 'Large', isAbnormal: true },
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
          { code: 'Not detected', display: 'Not detected', isAbnormal: false },
          { code: 'Trace', display: 'Trace', isAbnormal: true },
          { code: '1+', display: '1+', isAbnormal: true },
          { code: '2+', display: '2+', isAbnormal: true },
          { code: '3+', display: '3+', isAbnormal: true },
          { code: '4+', display: '4+', isAbnormal: true },
        ],
        unit: 'mg/dL',
        // quantitativeReference: {
        //   Trace: '10 mg/dL',
        //   '1+': '30 mg/dL',
        //   '2+': '100 mg/dL',
        //   '3+': '300 mg/dL',
        //   '4+': '≥2000 mg/dL',
        // },
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
          { code: 'Not detected', display: 'Not detected', isAbnormal: false },
          { code: 'Detected', display: 'Detected', isAbnormal: true },
        ],
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
          { code: 'Not detected', display: 'Not detected', isAbnormal: false },
          { code: 'Trace', display: 'Trace', isAbnormal: true },
          { code: 'Small', display: 'Small', isAbnormal: true },
          { code: 'Moderate', display: 'Moderate', isAbnormal: true },
          { code: 'Large', display: 'Large', isAbnormal: true },
        ],
        display: {
          type: 'Select',
          nullOption: false,
        },
      },
    ],
  },
  'covid19-antigen': {
    name: 'COVID-19 Antigen',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    device: 'Abbott ID Now',
    cptCode: [{ code: '87635' }],
    loincCode: ['96119-3'],
    repeatTest: false,
    components: [
      {
        componentName: 'COVID-19 Antigen',
        loincCode: ['96119-3'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          { code: 'Detected', display: 'Detected', isAbnormal: true },
          { code: 'Not detected', display: 'Not detected', isAbnormal: false },
        ],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
  snellen: {
    name: 'Snellen Test',
    methods: {
      manual: { device: 'Snellen Chart' },
      analyzer: { device: 'Unknown' },
    },
    device: 'Snellen Chart',
    cptCode: [{ code: '99173' }],
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
            format: { value: '^\\d+\\/\\d+(?:.\\d+)?(?:-\\d+\\/\\d+)?$', display: '#/#' }, // the regex allows values like "20/20", "20/12.5", "20/60-20/70"
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
            format: { value: '^\\d+\\/\\d+(?:.\\d+)?(?:-\\d+\\/\\d+)?$', display: '#/#' }, // the regex allows values like "20/20", "20/12.5", "20/60-20/70"
          },
        },
      },
    ],
  },
  'alcohol-test': {
    name: 'Alcohol Test',
    methods: {
      analyzer: { device: 'breathalyzer' },
    },
    device: 'breathalyzer',
    cptCode: [{ code: '82075' }],
    loincCode: ['5641-6'],
    repeatTest: false,
    components: [
      {
        componentName: 'BAC',
        loincCode: ['5641-6'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 0,
          high: 0.02,
          unit: '%',
        },
        display: {
          type: 'Numeric',
          nullOption: false,
        },
        reflexLogic: {
          testToRun: {
            testName: 'Alcohol Confirmation Test',
            // this will need to be updated to match the current version of the AD
            testCanonicalUrl: 'https://ottehr.com/FHIR/InHouseLab/ActivityDefinition/AlcoholConfirmationTest|1.0.0',
          },
          triggerAlert: 'Alcohol ≥ 0.02% requires a confirmation test',
          condition: {
            description: 'BAC >= 0.02',
            language: 'text/fhirpath',
            expression:
              "%resource.code.coding.where(code = '82075').exists() and %resource.valueQuantity.value >= 0.02",
          },
        },
      },
    ],
  },
  'alcohol-confirmation': {
    name: 'Alcohol Confirmation Test',
    methods: {
      analyzer: { device: 'breathalyzer' },
    },
    device: 'breathalyzer',
    cptCode: [{ code: '82075', modifier: [{ code: '91', display: 'Repeat Clinical Diagnostic Laboratory Test' }] }],
    loincCode: ['5641-6'],
    repeatTest: false,
    components: [
      {
        componentName: 'BAC',
        loincCode: ['5641-6'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 0,
          high: 0.02,
          unit: '%',
        },
        display: {
          type: 'Numeric',
          nullOption: false,
        },
        reflexLogic: {
          // this will need to be updated to match the current version of the AD
          parentTestUrl: 'https://ottehr.com/FHIR/InHouseLab/ActivityDefinition/AlcoholTest|1.0.0',
        },
      },
    ],
  },
  'hcg-comma': {
    name: 'HCG, Urine-Qual',
    methods: {
      manual: { device: 'Strip/stick' },
    },
    device: 'Strip/stick',
    cptCode: [{ code: '81025' }],
    loincCode: ['2106-3'],
    repeatTest: false,
    components: [
      {
        componentName: 'HCG, Urine-Qual',
        loincCode: ['2106-3'],
        dataType: 'CodeableConcept' as const,
        valueSet: [
          // both results are normal in the context of the test
          { code: 'Detected', display: 'Detected', isAbnormal: false },
          { code: 'Not Detected', display: 'Not Detected', isAbnormal: false },
        ],
        display: {
          type: 'Radio',
          nullOption: true,
        },
      },
    ],
  },
};

// console.log('testItems in module:', testItems);
