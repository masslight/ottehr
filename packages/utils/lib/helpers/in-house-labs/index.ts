import { ValueSet, ObservationDefinition, ActivityDefinition, Observation } from 'fhir/r4b';
import {
  TestItem,
  TestItemComponent,
  CodeableConceptComponent,
  QuantityComponent,
  CODE_SYSTEM_CPT,
  OD_DISPLAY_CONFIG,
  IN_HOUSE_LAB_OD_NULL_OPTION_SYSTEM,
  IN_HOUSE_OBS_DEF_ID_SYSTEM,
  OBSERVATION_INTERPRETATION_SYSTEM,
  ObservationCode,
  TestComponentResult,
} from 'utils';

// TODO TEMP PUTTING THIS HERE WHILE I TEST THE FRONT END
// when done with front end testing this can be moved to a shared file in the zambdas package (no need for the front end to have it)

export const extractAbnormalValueSetValues = (
  obsDef: ObservationDefinition,
  containedResources: (ObservationDefinition | ValueSet)[]
): string[] => {
  const abnormalValueSetRef = obsDef.abnormalCodedValueSet?.reference?.substring(1);
  const abnormalValueSet = containedResources.find(
    (res) => res.resourceType === 'ValueSet' && res.id === abnormalValueSetRef
  ) as ValueSet | undefined;
  const abnormalValues = abnormalValueSet ? extractValueSetValues(abnormalValueSet) : [];
  return abnormalValues;
};

const extractValueSetValues = (valueSet: ValueSet): string[] => {
  if (!valueSet.compose?.include?.[0]?.concept) {
    return [];
  }

  return valueSet.compose.include[0].concept.map((concept) => concept.code || '').filter(Boolean);
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

const extractDisplayType = (obsDef: ObservationDefinition, obsName: string): 'Radio' | 'Select' | 'Numeric' => {
  const ext = obsDef.extension;
  const display = ext?.find((e) => e.url === OD_DISPLAY_CONFIG.url)?.valueString;
  if (!display) throw Error(`no display type set for this observation definition: ${obsName}`);

  if (
    display !== OD_DISPLAY_CONFIG.valueString.radio &&
    display !== OD_DISPLAY_CONFIG.valueString.select &&
    display !== OD_DISPLAY_CONFIG.valueString.numeric
  )
    throw Error(
      `unknown display cast to this observation definition: ${obsName} (display should be one of the follow ${Object.values(
        OD_DISPLAY_CONFIG.valueString
      )} and recieved: ${display})`
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

const processObservationDefinition = (
  obsDef: ObservationDefinition,
  containedResources: (ObservationDefinition | ValueSet)[],
  observation?: Observation
): TestItemComponent => {
  const componentName = obsDef.code?.text || '';
  const observationDefinitionId = obsDef.id || '';
  const dataType = obsDef.permittedDataType?.[0] as 'Quantity' | 'CodeableConcept';
  const loincCode =
    obsDef.code?.coding?.filter((coding) => coding.system === 'http://loinc.org').map((coding) => coding.code || '') ||
    [];

  if (dataType === 'CodeableConcept') {
    const normalValueSetRef = obsDef.validCodedValueSet?.reference?.substring(1); // Remove the '#'

    const normalValueSet = containedResources.find(
      (res) => res.resourceType === 'ValueSet' && res.id === normalValueSetRef
    ) as ValueSet | undefined;

    const valueSet = normalValueSet ? extractValueSetValues(normalValueSet) : [];
    const abnormalValues = extractAbnormalValueSetValues(obsDef, containedResources);

    const displayType = extractDisplayType(obsDef, componentName);
    if (displayType === 'Numeric')
      throw Error(
        'Observation definition is flagged as Numeric, currently we are only configured to support Select or Radio for CodeableConcept observation definitions '
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
  }

  throw Error('Invalid data type');
};

export const convertActivityDefinitionToTestItem = (
  activityDef: ActivityDefinition,
  observations?: Observation[]
): TestItem => {
  const name = activityDef.name || '';

  const cptCode =
    activityDef.code?.coding
      ?.filter((coding) => coding.system === CODE_SYSTEM_CPT)
      .map((coding) => coding.code || '') || [];

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
      const obsDefIdFromExt = obs.extension?.find((ext) => ext.url === IN_HOUSE_OBS_DEF_ID_SYSTEM)?.valueString;
      if (obsDefIdFromExt) observationMap[obsDefIdFromExt] = obs;
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
      if (componentInfo.displayType === 'Select' || componentInfo.displayType === 'Numeric')
        groupedComponents.push(componentInfo);
      if (componentInfo.displayType === 'Radio') radioComponents.push(componentInfo);
    }
  }

  const testItem: TestItem = {
    name,
    methods,
    method: Object.keys(methods).join(' or '),
    device: Object.values(methods)
      .map((m) => m.device)
      .join(' or '),
    cptCode,
    components: {
      groupedComponents,
      radioComponents,
    },
  };

  return testItem;
};

const getResult = (
  observation: Observation | undefined,
  dataType: 'CodeableConcept' | 'Quantity'
): TestComponentResult | undefined => {
  if (!observation) return;
  let result: TestComponentResult | undefined;
  let entry: string | undefined;
  if (dataType === 'CodeableConcept') {
    entry = observation.valueString;
  } else {
    const entryValue = observation?.valueQuantity?.value;
    if (entryValue) entry = entryValue.toString();
  }
  const interpretationCoding = observation.interpretation?.find(
    (i) => i?.coding?.find((c) => c.system === OBSERVATION_INTERPRETATION_SYSTEM)
  )?.coding;
  let interpretationCode: ObservationCode | undefined;
  if (interpretationCoding) {
    interpretationCode = interpretationCoding.find((c) => c.system === OBSERVATION_INTERPRETATION_SYSTEM)
      ?.code as ObservationCode;
  }
  if (entry && interpretationCode) {
    result = {
      entry,
      interpretationCode,
    };
  }
  return result;
};
