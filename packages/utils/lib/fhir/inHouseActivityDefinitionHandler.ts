// base types for HL7 interpretation
type ObservationInterpretationCode = 'N' | 'A' | 'H' | 'L';

interface InterpretationCoding {
  system: string;
  code: ObservationInterpretationCode;
  display: string;
}

interface QuantityRange {
  low: number;
  high: number;
  unit: string;
  precision?: number;
}

interface CodeableConceptType {
  dataType: 'CodeableConcept';
  valueSet: string[];
  abnormalValues: string[];
}

interface QuantityType {
  dataType: 'Quantity';
  unit: string;
  normalRange: QuantityRange;
}

type ResultType = CodeableConceptType | QuantityType;

export interface MixedComponent {
  loincCode: string[];
  dataType: 'CodeableConcept' | 'Quantity'; // Using literal types instead of ResultType['dataType']
  valueSet?: string[];
  abnormalValues?: string[];
  normalRange?: QuantityRange;
  quantitativeReference?: Record<string, string>;
}

// base fields, common for all test types
interface BaseTestItem {
  name: string;
  methods: TestItemMethods;
  method: string;
  device: string;
  cptCode: string[];
  loincCode: string[];
  // repeatTest: boolean;
  note?: string;
  components?: Record<string, MixedComponent>;
}

interface CodeableConceptTestItem extends BaseTestItem {
  dataType: 'CodeableConcept';
  valueSet: string[];
  abnormalValues: string[];
}

export interface QuantityTestItem extends BaseTestItem {
  dataType: 'Quantity';
  unit: string;
  normalRange: QuantityRange;
}

interface TestItemMethods {
  manual?: { device: string };
  analyzer?: { device: string };
  machine?: { device: string };
}

export type TestItem = CodeableConceptTestItem | QuantityTestItem;

export type TestItemsType = Record<string, TestItem>;

const testItemsData: TestItemsType = {
  'Rapid Strep A': {
    name: 'Rapid Strep A',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
    },
    method: 'Manual',
    device: 'Strip Test (reagent strip)',
    cptCode: ['87880'],
    loincCode: ['78012-2'],
    // repeatTest: true,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Rapid Influenza A': {
    name: 'Rapid Influenza A',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87804'],
    loincCode: ['80382-5'],
    // repeatTest: false,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Rapid Influenza B': {
    name: 'Rapid Influenza B',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87804'],
    loincCode: ['80381-7'],
    // repeatTest: false,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Rapid RSV': {
    name: 'Rapid RSV',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87807'],
    loincCode: ['72885-7'],
    // repeatTest: false,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Rapid COVID-19 Antigen': {
    name: 'Rapid COVID-19 Antigen',
    methods: {
      manual: { device: 'Strip Test (reagent strip)' },
      analyzer: { device: 'Sofia' },
    },
    method: 'Manual or Analyzer',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    cptCode: ['87426'],
    loincCode: ['94558-4'],
    // repeatTest: false,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Flu-Vid': {
    name: 'Flu-Vid',
    methods: {
      analyzer: { device: 'Sofia' },
    },
    method: 'Analyzer',
    device: 'Sofia',
    cptCode: ['87428'],
    loincCode: ['80382-5', '94558-4'],
    // repeatTest: false,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Stool Guaiac': {
    name: 'Stool Guaiac',
    methods: {
      manual: { device: 'None' },
    },
    method: 'Manual',
    device: '',
    cptCode: ['82270'],
    loincCode: ['50196-5'],
    // repeatTest: true,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Monospot test': {
    name: 'Monospot test',
    methods: {
      manual: { device: 'Test well / tube' },
    },
    method: 'Manual',
    device: 'Test well / tube',
    cptCode: ['86308'],
    loincCode: ['31418-7'],
    // repeatTest: false,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Glucose Finger/Heel Stick': {
    name: 'Glucose Finger/Heel Stick',
    methods: {
      manual: { device: 'Stick & glucometer' },
    },
    method: 'Manual with stick & glucometer',
    device: 'Glucometer brand unknown',
    cptCode: ['82962'],
    loincCode: ['32016-8'],
    // repeatTest: true,
    dataType: 'Quantity' as const,
    unit: 'mg/dL',
    normalRange: {
      low: 70,
      high: 140,
      unit: 'mg/dL',
    },
  },
  'Urinalysis (UA)': {
    name: 'Urinalysis (UA)',
    methods: {
      analyzer: { device: 'Clinitek / Multitsix' },
    },
    method: 'Clinitek/ Multitsix',
    device: 'Clinitek',
    cptCode: ['81003'],
    loincCode: ['24356-8'],
    // repeatTest: true,
    dataType: 'CodeableConcept' as const,
    valueSet: [], // empty value set, because the test itself has no values, only components
    abnormalValues: [],
    components: {
      Glucose: {
        loincCode: ['2350-7'],
        dataType: 'CodeableConcept' as const,
        valueSet: ['Negative', 'Trace', '1+', '2+', '3+', '4+'],
        abnormalValues: ['Trace', '1+', '2+', '3+', '4+'],
        quantitativeReference: {
          Trace: '<100 mg/dL',
          '1+': '100 mg/dL',
          '2+': '250 mg/dL',
          '3+': '500 mg/dL',
          '4+': '≥1000 mg/dL',
        },
      },
      Bilirubin: {
        loincCode: ['1977-8'],
        dataType: 'CodeableConcept' as const,
        valueSet: ['Negative', '1+', '2+', '3+'],
        abnormalValues: ['1+', '2+', '3+'],
        quantitativeReference: {
          '1+': 'small',
          '2+': 'moderate',
          '3+': 'large',
        },
      },
      Ketone: {
        loincCode: ['49779-2'],
        dataType: 'CodeableConcept' as const,
        valueSet: ['Negative', 'Trace', 'Small', 'Moderate', 'Large'],
        abnormalValues: ['Trace', 'Small', 'Moderate', 'Large'],
        quantitativeReference: {
          Trace: '5 mg/dL',
          Small: '15 mg/dL',
          Moderate: '40 mg/dL',
          Large: '80-160 mg/dL',
        },
      },
      'Specific gravity': {
        loincCode: ['2965-2'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 1.005,
          high: 1.03,
          unit: '', // specific gravity has no unit
          precision: 3,
        },
      },
      Blood: {
        loincCode: ['105906-2'],
        dataType: 'CodeableConcept' as const,
        valueSet: ['Negative', 'Trace', 'Small', 'Moderate', 'Large'],
        abnormalValues: ['Trace', 'Small', 'Moderate', 'Large'],
      },
      pH: {
        loincCode: ['2756-5'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 5.0,
          high: 8.0,
          unit: '', // ph has no unit
          precision: 1,
        },
      },
      Protein: {
        loincCode: ['2888-6'],
        dataType: 'CodeableConcept' as const,
        valueSet: ['Negative', 'Trace', '1+', '2+', '3+', '4+'],
        abnormalValues: ['Trace', '1+', '2+', '3+', '4+'],
        quantitativeReference: {
          Trace: '10 mg/dL',
          '1+': '30 mg/dL',
          '2+': '100 mg/dL',
          '3+': '300 mg/dL',
          '4+': '≥2000 mg/dL',
        },
      },
      Urobilinogen: {
        loincCode: ['32727-0'],
        dataType: 'Quantity' as const,
        normalRange: {
          low: 0.2,
          high: 1.0,
          unit: 'EU/dL',
          precision: 1,
        },
      },
      Nitrite: {
        loincCode: ['32710-6'],
        dataType: 'CodeableConcept' as const,
        valueSet: ['Positive', 'Negative'],
        abnormalValues: ['Positive'],
      },
      Leukocytes: {
        loincCode: ['105105-1'],
        dataType: 'CodeableConcept' as const,
        valueSet: ['Negative', 'Trace', 'Small', 'Moderate', 'Large'],
        abnormalValues: ['Trace', 'Small', 'Moderate', 'Large'],
      },
    },
  },
  'Urine Pregnancy Test (HCG)': {
    name: 'Urine Pregnancy Test (HCG)',
    methods: {
      manual: { device: 'Strip/stick' },
    },
    method: 'Manual/Strip',
    device: 'Strip/stick',
    cptCode: ['81025'],
    loincCode: ['2106-3'],
    // repeatTest: false,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: [], // empty array, because both results are normal in the context of the test
  },
  Strep: {
    name: 'Strep',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbot ID Now',
    device: 'Abbot ID Now',
    cptCode: ['87651'],
    loincCode: ['104724-0'],
    // repeatTest: true,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Flu A': {
    name: 'Flu A',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbot ID Now',
    device: 'Abbot ID Now',
    cptCode: ['87501'],
    loincCode: ['104730-7'],
    // repeatTest: true,
    note: 'Same CPT as Flu B, same test sample/test as B, but separate result',
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Flu B': {
    name: 'Flu B',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbot ID Now',
    device: 'Abbot ID Now',
    cptCode: ['87501'],
    loincCode: ['106618-2'],
    // repeatTest: true,
    note: 'Same CPT as Flu A, same test sample/test as A, but separate result',
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  RSV: {
    name: 'RSV',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbot ID Now',
    device: 'Abbot ID Now',
    cptCode: ['87634'],
    loincCode: ['33045-6', '31949-1'],
    // repeatTest: true,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'COVID-19 Antigen': {
    name: 'COVID-19 Antigen',
    methods: {
      analyzer: { device: 'Abbott ID NOW' },
    },
    method: 'Abbot ID Now',
    device: 'Abbot ID Now',
    cptCode: ['87635'],
    loincCode: ['96119-3'],
    // repeatTest: true,
    dataType: 'CodeableConcept' as const,
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
};

export const testItems: TestItemsType = testItemsData;

function isCodeableConceptResult(result: ResultType): result is CodeableConceptType {
  return result.dataType === 'CodeableConcept';
}

function isQuantityResult(result: ResultType): result is QuantityType {
  return result.dataType === 'Quantity';
}

// function isCodeableConceptTest(testItem: TestItem): testItem is CodeableConceptTestItem {
//   return testItem.dataType === 'CodeableConcept';
// }

function isQuantityTest(testItem: TestItem): testItem is QuantityTestItem {
  return testItem.dataType === 'Quantity';
}

export function getHL7Interpretation(testType: string, value: string | number): InterpretationCoding {
  const testItem = testItems[testType];
  let code: ObservationInterpretationCode = 'N';

  const resultType = isQuantityTest(testItem)
    ? {
        dataType: 'Quantity' as const,
        unit: testItem.unit,
        normalRange: testItem.normalRange,
      }
    : {
        dataType: 'CodeableConcept' as const,
        valueSet: testItem.valueSet,
        abnormalValues: testItem.abnormalValues,
      };

  if (isQuantityResult(resultType) && typeof value === 'number') {
    const range = resultType.normalRange;
    if (value < range.low) {
      code = 'L'; // low value
    } else if (value > range.high) {
      code = 'H'; // high value
    }

    // if the value is outside the range, it is also considered abnormal
    if (code === 'L' || code === 'H') {
      code = 'A';
    }
  } else if (isCodeableConceptResult(resultType) && typeof value === 'string') {
    // check if the value is abnormal for this test
    if (resultType.abnormalValues.includes(value)) {
      code = 'A'; // abnormal value
    }
  }

  // return the HL7 interpretation code
  return {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
    code: code,
    display: getDisplayForCode(code),
  };
}

function getDisplayForCode(code: ObservationInterpretationCode): string {
  const displayMap: Record<ObservationInterpretationCode, string> = {
    N: 'Normal',
    A: 'Abnormal',
    H: 'High',
    L: 'Low',
  };
  return displayMap[code];
}
