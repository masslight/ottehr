import {
  CodeableConceptType,
  ObservationInterpretationCode,
  QuantityTestItem,
  QuantityType,
  ResultType,
  InterpretationCoding,
  TestItem,
} from './in-house.types';

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

export function getHL7Interpretation(testItem: TestItem, value: string | number): InterpretationCoding {
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

    if (value < range.low || value > range.high) {
      code = 'A';
    }
  } else if (isCodeableConceptResult(resultType) && typeof value === 'string') {
    if (resultType.abnormalValues.includes(value)) {
      code = 'A';
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
