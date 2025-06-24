import { ActivityDefinition, Observation, ObservationDefinition, ServiceRequest, ValueSet } from 'fhir/r4b';
import {
  CODE_SYSTEM_CPT,
  CodeableConceptComponent,
  DiagnosisDTO,
  IN_HOUSE_LAB_OD_NULL_OPTION_SYSTEM,
  IN_HOUSE_OBS_DEF_ID_SYSTEM,
  IN_HOUSE_UNIT_OF_MEASURE_SYSTEM,
  LabComponentValueSetConfig,
  OBSERVATION_INTERPRETATION_SYSTEM,
  ObservationCode,
  OD_DISPLAY_CONFIG,
  QuantityComponent,
  REPEATABLE_TEXT_EXTENSION_CONFIG,
  TestComponentResult,
  TestItem,
  TestItemComponent,
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
  }

  throw Error('Invalid data type');
};

export function quantityRangeFormat(quantity: QuantityComponent): string {
  return `${quantity.normalRange.low} - ${quantity.normalRange.high}`;
}

export const convertActivityDefinitionToTestItem = (
  activityDef: ActivityDefinition,
  observations?: Observation[],
  serviceRequest?: ServiceRequest
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
      const observationIsBasedOnSr = serviceRequest ? observationIsBasedOnServiceRequest(obs, serviceRequest) : true;
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
      if (componentInfo.displayType === 'Select' || componentInfo.displayType === 'Numeric')
        groupedComponents.push(componentInfo);
      if (componentInfo.displayType === 'Radio') radioComponents.push(componentInfo);
    }
  }

  if (!activityDef.url || !activityDef.version) {
    throw new Error(
      `ActivityDefinition is misconfigured and is missing either its url or version property: ${activityDef.url}, ${activityDef.version}. AD id is ${activityDef.id}`
    );
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
    adUrl: activityDef.url,
    adVersion: activityDef.version,
  };

  console.log('successfully converted activity ActivityDefinition to testItem format for', testItem.name);
  return testItem;
};

export const observationIsBasedOnServiceRequest = (
  observation: Observation,
  serviceRequest: ServiceRequest
): boolean => {
  return !!observation.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`);
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

export const getFormattedDiagnoses = (diagnoses: DiagnosisDTO[]): string => {
  return diagnoses.map((d) => `${d.code} ${d.display}`).join(', ');
};
