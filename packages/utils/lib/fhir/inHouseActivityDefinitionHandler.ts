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

interface UrinalysisComponent {
  results: string;
  abnormal: string;
  dataType: ResultType['dataType'];
  valueSet?: string[];
  abnormalValues?: string[];
  normalRange?: QuantityRange;
  quantitativeReference?: Record<string, string>;
}

// base fields, common for all test types
interface BaseTestItem {
  name: string;
  method: string;
  results: string;
  device: string;
  abnormal: string;
  cptCode: string[];
  repeatTest: boolean;
  note?: string;
  components?: Record<string, UrinalysisComponent>;
}

interface CodeableConceptTestItem extends BaseTestItem, CodeableConceptType {}

interface QuantityTestItem extends BaseTestItem, QuantityType {}

export type TestItem = CodeableConceptTestItem | QuantityTestItem;

export type TestItemsType = Record<string, TestItem>;

export const testItems: TestItemsType = {
  'Rapid Strep A': {
    name: 'Rapid Strep A',
    method: 'Manual',
    results: 'Positive / Negative',
    device: 'Strip Test (reagent strip)',
    abnormal: 'Positive',
    cptCode: ['87880'],
    repeatTest: true,
    dataType: 'CodeableConcept',
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Rapid Influenza A': {
    name: 'Rapid Influenza A',
    method: 'Manual or Analyzer',
    results: 'Positive / Negative',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    abnormal: 'Positive',
    cptCode: ['87804'],
    repeatTest: false,
    dataType: 'CodeableConcept',
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Rapid Influenza B': {
    name: 'Rapid Influenza B',
    method: 'Manual or Analyzer',
    results: 'Positive / Negative',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    abnormal: 'Positive',
    cptCode: ['87804'],
    repeatTest: false,
    dataType: 'CodeableConcept',
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Rapid RSV': {
    name: 'Rapid RSV',
    method: 'Manual or Analyzer',
    results: 'Positive / Negative',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    abnormal: 'Positive',
    cptCode: ['87807'],
    repeatTest: false,
    dataType: 'CodeableConcept',
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Rapid COVID-19 Antigen': {
    name: 'Rapid COVID-19 Antigen',
    method: 'Manual or Analyzer',
    results: 'Positive / Negative',
    device: 'Strip Test (reagent strip) or Sofia (analyzer)',
    abnormal: 'Positive',
    cptCode: ['87426'],
    repeatTest: false,
    dataType: 'CodeableConcept',
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Flu-Vid': {
    name: 'Flu-Vid',
    method: 'Analyzer',
    results: 'Positive / Negative',
    device: 'Sofia',
    abnormal: 'Positive',
    cptCode: ['87428'],
    repeatTest: false,
    dataType: 'CodeableConcept',
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Stool Guaiac': {
    name: 'Stool Guaiac',
    method: 'Manual',
    results: 'Positive / Negative',
    device: '',
    abnormal: 'Positive',
    cptCode: ['82270'],
    repeatTest: true,
    dataType: 'CodeableConcept',
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Monospot test': {
    name: 'Monospot test',
    method: 'Manual',
    results: 'Positive / Negative',
    device: 'Test well / tube',
    abnormal: 'Positive',
    cptCode: ['86308'],
    repeatTest: false,
    dataType: 'CodeableConcept',
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Glucose Finger/Heel Stick': {
    name: 'Glucose Finger/Heel Stick',
    method: 'Manual with stick & glucometer',
    results: 'mg/dL - normal range 70-120 mg/dL (adult)',
    device: 'Glucometer brand unknown',
    abnormal: 'Values below 70 mg/dL or above 140 mg/dL',
    cptCode: ['82962'],
    repeatTest: true,
    dataType: 'Quantity',
    unit: 'mg/dL',
    normalRange: {
      low: 70,
      high: 140,
      unit: 'mg/dL',
    },
  },
  'Urinalysis (UA)': {
    name: 'Urinalysis (UA)',
    method: 'Clinitek/ Multitsix',
    device: 'Clinitek',
    cptCode: ['81003'],
    repeatTest: true,
    results: '',
    abnormal: '',
    dataType: 'CodeableConcept',
    valueSet: [], // empty value set, because the test itself has no values, only components
    abnormalValues: [],
    components: {
      Glucose: {
        results: 'Negative, Trace, 1+ (100 mg/dL), 2+ (250 mg/dL), 3+ (500 mg/dL), or 4+ (≥1000 mg/dL)',
        abnormal: 'Any results beside negative is abnormal (so trace etc)',
        dataType: 'CodeableConcept',
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
        results: 'Negative, 1+ (small), 2+ (moderate), or 3+ (large)',
        abnormal: 'Any results beside negative is abnormal (so 1+ (small) etc)',
        dataType: 'CodeableConcept',
        valueSet: ['Negative', '1+', '2+', '3+'],
        abnormalValues: ['1+', '2+', '3+'],
        quantitativeReference: {
          '1+': 'small',
          '2+': 'moderate',
          '3+': 'large',
        },
      },
      Ketone: {
        results: 'Negative, Trace (5 mg/dL), Small (15 mg/dL), Moderate (40 mg/dL), or Large (80-160 mg/dL)',
        abnormal: 'Any results beside negative is abnormal',
        dataType: 'CodeableConcept',
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
        results: 'numerical value, typically between 1.000-1.030',
        abnormal: 'Abnormally low: <1.005, Abnormally high: >1.030',
        dataType: 'Quantity',
        normalRange: {
          low: 1.005,
          high: 1.03,
          unit: '', // specific gravity has no unit
        },
      },
      Blood: {
        results: 'Negative, Trace, Small (+), Moderate (++), or Large (+++)',
        abnormal: 'Any results beside negative is abnormal',
        dataType: 'CodeableConcept',
        valueSet: ['Negative', 'Trace', 'Small', 'Moderate', 'Large'],
        abnormalValues: ['Trace', 'Small', 'Moderate', 'Large'],
      },
      pH: {
        results: 'numerical value, usually between 5.0-8.5',
        abnormal: 'Abnormally acidic: <5.0 ; Abnormally alkaline: >8.0',
        dataType: 'Quantity',
        normalRange: {
          low: 5.0,
          high: 8.0,
          unit: '', // ph has no unit
        },
      },
      Protein: {
        results: 'Negative, Trace (10 mg/dL), 1+ (30 mg/dL), 2+ (100 mg/dL), 3+ (300 mg/dL), or 4+ (≥2000 mg/dL)',
        abnormal: 'Any results beside negative is abnormal',
        dataType: 'CodeableConcept',
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
        results: 'Normal (0.2-1.0 EU/dL) / also reported 2 (2 mg/dL), 4 (4 mg/dL), or 8 (8 mg/dL)',
        abnormal: 'Any results beside normal is abnormal (Below normal: <0.2 mg/dL or Above normal: >1.0 mg/dL)',
        dataType: 'Quantity',
        normalRange: {
          low: 0.2,
          high: 1.0,
          unit: 'EU/dL',
        },
      },
      Nitrite: {
        results: 'Positive/Negative',
        abnormal: 'Positive',
        dataType: 'CodeableConcept',
        valueSet: ['Positive', 'Negative'],
        abnormalValues: ['Positive'],
      },
      Leukocytes: {
        results: 'Negative, Trace, Small, Moderate, or Large',
        abnormal: 'Any results beside negative is abnormal',
        dataType: 'CodeableConcept',
        valueSet: ['Negative', 'Trace', 'Small', 'Moderate', 'Large'],
        abnormalValues: ['Trace', 'Small', 'Moderate', 'Large'],
      },
    },
  },
  'Urine Pregnancy Test (HCG)': {
    name: 'Urine Pregnancy Test (HCG)',
    method: 'Manual/Strip',
    results: 'Positive/negative',
    device: 'Strip/stick',
    abnormal: 'No abnormal - either pregnant or not',
    cptCode: ['81025'],
    repeatTest: false,
    dataType: 'CodeableConcept',
    valueSet: ['Positive', 'Negative'],
    abnormalValues: [], // empty array, because both results are normal in the context of the test
  },
  Strep: {
    name: 'Strep',
    method: 'Abbot ID Now',
    results: 'positive / negative',
    device: 'Abbot ID Now',
    abnormal: 'Positive',
    cptCode: ['87651'],
    repeatTest: true,
    dataType: 'CodeableConcept',
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Flu A': {
    name: 'Flu A',
    method: 'Abbot ID Now',
    results: 'positive / negative',
    device: 'Abbot ID Now',
    abnormal: 'Positive',
    cptCode: ['87501'],
    repeatTest: true,
    note: 'Same CPT as Flu B, same test sample/test as B, but separate result',
    dataType: 'CodeableConcept',
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'Flu B': {
    name: 'Flu B',
    method: 'Abbot ID Now',
    results: 'positive / negative',
    device: 'Abbot ID Now',
    abnormal: 'Positive',
    cptCode: ['87501'],
    repeatTest: true,
    note: 'Same CPT as Flu A, same test sample/test as A, but separate result',
    dataType: 'CodeableConcept',
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  RSV: {
    name: 'RSV',
    method: 'Abbot ID Now',
    results: 'positive / negative',
    device: 'Abbot ID Now',
    abnormal: 'Positive',
    cptCode: ['87634'],
    repeatTest: true,
    dataType: 'CodeableConcept',
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
  'COVID-19 Antigen': {
    name: 'COVID-19 Antigen',
    method: 'Abbot ID Now',
    results: 'positive / negative',
    device: 'Abbot ID Now',
    abnormal: 'Positive',
    cptCode: ['87635'],
    repeatTest: true,
    dataType: 'CodeableConcept',
    valueSet: ['Positive', 'Negative'],
    abnormalValues: ['Positive'],
  },
} as const;

function isCodeableConceptResult(result: ResultType): result is CodeableConceptType {
  return result.dataType === 'CodeableConcept';
}

function isQuantityResult(result: ResultType): result is QuantityType {
  return result.dataType === 'Quantity';
}

function isCodeableConceptTest(testItem: TestItem): testItem is CodeableConceptTestItem {
  return testItem.dataType === 'CodeableConcept';
}

function isQuantityTest(testItem: TestItem): testItem is QuantityTestItem {
  return testItem.dataType === 'Quantity';
}

export function getHL7Interpretation(testType: string, value: string | number): InterpretationCoding {
  const testItem = testItems[testType];
  let code: ObservationInterpretationCode = 'N'; // По умолчанию нормальный

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
