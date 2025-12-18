import {
  ActivityDefinition,
  DiagnosticReport,
  Extension,
  Observation,
  ObservationDefinition,
  ServiceRequest,
  ValueSet,
} from 'fhir/r4b';
import { evaluate } from 'fhirpath';
import {
  CODE_SYSTEM_CPT,
  CodeableConceptComponent,
  DiagnosisDTO,
  IN_HOUSE_LAB_DISPLAY_TYPES,
  IN_HOUSE_LAB_OD_NULL_OPTION_SYSTEM,
  IN_HOUSE_OBS_DEF_ID_SYSTEM,
  IN_HOUSE_UNIT_OF_MEASURE_SYSTEM,
  LabComponentValueSetConfig,
  OBSERVATION_INTERPRETATION_SYSTEM,
  ObservationCode,
  OD_DISPLAY_CONFIG,
  OD_VALUE_VALIDATION_CONFIG,
  QuantityComponent,
  REFLEX_TEST_ALERT_URL,
  REFLEX_TEST_CONDITION_LANGUAGES,
  REFLEX_TEST_CONDITION_URL,
  REFLEX_TEST_LOGIC_URL,
  REFLEX_TEST_TO_RUN_NAME_URL,
  REFLEX_TEST_TO_RUN_URL,
  REFLEX_TEST_TRIGGERED_URL,
  REPEATABLE_TEXT_EXTENSION_CONFIG,
  StringComponent,
  TestComponentResult,
  TestItem,
  TestItemComponent,
  Validation,
} from 'utils';

export const extractAbnormalValueSetValues = (
  obsDef: ObservationDefinition,
  containedResources: (ObservationDefinition | ValueSet)[]
): LabComponentValueSetConfig[] => {
  const abnormalValueSetRef = obsDef.abnormalCodedValueSet?.reference?.substring(1);
  const abnormalValueSet = containedResources.find(
    (res) => res.resourceType === 'ValueSet' && res.id === abnormalValueSetRef
  ) as ValueSet | undefined;
  const abnormalValues = abnormalValueSet ? extractValueSetValues(abnormalValueSet) : [];
  return abnormalValues;
};

const extractValueSetValues = (valueSet: ValueSet): LabComponentValueSetConfig[] => {
  if (!valueSet.compose?.include?.[0]?.concept) {
    return [];
  }

  return valueSet.compose.include[0].concept
    .map((concept) => (concept as LabComponentValueSetConfig) || '')
    .filter(Boolean);
};

export const extractQuantityRange = (
  obsDef: ObservationDefinition
): {
  unit: string;
  normalRange: {
    low: number;
    high: number;
    unit: string;
    precision?: number;
  };
} => {
  const unit = obsDef.quantitativeDetails?.unit?.coding?.[0]?.code || '';
  const low = obsDef.qualifiedInterval?.[0]?.range?.low?.value;
  const high = obsDef.qualifiedInterval?.[0]?.range?.high?.value;
  const precision = obsDef.quantitativeDetails?.decimalPrecision;

  if (low === undefined || high === undefined) {
    throw Error('qualifiedInterval range is missing details'); // todo make this error better
  }

  return {
    unit,
    normalRange: {
      low,
      high,
      unit,
      precision,
    },
  };
};

const extractDisplayType = (obsDef: ObservationDefinition, obsName: string): IN_HOUSE_LAB_DISPLAY_TYPES => {
  const ext = obsDef.extension;
  const display = ext?.find((e) => e.url === OD_DISPLAY_CONFIG.url)?.valueString;
  if (!display) throw Error(`no display type set for this observation definition: ${obsName}`);

  if (
    display !== OD_DISPLAY_CONFIG.valueString.radio &&
    display !== OD_DISPLAY_CONFIG.valueString.select &&
    display !== OD_DISPLAY_CONFIG.valueString.numeric &&
    display !== OD_DISPLAY_CONFIG.valueString.freeText
  )
    throw Error(
      `unknown display cast to this observation definition: ${obsName} (display should be one of the follow ${Object.values(
        OD_DISPLAY_CONFIG.valueString
      )} and received: ${display})`
    );
  return display;
};

const extractNullOption = (
  obsDef: ObservationDefinition
):
  | {
      text: string;
      code: string;
    }
  | undefined => {
  const ext = obsDef.extension;
  const nullOptionCode = ext?.find((e) => e.url === IN_HOUSE_LAB_OD_NULL_OPTION_SYSTEM)?.valueCode;
  const nullOptionText = ext?.find((e) => e.url === IN_HOUSE_LAB_OD_NULL_OPTION_SYSTEM)?.valueString;
  if (nullOptionCode && nullOptionText) {
    return {
      text: nullOptionText,
      code: nullOptionCode,
    };
  }
  return;
};

const extractValidations = (obsDef: ObservationDefinition): Validation | undefined => {
  const validationExtensions = obsDef.extension?.filter((ext) => ext.url === OD_VALUE_VALIDATION_CONFIG.url);
  if (!validationExtensions || !validationExtensions.length) return undefined;

  // labs todo: in the future if we need additional validation types, we should grab them here
  const formatValidation = validationExtensions.find(
    (ext) => ext.valueCoding?.system === OD_VALUE_VALIDATION_CONFIG.formatValidation.url
  );
  if (!formatValidation || !formatValidation.valueCoding?.code) return undefined;

  const format = { value: formatValidation.valueCoding.code, display: formatValidation.valueCoding.display };

  return format ? { format } : undefined;
};

const processObservationDefinition = (
  obsDef: ObservationDefinition,
  containedResources: (ObservationDefinition | ValueSet)[],
  observation?: Observation
): TestItemComponent | undefined => {
  const componentName = obsDef.code?.text || '';
  const observationDefinitionId = obsDef.id || '';
  const dataType = obsDef.permittedDataType?.[0] as 'Quantity' | 'CodeableConcept' | 'string';
  const loincCode =
    obsDef.code?.coding?.filter((coding) => coding.system === 'http://loinc.org').map((coding) => coding.code || '') ||
    [];

  if (dataType === 'CodeableConcept') {
    const validValueSetRef = obsDef.validCodedValueSet?.reference?.substring(1); // Remove the '#'

    const validValueSet = containedResources.find(
      (res) => res.resourceType === 'ValueSet' && res.id === validValueSetRef
    ) as ValueSet | undefined;

    const valueSet = validValueSet ? extractValueSetValues(validValueSet) : [];
    console.log('valueSet check', valueSet);
    const abnormalValues = extractAbnormalValueSetValues(obsDef, containedResources);

    const refRangeValueSet = containedResources.find(
      (res) => res.resourceType === 'ValueSet' && res.id === obsDef.normalCodedValueSet?.reference?.substring(1)
    ) as ValueSet | undefined;

    const referenceRangeValues = refRangeValueSet ? extractValueSetValues(refRangeValueSet) : [];

    const unit =
      obsDef.quantitativeDetails?.unit?.coding?.find((coding) => coding.system === IN_HOUSE_UNIT_OF_MEASURE_SYSTEM)
        ?.code ?? undefined;

    const displayType = extractDisplayType(obsDef, componentName);
    if (displayType === 'Numeric' || displayType === 'Free Text')
      throw Error(
        'Observation definition is flagged as Numeric or Free Text, currently we are only configured to support Select or Radio for CodeableConcept observation definitions '
      );
    const nullOption = extractNullOption(obsDef);

    const result = getResult(observation, dataType);
    const component: CodeableConceptComponent = {
      componentName,
      observationDefinitionId,
      loincCode,
      dataType,
      valueSet,
      abnormalValues,
      referenceRangeValues,
      unit,
      displayType,
      nullOption,
      result,
    };
    return component;
  } else if (dataType === 'Quantity') {
    const quantityInfo = extractQuantityRange(obsDef);
    const displayType = extractDisplayType(obsDef, componentName);
    if (displayType !== 'Numeric') {
      throw Error('Quantity type observation definition is misconfigured, should be Numeric');
    }
    const result = getResult(observation, dataType);
    const component: QuantityComponent = {
      componentName,
      observationDefinitionId,
      loincCode,
      dataType,
      unit: quantityInfo.unit,
      normalRange: quantityInfo.normalRange,
      displayType,
      result,
    };
    return component;
  } else if (dataType === 'string') {
    const displayType = extractDisplayType(obsDef, componentName);
    if (displayType !== 'Free Text') {
      throw Error('String type observation definition is misconfigured, display type should be Free Text');
    }
    const validations = extractValidations(obsDef);
    const result = getResult(observation, dataType);
    const component: StringComponent = {
      componentName,
      loincCode,
      observationDefinitionId,
      dataType,
      displayType,
      validations,
      result,
    };
    return component;
  }

  console.log('Invalid data type');
  return;
};

export function quantityRangeFormat(quantity: QuantityComponent): string {
  return `${quantity.normalRange.low} - ${quantity.normalRange.high}`;
}

export const convertActivityDefinitionToTestItem = (
  activityDef: ActivityDefinition,
  observations?: Observation[],
  serviceRequest?: ServiceRequest,
  diagnosticReport?: DiagnosticReport
): TestItem => {
  const name = activityDef.name || '';

  const cptCode =
    activityDef.code?.coding
      ?.filter((coding) => coding.system === CODE_SYSTEM_CPT)
      .map((coding) => coding.code || '') || [];

  const repeatable = !!activityDef?.extension?.find((ext) => ext.url === REPEATABLE_TEXT_EXTENSION_CONFIG.url);

  const methods: {
    manual?: { device: string };
    analyzer?: { device: string };
    machine?: { device: string };
  } = {};

  activityDef.participant?.[0]?.role?.coding?.forEach((coding) => {
    const methodType = coding.code || '';
    const deviceName = coding.display || '';

    if (methodType) {
      methods[methodType as keyof typeof methods] = { device: deviceName };
    }
  });

  const containedResources = activityDef.contained || [];

  const obsDefRefs = activityDef.observationRequirement || [];

  if (obsDefRefs.length === 0) {
    throw Error('No observation definitions found');
  }

  const observationMap: { [obsDefId: string]: Observation } = {};
  if (observations) {
    observations.forEach((obs) => {
      const observationIsBasedOnSr = serviceRequest ? resourceIsBasedOnServiceRequest(obs, serviceRequest) : true;
      if (observationIsBasedOnSr) {
        const obsDefIdFromExt = obs.extension?.find((ext) => ext.url === IN_HOUSE_OBS_DEF_ID_SYSTEM)?.valueString;
        if (obsDefIdFromExt) observationMap[obsDefIdFromExt] = obs;
      }
    });
  }

  const groupedComponents: TestItemComponent[] = [];
  const radioComponents: CodeableConceptComponent[] = [];
  for (const ref of obsDefRefs) {
    const obsDefId = ref.reference?.substring(1);
    const obsDef = containedResources.find(
      (res) => res.resourceType === 'ObservationDefinition' && res.id === obsDefId
    ) as ObservationDefinition | undefined;

    if (obsDef && obsDef.id) {
      const resultObs = observationMap[obsDef.id];
      const componentInfo = processObservationDefinition(
        obsDef,
        containedResources as (ObservationDefinition | ValueSet)[],
        resultObs
      );
      console.log('this is the componentInfo', componentInfo);
      if (componentInfo) {
        if (
          componentInfo.displayType === 'Select' ||
          componentInfo.displayType === 'Numeric' ||
          componentInfo.displayType === 'Free Text'
        )
          groupedComponents.push(componentInfo);
        if (componentInfo.displayType === 'Radio') radioComponents.push(componentInfo);
      }
    }
  }

  if (!activityDef.url || !activityDef.version) {
    throw new Error(
      `ActivityDefinition is misconfigured and is missing either its url or version property: ${activityDef.url}, ${activityDef.version}. AD id is ${activityDef.id}`
    );
  }

  let reflexAlert: TestItem['reflexAlert'];
  // validate service request and diagnostic report are indeed related
  const srIsRelatedToDr =
    diagnosticReport && serviceRequest ? resourceIsBasedOnServiceRequest(diagnosticReport, serviceRequest) : false;
  if (srIsRelatedToDr && diagnosticReport) {
    reflexAlert = checkDiagnosticReportForReflexAlert(diagnosticReport);
  }

  const testItem: TestItem = {
    name,
    methods,
    repeatable,
    method: Object.keys(methods).join(' or '),
    device: Object.values(methods)
      .map((m) => m.device)
      .join(' or '),
    cptCode,
    components: {
      groupedComponents,
      radioComponents,
    },
    reflexAlert,
    adUrl: activityDef.url,
    adVersion: activityDef.version,
  };

  console.log('successfully converted activity ActivityDefinition to testItem format for', testItem.name);
  return testItem;
};

export const resourceIsBasedOnServiceRequest = (
  resource: Observation | DiagnosticReport,
  serviceRequest: ServiceRequest
): boolean => {
  return !!resource.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`);
};

const getResult = (
  observation: Observation | undefined,
  dataType: 'CodeableConcept' | 'Quantity' | 'string'
): TestComponentResult | undefined => {
  if (!observation) return;
  let result: TestComponentResult | undefined;
  let entry: string | undefined;
  if (dataType === 'CodeableConcept' || dataType === 'string') {
    entry = observation.valueString;
  } else {
    const entryValue = observation?.valueQuantity?.value;
    if (entryValue !== undefined) entry = entryValue.toString();
  }
  const interpretationCoding = observation.interpretation?.find(
    (i) => i?.coding?.find((c) => c.system === OBSERVATION_INTERPRETATION_SYSTEM)
  )?.coding;
  let interpretationCode: ObservationCode | undefined;
  if (interpretationCoding) {
    interpretationCode = interpretationCoding.find((c) => c.system === OBSERVATION_INTERPRETATION_SYSTEM)
      ?.code as ObservationCode;
  }
  if (entry !== undefined && interpretationCode) {
    result = {
      entry,
      interpretationCode,
    };
  }
  return result;
};

// i suspect this function will need some tweaking if we add more types of conditions/expressions
export const checkIfReflexIsTriggered = (
  activityDefinition: ActivityDefinition,
  observation: Observation | undefined
): Extension | undefined => {
  if (!observation) return;

  const reflexLogicExtensions = checkActivityDefinitionForReflexLogic(activityDefinition);
  if (!reflexLogicExtensions) return;

  const {
    reflexTestToRunCanonicalUrlExt,
    reflexTestToRunNameExt,
    reflexAlertExt,
    reflexConditionLanguage,
    reflexConditionExpression,
  } = reflexLogicExtensions;

  if (reflexConditionLanguage === REFLEX_TEST_CONDITION_LANGUAGES.fhirPath) {
    const result = evaluate(observation, reflexConditionExpression, { resource: observation });
    if (result && Array.isArray(result) && result.some((res) => res === true)) {
      const reflexTestTriggeredExt: Extension = {
        url: REFLEX_TEST_TRIGGERED_URL,
        extension: [reflexTestToRunCanonicalUrlExt, reflexTestToRunNameExt, reflexAlertExt],
      };
      return reflexTestTriggeredExt;
    } else {
      console.log('result returned:', JSON.stringify(result));
      return;
    }
  } else {
    throw new Error(
      `Reflex test logic has been added for a condition language we do not currently support. Language parsed: ${reflexConditionLanguage}. Languages supported: ${JSON.stringify(
        REFLEX_TEST_CONDITION_LANGUAGES
      )}.`
    );
  }
};

export const checkActivityDefinitionForReflexLogic = (
  activityDefinition: ActivityDefinition
):
  | {
      reflexTestToRunCanonicalUrlExt: Extension;
      reflexTestToRunNameExt: Extension;
      reflexAlertExt: Extension;
      reflexConditionLanguage: string;
      reflexConditionExpression: string;
    }
  | undefined => {
  const reflexLogic = activityDefinition.extension?.find((ext) => ext.url === REFLEX_TEST_LOGIC_URL)?.extension;
  if (!reflexLogic) return;

  const reflexCondition = reflexLogic.find((ext) => ext.url === REFLEX_TEST_CONDITION_URL)?.valueExpression;
  if (!reflexCondition) {
    throw new Error(
      `Reflex logic is misconfigured. Condition valueExpression is missing. ActivityDefinition/${activityDefinition.id}`
    );
  }

  console.log(`Evaluating reflex logic for ActivityDefinition/${activityDefinition.id}`);

  const reflexTestToRunCanonicalUrlExt = reflexLogic.find((ext) => ext.url === REFLEX_TEST_TO_RUN_URL);
  const reflexTestToRunNameExt = reflexLogic.find((ext) => ext.url === REFLEX_TEST_TO_RUN_NAME_URL);
  const reflexAlertExt = reflexLogic.find((ext) => ext.url === REFLEX_TEST_ALERT_URL);
  const reflexConditionLanguage = reflexCondition.language;
  const reflexConditionExpression = reflexCondition.expression;

  if (
    !reflexConditionLanguage ||
    !reflexConditionExpression ||
    !reflexAlertExt ||
    !reflexTestToRunNameExt ||
    !reflexTestToRunCanonicalUrlExt
  ) {
    throw new Error(
      `Reflex logic is misconfigured. One of the following is missing: reflexConditionLanguage, reflexConditionExpression, reflexAlertExt, reflexTestToRunCanonicalUrlExt, reflexTestToRunNameExt on ActivityDefinition/${activityDefinition.id}`
    );
  }

  return {
    reflexTestToRunCanonicalUrlExt,
    reflexTestToRunNameExt,
    reflexAlertExt,
    reflexConditionLanguage,
    reflexConditionExpression,
  };
};

export const checkDiagnosticReportForReflexAlert = (
  diagnosticReport: DiagnosticReport
): { testName: string; alert: string } | undefined => {
  const reflexLogic = diagnosticReport.extension?.find((ext) => ext.url === REFLEX_TEST_TRIGGERED_URL)?.extension;
  if (!reflexLogic) return;

  console.log(`Evaluating reflex logic for DiagnosticReport/${diagnosticReport.id}`);

  const reflexTestToRunName = reflexLogic.find((ext) => ext.url === REFLEX_TEST_TO_RUN_NAME_URL)?.valueString;
  const reflexAlert = reflexLogic.find((ext) => ext.url === REFLEX_TEST_ALERT_URL)?.valueString;

  if (!reflexAlert || !reflexTestToRunName) {
    throw new Error(
      `Reflex test information on diagnostic report is misconfigured. reflexAlert or reflexTestToRunName is missing on DiagnosticReport/${diagnosticReport.id}`
    );
  }

  return { testName: reflexTestToRunName, alert: reflexAlert };
};

export const getFormattedDiagnoses = (diagnoses: DiagnosisDTO[]): string => {
  return diagnoses.map((d) => `${d.code} ${d.display}`).join(', ');
};
