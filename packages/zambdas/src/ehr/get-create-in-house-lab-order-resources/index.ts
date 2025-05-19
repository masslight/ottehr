import { APIGatewayProxyResult } from 'aws-lambda';
import {
  MixedComponent,
  Secrets,
  GetCreateInHouseLabOrderResourcesParameters,
  GetCreateInHouseLabOrderResourcesResponse,
  TestItem,
  CODE_SYSTEM_CPT,
  QuantityTestItem,
  IN_HOUSE_TAG_DEFINITION,
  TestItemsType,
  PRACTITIONER_CODINGS,
  getFullestAvailableName,
} from 'utils';
import {
  ZambdaInput,
  topLevelCatch,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { ValueSet, ActivityDefinition, ObservationDefinition, Encounter, Practitioner } from 'fhir/r4b';
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`get-create-in-house-lab-order-resources started, input: ${JSON.stringify(input)}`);

  let secrets = input.secrets;
  let validatedParameters: GetCreateInHouseLabOrderResourcesParameters & { secrets: Secrets | null; userToken: string };

  try {
    validatedParameters = validateRequestParameters(input);
  } catch (error: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Invalid request parameters. ${error.message || error}`,
      }),
    };
  }

  try {
    secrets = validatedParameters.secrets;

    console.log('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const attendingPractitionerName: string = await (async () => {
      const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);

      const [myPractitionerId, encounter] = await Promise.all([
        getMyPractitionerId(oystehrCurrentUser),
        oystehr.fhir.get<Encounter>({
          resourceType: 'Encounter',
          id: validatedParameters.encounterId,
        }),
      ]);

      const practitionerId = encounter.participant
        ?.find(
          (participant) =>
            participant.type?.find(
              (type) => type.coding?.some((c) => c.system === PRACTITIONER_CODINGS.Attender[0].system)
            )
        )
        ?.individual?.reference?.replace('Practitioner/', '');

      if (!practitionerId) {
        return '';
      }

      if (practitionerId === myPractitionerId) {
        return ''; // show name only if it's not the current user
      }

      const attendingPractitioner = await oystehr.fhir.get<Practitioner>({
        resourceType: 'Practitioner',
        id: practitionerId,
      });

      const name = getFullestAvailableName(attendingPractitioner);

      return name || '';
    })();

    const activityDefinitions = (
      await oystehr.fhir.search<ActivityDefinition>({
        resourceType: 'ActivityDefinition',
        params: [
          { name: '_tag', value: IN_HOUSE_TAG_DEFINITION.code },
          { name: 'status', value: 'active' },
        ],
      })
    ).unbundle();

    console.log(`Found ${activityDefinitions.length} ActivityDefinition resources`);

    const testItems: TestItemsType = {} as TestItemsType;

    for (const activeDefenition of activityDefinitions) {
      const testItem = convertActivityDefinitionToTestItem(activeDefenition);
      const key = testItem.name.replace(/\s+/g, '_') as keyof TestItemsType;
      testItems[key] = testItem;
    }

    const response: GetCreateInHouseLabOrderResourcesResponse = {
      labs: testItems,
      providerName: attendingPractitionerName,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Error processing in-house lab order resources:', error);
    await topLevelCatch('get-create-in-house-lab-order-resources', error, secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Error processing request: ${error.message || error}`,
      }),
    };
  }
};

const extractValueSetValues = (valueSet: ValueSet): string[] => {
  if (!valueSet.compose?.include?.[0]?.concept) {
    return [];
  }

  return valueSet.compose.include[0].concept.map((concept) => concept.code || '').filter(Boolean);
};

const extractQuantityRange = (
  obsDef: ObservationDefinition
): {
  unit: string;
  normalRange: {
    low: number;
    high: number;
    unit: string;
    precision?: number;
  };
} | null => {
  const unit = obsDef.quantitativeDetails?.unit?.coding?.[0]?.code || '';
  const low = obsDef.qualifiedInterval?.[0]?.range?.low?.value;
  const high = obsDef.qualifiedInterval?.[0]?.range?.high?.value;
  const precision = obsDef.quantitativeDetails?.decimalPrecision;

  if (low === undefined || high === undefined) {
    return null;
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

const processObservationDefinition = (
  obsDef: ObservationDefinition,
  containedResources: (ObservationDefinition | ValueSet)[]
): {
  name: string;
  dataType: 'Quantity' | 'CodeableConcept';
  valueSet?: string[];
  abnormalValues?: string[];
  unit?: string;
  normalRange?: {
    low: number;
    high: number;
    unit: string;
    precision?: number;
  };
  loincCode: string[];
} => {
  const name = obsDef.code?.text || '';
  const dataType = obsDef.permittedDataType?.[0] as 'Quantity' | 'CodeableConcept';
  const loincCode =
    obsDef.code?.coding?.filter((coding) => coding.system === 'http://loinc.org').map((coding) => coding.code || '') ||
    [];

  if (dataType === 'CodeableConcept') {
    const normalValueSetRef = obsDef.validCodedValueSet?.reference?.substring(1); // Remove the '#'
    const abnormalValueSetRef = obsDef.abnormalCodedValueSet?.reference?.substring(1);

    const normalValueSet = containedResources.find(
      (res) => res.resourceType === 'ValueSet' && res.id === normalValueSetRef
    ) as ValueSet | undefined;

    const abnormalValueSet = containedResources.find(
      (res) => res.resourceType === 'ValueSet' && res.id === abnormalValueSetRef
    ) as ValueSet | undefined;

    const valueSet = normalValueSet ? extractValueSetValues(normalValueSet) : [];
    const abnormalValues = abnormalValueSet ? extractValueSetValues(abnormalValueSet) : [];

    return {
      name,
      dataType,
      loincCode,
      valueSet,
      abnormalValues,
    };
  } else if (dataType === 'Quantity') {
    const quantityInfo = extractQuantityRange(obsDef);

    return {
      name,
      dataType,
      loincCode,
      ...(quantityInfo || {}),
    };
  }

  throw Error('Invalid data type');
};

const convertActivityDefinitionToTestItem = (activityDef: ActivityDefinition): TestItem => {
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

  // Check if this is a test with components (like urinalysis)
  if (obsDefRefs.length > 1) {
    const components: Record<string, MixedComponent> = {};

    for (const ref of obsDefRefs) {
      const obsDefId = ref.reference?.substring(1);
      const obsDef = containedResources.find(
        (res) => res.resourceType === 'ObservationDefinition' && res.id === obsDefId
      ) as ObservationDefinition | undefined;

      if (obsDef) {
        const componentInfo = processObservationDefinition(
          obsDef,
          containedResources as (ObservationDefinition | ValueSet)[]
        );
        const componentName = componentInfo.name;

        components[componentName] = {
          loincCode: componentInfo.loincCode,
          dataType: componentInfo.dataType,
          valueSet: componentInfo.valueSet,
          abnormalValues: componentInfo.abnormalValues,
          normalRange: componentInfo.normalRange,
        } as MixedComponent;
      }
    }

    return {
      name,
      methods,
      method: Object.keys(methods).join(' or '),
      device: Object.values(methods)
        .map((m) => m.device)
        .join(' or '),
      cptCode,
      loincCode: [], // todo: is it correct value here is empty for component test?
      dataType: 'CodeableConcept',
      valueSet: [],
      abnormalValues: [],
      components,
    } as TestItem;
  } else {
    // This is a simple test
    const obsDefId = obsDefRefs[0].reference?.substring(1);
    const obsDef = containedResources.find(
      (res) => res.resourceType === 'ObservationDefinition' && res.id === obsDefId
    ) as ObservationDefinition | undefined;

    if (!obsDef) {
      throw Error('No observation definition found');
    }

    const testInfo = processObservationDefinition(obsDef, containedResources as (ObservationDefinition | ValueSet)[]);

    if (testInfo.dataType === 'Quantity') {
      return {
        name,
        methods,
        method: Object.keys(methods).join(' or '),
        device: Object.values(methods)
          .map((m) => m.device)
          .join(' or '),
        cptCode,
        loincCode: testInfo.loincCode,
        dataType: 'Quantity',
        unit: testInfo.unit || '',
        normalRange: testInfo.normalRange!,
      } as QuantityTestItem;
    } else {
      return {
        name,
        methods,
        method: Object.keys(methods).join(' or '),
        device: Object.values(methods)
          .map((m) => m.device)
          .join(' or '),
        cptCode,
        loincCode: testInfo.loincCode,
        dataType: 'CodeableConcept',
        valueSet: testInfo.valueSet || [],
        abnormalValues: testInfo.abnormalValues || [],
      } as TestItem;
    }
  }
};
