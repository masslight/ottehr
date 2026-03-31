import Oystehr from '@oystehr/sdk';
import {
  ActivityDefinition,
  CodeableConcept,
  Coding,
  DiagnosticReport,
  Extension,
  FhirResource,
  Observation,
  ObservationDefinition,
  ObservationDefinitionQualifiedInterval,
  ObservationDefinitionQuantitativeDetails,
  Provenance,
  Reference,
  RelatedArtifact,
  ServiceRequest,
  Specimen,
  Task,
  ValueSet,
} from 'fhir/r4b';
import {
  AdminInHouseLabItemDefinition,
  AdminLabComponentValueSetConfig,
  // BaseComponent,
  CODE_SYSTEM_CPT,
  CodeableConceptComponent,
  CptCodeInHouseLabDefinition,
  DEFAULT_OBSERVATION_DEFINITION_CODING,
  IN_HOUSE_DEVICE_PARTICIPANT_CODING,
  IN_HOUSE_LAB_ACTIVITY_DEFINITION_DEVICE_PARTICIPANT_TYPE,
  IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG,
  IN_HOUSE_LAB_TASK,
  IN_HOUSE_PARTICIPANT_ROLE_SYSTEM,
  IN_HOUSE_RESULTS_VALUESET_SYSTEM,
  IN_HOUSE_TAG_DEFINITION,
  IN_HOUSE_TEST_CODE_SYSTEM,
  IN_HOUSE_UNIT_OF_MEASURE_SYSTEM,
  InHouseOrderDetailPageItemDTO,
  OD_DISPLAY_CONFIG,
  OD_VALUE_VALIDATION_CONFIG,
  PROVENANCE_ACTIVITY_CODES,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  QuantityComponent,
  REFLEX_ARTIFACT_DISPLAY,
  REFLEX_TEST_ALERT_URL,
  REFLEX_TEST_CONDITION_URL,
  REFLEX_TEST_LOGIC_URL,
  REFLEX_TEST_TO_RUN_NAME_URL,
  REFLEX_TEST_TO_RUN_URL,
  ReflexLogic,
  REPEATABLE_TEXT_EXTENSION_CONFIG,
  SPECIMEN_COLLECTION_CUSTOM_SOURCE_SYSTEM,
  SPECIMEN_COLLECTION_SOURCE_SYSTEM,
  // StringComponent,
  // TEST_ITEM_METHOD_KEYS,
  TestItemComponent,
  // TestItemMethods,
  TestStatus,
} from 'utils';
import { makeCptModifierExtension } from '../../../shared';

export function determineOrderStatus(serviceRequest: ServiceRequest, tasks: Task[]): TestStatus {
  if (!serviceRequest) return 'ORDERED';

  const collectSampleTask = tasks.find(
    (task) =>
      taskIsBasedOnServiceRequest(task, serviceRequest) &&
      task.code?.coding?.some(
        (coding: Coding) =>
          coding.system === IN_HOUSE_LAB_TASK.system && coding.code === IN_HOUSE_LAB_TASK.code.collectSampleTask
      )
  );
  console.log('collectSampleTask', collectSampleTask?.id, collectSampleTask?.status);

  const interpretResultsTask = tasks.find(
    (task) =>
      taskIsBasedOnServiceRequest(task, serviceRequest) &&
      task.code?.coding?.some(
        (coding: Coding) =>
          coding.system === IN_HOUSE_LAB_TASK.system && coding.code === IN_HOUSE_LAB_TASK.code.inputResultsTask // todo: is it valid?
      )
  );
  console.log('interpretResultsTask', interpretResultsTask?.id, interpretResultsTask?.status);

  // Status Derivation:
  // Ordered: SR.status = draft & Task(CST).status = ready
  if (serviceRequest.status === 'draft' && ['ready', 'in-progress'].includes(collectSampleTask?.status ?? '')) {
    return 'ORDERED';
  }

  // Collected: SR.status = active & Task(CST).status = completed & Task(IRT).status = ready
  if (
    serviceRequest.status === 'active' &&
    collectSampleTask?.status === 'completed' &&
    ['ready', 'in-progress'].includes(interpretResultsTask?.status ?? '')
  ) {
    return 'COLLECTED';
  }

  // Final: SR.status = completed && DR.status = 'final'
  if (
    serviceRequest.status === 'completed'
    // todo commenting this out for now as its not needed but that may change when we allow edits
    // (documentReference?.status === 'final' || documentReference?.status === 'amended')
  ) {
    return 'FINAL';
  }

  return 'UNKNOWN' as 'ORDERED'; // todo: maybe add separate type for unknown status?
}

export function buildOrderHistory(
  provenances: Provenance[],
  serviceRequest: ServiceRequest,
  specimen?: Specimen
): {
  status: TestStatus;
  statusSubtitle: string | undefined;
  providerName: string;
  date: string;
}[] {
  const history: {
    status: TestStatus;
    statusSubtitle: string | undefined;
    providerName: string;
    date: string;
  }[] = [];
  console.log('building order history for sr', serviceRequest.id);
  // Add entries from provenances
  provenances.forEach((provenance) => {
    const relatedToSR = provenanceIsTargetOfServiceRequest(provenance, serviceRequest);
    if (relatedToSR) {
      const activityCode = provenance.activity?.coding?.[0]?.code;

      // Map activity codes to statuses
      let status: TestStatus | undefined;
      let statusSubtitle: string | undefined;

      if (activityCode === PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder.code) {
        status = 'ORDERED';
      } else if (activityCode === PROVENANCE_ACTIVITY_CODING_ENTITY.inputResults.code) {
        status = 'FINAL';
      } else if (activityCode === PROVENANCE_ACTIVITY_CODING_ENTITY.editResults.code) {
        status = 'FINAL';
        statusSubtitle = 'updated results';
      }

      if (status && provenance.recorded) {
        const agentName = provenance.agent?.[0]?.who?.display || '';

        history.push({
          status,
          statusSubtitle,
          providerName: agentName,
          date: provenance.recorded,
        });
      }
    }
  });

  if (specimen) {
    const collectedByDisplay = specimen.collection?.collector?.display || '';
    const collectedByDate = specimen.collection?.collectedDateTime;

    if (collectedByDate) {
      history.push({
        status: 'COLLECTED',
        statusSubtitle: undefined,
        providerName: collectedByDisplay,
        date: collectedByDate,
      });
    }
  }

  history.sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return history;
}

export const getSpecimenDetails = (specimen: Specimen): InHouseOrderDetailPageItemDTO['specimen'] => {
  const specimenCollection = specimen.collection;
  if (specimenCollection) {
    const standardizedSource = specimenCollection.bodySite?.coding?.find(
      (c) => c.system === SPECIMEN_COLLECTION_SOURCE_SYSTEM
    )?.display;
    const customSource = specimenCollection.bodySite?.coding?.find(
      (c) => c.system === SPECIMEN_COLLECTION_CUSTOM_SOURCE_SYSTEM
    )?.display;
    const sources = [];
    if (standardizedSource) sources.push(standardizedSource);
    if (customSource) sources.push(customSource);

    // todo not sure if we want to split like this, think it might cause issues with timezones
    const collectedDateTimeIso = specimen.collection?.collectedDateTime;
    const collectedDate = collectedDateTimeIso?.split('T')[0];
    const collectedTime = collectedDateTimeIso?.split('T')[1].split('.')[0];

    const specimenDetails = {
      source: sources.join(', '),
      collectedBy: specimen.collection?.collector?.display || '',
      collectionDate: collectedDate || '',
      collectionTime: collectedTime || '',
    };
    return specimenDetails;
  }
  throw new Error(`missing specimen details for specimen ${specimen.id}`);
};

export const taskIsBasedOnServiceRequest = (task: Task, serviceRequest: ServiceRequest): boolean => {
  return !!task.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`);
};

export const provenanceIsTargetOfServiceRequest = (provenance: Provenance, serviceRequest: ServiceRequest): boolean => {
  return !!provenance.target?.some((target) => target.reference === `ServiceRequest/${serviceRequest.id}`);
};

/**
 *
 * @param serviceRequests an array of service requests
 * @param serviceRequestSearchId the id of the service request driving the search (will not be included in the return)
 * @returns all service requests contained in basedOn for the serviceRequestSearchId or all service requests that contain serviceRequestSearchId in their basedOn
 */
export const getRelatedServiceRequests = (
  serviceRequests: ServiceRequest[],
  serviceRequestSearchId: string
): ServiceRequest[] => {
  let serviceRequestSearched: ServiceRequest | undefined;
  const additionalServiceRequests = serviceRequests.reduce((acc: ServiceRequest[], sr) => {
    if (sr.id) {
      if (sr.id !== serviceRequestSearchId) {
        acc.push(sr);
      } else {
        serviceRequestSearched = sr;
      }
    }
    return acc;
  }, []);

  const relatedServiceRequests: ServiceRequest[] = [];
  if (additionalServiceRequests.length > 0 && serviceRequestSearched) {
    // was the service request passed as the search param the initial test or ran as repeat?
    const initialServiceRequestId = serviceRequestSearched?.basedOn
      ? serviceRequestSearched.basedOn[0].reference?.replace('ServiceRequest/', '')
      : serviceRequestSearched?.id;
    console.log('initialServiceRequestId,', initialServiceRequestId);
    additionalServiceRequests.forEach((sr) => {
      // confirm its indeed related
      const basedOn = sr.basedOn?.[0].reference?.replace('ServiceRequest/', '');
      if (sr.id === initialServiceRequestId || (basedOn && basedOn === initialServiceRequestId)) {
        relatedServiceRequests.push(sr);
      }
    });
  }
  return relatedServiceRequests;
};

interface RelatedSrResourceConfig {
  [srId: string]: {
    diagnosticReports: DiagnosticReport[];
    observations: Observation[];
    provenances: Provenance[];
    tasks: Task[];
    specimens: Specimen[];
    relatedAdUrlCanonicalUrl: string | undefined;
    // type: 'reflex' | 'repeat'; // todo labs it would be nice to map this
  };
}

// these additional tests are either related via repeat testing or reflex testing
export const fetchResultResourcesForRelatedServiceRequest = async (
  oystehr: Oystehr,
  serviceRequests: ServiceRequest[]
): Promise<{
  additionalDiagnosticReports: DiagnosticReport[];
  additionalObservations: Observation[];
  additionalProvenances: Provenance[];
  additionalTasks: Task[];
  additionalSpecimens: Specimen[];
  additionalActivityDefinitions: ActivityDefinition[];
  srResourceMap: RelatedSrResourceConfig;
}> => {
  console.log('making requests for additional service requests representing related tests');
  let srResourceMap: RelatedSrResourceConfig = makeSrResourceMap(serviceRequests);
  const resources = (
    await oystehr.fhir.search<
      ServiceRequest | DiagnosticReport | Observation | Provenance | Task | Specimen | ActivityDefinition
    >({
      resourceType: 'ServiceRequest',
      params: [
        {
          name: '_id',
          value: serviceRequests.map((sr) => sr.id).join(','),
        },
        {
          name: '_revinclude',
          value: 'DiagnosticReport:based-on',
        },
        {
          name: '_include:iterate',
          value: 'DiagnosticReport:result',
        },
        {
          name: '_revinclude',
          value: 'Provenance:target',
        },
        {
          name: '_revinclude',
          value: 'Task:based-on',
        },
        {
          name: '_include',
          value: 'ServiceRequest:specimen',
        },
        {
          name: '_include',
          value: 'ServiceRequest:instantiates-canonical',
        },
      ],
    })
  ).unbundle();

  const additionalDiagnosticReports: DiagnosticReport[] = [];
  const additionalObservations: Observation[] = [];
  const additionalProvenances: Provenance[] = [];
  const additionalTasks: Task[] = [];
  const additionalSpecimens: Specimen[] = [];
  const additionalActivityDefinitions: ActivityDefinition[] = []; // reflex tests will have different ADs so we need to do this

  resources.forEach((r) => {
    if (r.resourceType === 'DiagnosticReport' && r.status !== 'entered-in-error') {
      additionalDiagnosticReports.push(r);
      srResourceMap = addToSrResourceMap(r, 'diagnosticReports', srResourceMap);
    }
    if (r.resourceType === 'Observation') {
      additionalObservations.push(r);
      srResourceMap = addToSrResourceMap(r, 'observations', srResourceMap);
    }
    if (r.resourceType === 'Provenance') {
      additionalProvenances.push(r);
      srResourceMap = addToSrResourceMap(r, 'provenances', srResourceMap);
    }
    if (r.resourceType === 'Task') {
      additionalTasks.push(r);
      srResourceMap = addToSrResourceMap(r, 'tasks', srResourceMap);
    }
    if (r.resourceType === 'Specimen') {
      additionalSpecimens.push(r);
      srResourceMap = addToSrResourceMap(r, 'specimens', srResourceMap);
    }
    if (r.resourceType === 'ActivityDefinition') {
      additionalActivityDefinitions.push(r);
    }
  });

  console.log('srResourceMap', JSON.stringify(srResourceMap));

  return {
    additionalDiagnosticReports,
    additionalObservations,
    additionalProvenances,
    additionalTasks,
    additionalSpecimens,
    additionalActivityDefinitions,
    srResourceMap,
  };
};

const makeSrResourceMap = (serviceRequests: ServiceRequest[]): RelatedSrResourceConfig => {
  const config = serviceRequests.reduce((acc: RelatedSrResourceConfig, sr) => {
    const relatedAdUrlCanonicalUrl = sr.instantiatesCanonical?.[0];
    if (sr.id) {
      acc[sr.id] = {
        diagnosticReports: [],
        observations: [],
        provenances: [],
        tasks: [],
        specimens: [],
        relatedAdUrlCanonicalUrl,
      };
    }
    return acc;
  }, {});
  return config;
};

const getSrIdFromResource = (resource: FhirResource): string | undefined => {
  switch (resource.resourceType) {
    case 'DiagnosticReport':
    case 'Observation':
    case 'Task':
      return resource.basedOn
        ?.find((based) => based.reference?.startsWith('ServiceRequest/'))
        ?.reference?.replace('ServiceRequest/', '');
    case 'Provenance':
      return resource.target
        ?.find((tar) => tar.reference?.startsWith('ServiceRequest/'))
        ?.reference?.replace('ServiceRequest/', '');
    case 'Specimen':
      return resource.request
        ?.find((tar) => tar.reference?.startsWith('ServiceRequest/'))
        ?.reference?.replace('ServiceRequest/', '');
    default:
      return undefined;
  }
};

const addToSrResourceMap = (
  resource: FhirResource,
  addTo: keyof RelatedSrResourceConfig[string],
  srResourceMap: RelatedSrResourceConfig
): RelatedSrResourceConfig => {
  const srId = getSrIdFromResource(resource);
  if (!srId || !srResourceMap[srId]) return srResourceMap;

  return {
    ...srResourceMap,
    [srId]: {
      ...srResourceMap[srId],
      [addTo]: [...(srResourceMap[srId][addTo] as any[]), resource],
    },
  };
};

export const fetchActiveInHouseLabActivityDefinitions = async (oystehr: Oystehr): Promise<ActivityDefinition[]> => {
  return oystehr.fhir
    .search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        { name: '_tag', value: IN_HOUSE_TAG_DEFINITION.code },
        { name: 'status', value: 'active' },
      ],
    })
    .then((response) => response.unbundle());
};

export const getInHouseLabTestUrlAndVersionForADFromServiceRequest = (
  serviceRequest: ServiceRequest
): { url: string; version: string } => {
  const adUrl = serviceRequest.instantiatesCanonical?.[0].split('|')[0];
  const version = serviceRequest.instantiatesCanonical?.[0].split('|')[1];
  if (!adUrl || !version)
    throw new Error(
      `error parsing instantiatesCanonical url for SR ${serviceRequest.id}, either the url or the version could not be parsed: ${adUrl} ${version}`
    );
  console.log('AD url and version parsed:', adUrl, version);
  return { url: adUrl, version };
};

export const provenanceIsInHouseLabResultEntry = (provenance: Provenance): boolean => {
  return !!provenance.activity?.coding?.some(
    (c) => c.code === PROVENANCE_ACTIVITY_CODES.editResults || c.code === PROVENANCE_ACTIVITY_CODES.inputResults
  );
};

/**
 * **************************
 *
 * These functions convert an AdminInHouseLabItemDefinition into an ActivityDefinition
 *
 * **************************
 */

const AD_CANONICAL_URL_BASE = 'https://ottehr.com/FHIR/InHouseLab/ActivityDefinition';

const sanitizeForId = (str: string): string => {
  /* eslint-disable-next-line  no-useless-escape */
  return str.replace(/[ ()\/\\]/g, '');
};

const valueSetConfigDiff = (
  a: Set<AdminLabComponentValueSetConfig>,
  b: Set<AdminLabComponentValueSetConfig>
): Set<AdminLabComponentValueSetConfig> => {
  const bCodes = new Set([...b].map((x) => x.code));
  return new Set([...a].filter((x) => !bCodes.has(x.code)));
};

const makeValueSet = (
  itemName: string,
  values: AdminLabComponentValueSetConfig[],
  valueSetName: string
): { valueSetId: string; valueSet: ValueSet } => {
  const valueSetId = `contained-${sanitizeForId(itemName)}-${valueSetName.toLowerCase()}-valueSet`;

  const valueSet: ValueSet = {
    id: valueSetId,
    resourceType: 'ValueSet',
    status: 'active',
    compose: {
      include: [
        {
          system: IN_HOUSE_RESULTS_VALUESET_SYSTEM,
          concept: values.map((valueStr) => {
            return {
              code: valueStr.code,
              display: valueStr.display,
            };
          }),
        },
      ],
    },
  };

  return {
    valueSetId,
    valueSet,
  };
};

const makeUnitCoding = (unitStr: string): CodeableConcept => {
  return {
    coding: [
      {
        system: IN_HOUSE_UNIT_OF_MEASURE_SYSTEM,
        code: unitStr,
      },
    ],
  };
};

const makeQuantitativeDetails = (item: QuantityComponent): ObservationDefinitionQuantitativeDetails => {
  if (!item.normalRange) {
    throw new Error(`Cannot make quantitativeDetails for ${JSON.stringify(item)}`);
  }
  return {
    decimalPrecision: item.normalRange.precision,
    unit: item.normalRange.unit ? makeUnitCoding(item.normalRange.unit) : undefined,
  };
};

const makeQualifiedInterval = (item: QuantityComponent): ObservationDefinitionQualifiedInterval => {
  if (!item.normalRange) {
    throw new Error(`Cannot make QualifiedInterval for ${JSON.stringify(item)}`);
  }
  return {
    category: 'reference',
    range: {
      low: item.normalRange.low !== undefined ? { value: item.normalRange.low } : undefined,
      high: item.normalRange.high !== undefined ? { value: item.normalRange.high } : undefined,
    },
  };
};

const makeObsDefExtension = (item: TestItemComponent): Extension[] => {
  const display = item.display.type as string;
  const displayExt: Extension = {
    url: OD_DISPLAY_CONFIG.url as string,
    valueString: display,
  };
  const extension: Extension[] = [displayExt];

  if (item.dataType === 'string') {
    // handle at least the string validation
    if (item.display.validations) {
      for (const [key, val] of Object.entries(item.display.validations)) {
        if (key === 'format') {
          extension.push({
            url: OD_VALUE_VALIDATION_CONFIG.url,
            valueCoding: {
              system: OD_VALUE_VALIDATION_CONFIG.formatValidation.url,
              code: val.value,
              display: val.display,
            },
          });
        }
      }
    }
  } else if (item.display?.nullOption) {
    extension.push(IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG);
  }

  return extension;
};

const makeRelatedArtifact = (item: AdminInHouseLabItemDefinition): RelatedArtifact[] | undefined => {
  const parentTestUrls: string[] = [];
  item.components.forEach((component) => {
    if (component.reflexLogic) {
      if ('parentTestUrl' in component.reflexLogic) parentTestUrls.push(component.reflexLogic.parentTestUrl);
    }
  });
  if (parentTestUrls.length === 0) return;

  const artifacts: RelatedArtifact[] = [];
  parentTestUrls.forEach((url) => {
    const artifact: RelatedArtifact = {
      resource: url,
      type: 'depends-on',
      display: REFLEX_ARTIFACT_DISPLAY,
    };
    artifacts.push(artifact);
  });
  return artifacts;
};

const makeActivityExtension = (item: AdminInHouseLabItemDefinition): Extension[] | undefined => {
  const extension: Extension[] = [];
  if (item.repeatTest) {
    extension.push({
      url: REPEATABLE_TEXT_EXTENSION_CONFIG.url,
      valueString: REPEATABLE_TEXT_EXTENSION_CONFIG.valueString,
    });
  }
  const reflexLogics: ReflexLogic[] = [];
  item.components.forEach((component) => {
    if (component.reflexLogic) {
      if ('testToRun' in component.reflexLogic) reflexLogics.push(component.reflexLogic);
    }
  });
  if (reflexLogics.length) {
    reflexLogics.forEach((logic) => {
      extension.push({
        url: REFLEX_TEST_LOGIC_URL,
        extension: [
          {
            url: REFLEX_TEST_TO_RUN_URL,
            valueCanonical: logic.testToRun.testCanonicalUrl,
          },
          {
            url: REFLEX_TEST_TO_RUN_NAME_URL,
            valueString: logic.testToRun.testName,
          },
          {
            url: REFLEX_TEST_ALERT_URL,
            valueString: logic.triggerAlert,
          },
          {
            url: REFLEX_TEST_CONDITION_URL,
            valueExpression: {
              description: logic.condition.description,
              language: logic.condition.language,
              expression: logic.condition.expression,
            },
          },
        ],
      });
    });
  }

  return extension.length ? extension : undefined;
};

const getUnitForCodeableConceptType = (item: CodeableConceptComponent): CodeableConcept | undefined => {
  if (item.dataType !== 'CodeableConcept') return undefined;
  if (!item.unit) return undefined;

  return makeUnitCoding(item.unit);
};

const getComponentObservationDefinition = (
  item: TestItemComponent
): { obsDef: ObservationDefinition; contained: (ValueSet | ObservationDefinition)[] } => {
  const { componentName, loincCode } = item;

  const observationDefCodeCoding = loincCode
    ? loincCode.map((loincCode) => {
        return { system: 'http://loinc.org', code: loincCode } as Coding;
      })
    : [DEFAULT_OBSERVATION_DEFINITION_CODING];

  const obsDef: ObservationDefinition = {
    // changing these ids will create a backwards compatibility issue for the results page
    id: `contained-${sanitizeForId(
      componentName.toLowerCase()
    )}-component-${item.dataType.toLowerCase()}-observationDef-id`,
    resourceType: 'ObservationDefinition',
    code: {
      coding: observationDefCodeCoding,
      text: componentName,
    },
    permittedDataType: [item.dataType],
  };

  const contained: (ValueSet | ObservationDefinition)[] = [];

  if (item.dataType === 'CodeableConcept') {
    if (!item.valueSet?.length) {
      throw new Error(`valueSet not defined on codeableConcept component ${componentName} ${JSON.stringify(item)}`);
    }

    const validValuesFromConfig = item.valueSet.filter((value) => !value.isAbnormal);
    const abnormalValuesFromConfig = item.valueSet.filter((value) => value.isAbnormal);

    const { valueSetId: validValueSetId, valueSet: validValueSet } = makeValueSet(
      componentName,
      validValuesFromConfig,
      'valid'
    );

    const { valueSetId: abnormalValueSetId, valueSet: abnormalValueSet } = makeValueSet(
      componentName,
      abnormalValuesFromConfig,
      'abnormal'
    );

    // the normalValueSet will serve as the reference range
    const validSet = new Set(item.valueSet);
    const abnormalSet = new Set(abnormalValuesFromConfig);
    const { valueSetId: refRangeValueSetId, valueSet: refRangeValueSet } = makeValueSet(
      componentName,
      [...valueSetConfigDiff(validSet, abnormalSet)],
      'reference-range'
    );

    obsDef.validCodedValueSet = {
      type: 'ValueSet',
      reference: `#${validValueSetId}`,
    };

    obsDef.abnormalCodedValueSet = {
      type: 'ValueSet',
      reference: `#${abnormalValueSetId}`,
    };

    obsDef.normalCodedValueSet = {
      type: 'ValueSet',
      reference: `#${refRangeValueSetId}`,
    };

    obsDef.extension = makeObsDefExtension(item);

    if (item.unit) {
      obsDef.quantitativeDetails = { unit: getUnitForCodeableConceptType(item) };
    }

    contained.push(validValueSet, abnormalValueSet, refRangeValueSet, obsDef);
  } else if (item.dataType === 'Quantity') {
    if (!item.normalRange) {
      throw new Error(`No normalRange for quantity type component ${componentName} ${JSON.stringify(item)}`);
    }

    obsDef.quantitativeDetails = makeQuantitativeDetails(item);
    obsDef.qualifiedInterval = [makeQualifiedInterval(item)];
    obsDef.extension = makeObsDefExtension(item);
    contained.push(obsDef);
  } else if (item.dataType === 'string') {
    obsDef.extension = makeObsDefExtension(item);
    contained.push(obsDef);
  } else {
    throw new Error(`Got unrecognized component item: ${JSON.stringify(item)}`);
  }

  return {
    obsDef,
    contained,
  };
};

function getObservationRequirement(item: AdminInHouseLabItemDefinition): {
  obsDefReferences: Reference[];
  contained: (ValueSet | ObservationDefinition)[];
} {
  const obsDefReferences: Reference[] = [];
  const contained: (ValueSet | ObservationDefinition)[] = [];

  item.components.forEach((item) => {
    const { obsDef, contained: componentContained } = getComponentObservationDefinition(item);

    if (!obsDef.id) {
      throw new Error(`Error in obsDef generation, no id found for component ${JSON.stringify(item)}`);
    }
    obsDefReferences.push({
      type: 'ObservationDefinition',
      reference: `#${obsDef.id}`,
    });

    contained.push(...componentContained);
  });

  return {
    obsDefReferences,
    contained,
  };
}

function getParticipant(
  methods: AdminInHouseLabItemDefinition['methods'],
  device: AdminInHouseLabItemDefinition['device']
): ActivityDefinition['participant'] {
  const participant: ActivityDefinition['participant'] = [];

  const coding: Coding[] = [];

  if (methods) {
    coding.push(
      ...[
        ...Object.entries(methods)
          .filter((entry): entry is [string, { device: string }] => entry[1] !== undefined)
          .map(([key, value]) => ({
            system: IN_HOUSE_PARTICIPANT_ROLE_SYSTEM,
            code: key,
            display: value.device,
          })),
      ]
    );
  }

  if (device) {
    coding.push({
      ...IN_HOUSE_DEVICE_PARTICIPANT_CODING,
      display: device,
    });
  }

  if (coding.length)
    participant.push({
      type: IN_HOUSE_LAB_ACTIVITY_DEFINITION_DEVICE_PARTICIPANT_TYPE,
      role: {
        coding,
      },
    });

  return participant.length ? participant : undefined;
}

// ATHENA TODO: will want to determine the version not in this step most likely, but will need the url
// ATHENA TODO: handle the annoying comma case -- need to sanitize again, maybe in sanitizeForId
export const getInHouseLabTestUrlAndVersion = (
  item: AdminInHouseLabItemDefinition | ActivityDefinition,
  adUrlVersionMap: { [url: string]: string }
): { url: string; version: string } => {
  if (!item.name) throw new Error('Item must have a name');
  const nameForUrl = item.name.split(' ').join('');
  const url = `${AD_CANONICAL_URL_BASE}/${nameForUrl}`;
  const curVersion = adUrlVersionMap[url];
  const updatedVersion = curVersion ? parseInt(curVersion) + 1 : 1;
  return { url, version: updatedVersion.toString() };
};

export function convertAdminInHouseLabItemDefinitionToActivityDefinition(
  testConfig: AdminInHouseLabItemDefinition
): ActivityDefinition {
  console.log('Making ActivityDefinition for testConfig: ', JSON.stringify(testConfig));

  const adUrlVersionMap: { [url: string]: string } = {};

  const { obsDefReferences, contained } = getObservationRequirement(testConfig);

  // this will default to version 1 at the onset which is fine, but if running in API mode, we need to figure out the current version and increment
  const { url: activityDefUrl, version: activityDefVersion } = getInHouseLabTestUrlAndVersion(
    testConfig,
    adUrlVersionMap
  );

  const activityDef: ActivityDefinition = {
    resourceType: 'ActivityDefinition',
    status: 'active',
    kind: 'ServiceRequest',
    code: {
      coding: [
        {
          system: IN_HOUSE_TEST_CODE_SYSTEM,
          code: testConfig.name,
        },
        ...testConfig.cptCode.map((cptCode: CptCodeInHouseLabDefinition) => {
          return {
            system: CODE_SYSTEM_CPT,
            code: cptCode.code,
            ...(cptCode.modifier ? { extension: [makeCptModifierExtension(cptCode.modifier)] } : {}),
          };
        }),
      ],
    },
    title: testConfig.name,
    name: testConfig.name,
    participant: getParticipant(testConfig.methods, testConfig.device),
    // specimenRequirement -- nothing in the test requirements describes this
    observationRequirement: obsDefReferences,
    contained: contained,
    url: activityDefUrl,
    version: activityDefVersion,
    meta: {
      tag: [
        {
          system: IN_HOUSE_TAG_DEFINITION.system,
          code: IN_HOUSE_TAG_DEFINITION.code,
        },
      ],
    },
    relatedArtifact: makeRelatedArtifact(testConfig),
    extension: makeActivityExtension(testConfig),
  };

  console.log('ActivityDefinition: ', JSON.stringify(activityDefUrl, undefined, 2));

  return activityDef;
}

/**
 * **************************
 *
 * These functions convert an ActivityDefinition to an AdminInHouseLabItemDefinition
 *
 * **************************
 */
export function parseActivityDefinitionToAdminInHouseLabItemDef(
  _ad: ActivityDefinition
): AdminInHouseLabItemDefinition {
  return {} as AdminInHouseLabItemDefinition;

  // const name = ad.name ?? ad.title ?? '';

  // const cptCode = parseCptCodes(ad);
  // const methods = parseMethods(ad);
  // const device = parseDevice(ad);
  // const repeatTest = parseRepeatTest(ad);
  // const reflexExtensions = parseReflexExtensions(ad);
  // const parentArtifacts = parseRelatedArtifacts(ad);

  // const components = parseComponents(ad, reflexExtensions, parentArtifacts);

  // return {
  //   name,
  //   device: device,
  //   methods,
  //   cptCode,
  //   repeatTest,
  //   components,
  //   note: undefined,
  // };
}

// function parseCptCodes(ad: ActivityDefinition): CptCodeInHouseLabDefinition[] {
//   const codings = ad.code?.coding ?? [];

//   return codings
//     .filter((c) => c.system === CODE_SYSTEM_CPT)
//     .map((c) => ({
//       code: c.code!,
//       modifier: c.extension ? parseCptModifierExtension(c.extension) : undefined,
//     }));
// }

// function parseMethods(ad: ActivityDefinition): TestItemMethods | undefined {
//   const participant = ad.participant?.find(
//     (participant) => participant.type === IN_HOUSE_LAB_ACTIVITY_DEFINITION_DEVICE_PARTICIPANT_TYPE
//   );
//   if (!participant?.role?.coding) return;

//   const methods: TestItemMethods = {};

//   // ATHENA TODO: this is being overly generous -- we should only be grabing 'manual', 'analyzer' or 'machine'
//   participant.role?.coding?.forEach((coding) => {
//     if (TEST_ITEM_METHOD_KEYS.includes(coding.code))
//       methods[coding.code] = {
//         device: coding.display ?? '',
//       };
//   });

//   return methods;
// }

// function parseDevice(ad: ActivityDefinition): AdminInHouseLabItemDefinition['device'] {
//   const deviceParticipant = ad.participant?.find(
//     (participant) => participant.type === IN_HOUSE_LAB_ACTIVITY_DEFINITION_DEVICE_PARTICIPANT_TYPE
//   );
//   if (!deviceParticipant) return undefined;

//   const device = deviceParticipant.role?.coding?.find(
//     (coding) =>
//       coding.system === IN_HOUSE_DEVICE_PARTICIPANT_CODING.system &&
//       coding.code === IN_HOUSE_DEVICE_PARTICIPANT_CODING.code
//   );

//   return device ? device.display : undefined;
// }

// function parseRepeatTest(ad: ActivityDefinition): boolean {
//   return ad.extension?.some((ext) => ext.url === REPEATABLE_TEXT_EXTENSION_CONFIG.url) ?? false;
// }

// function parseReflexExtensions(ad: ActivityDefinition): ReflexLogic[] {
//   const reflexExts = ad.extension?.filter((ext) => ext.url === REFLEX_TEST_LOGIC_URL) ?? [];

//   return reflexExts.map((ext) => {
//     const get = (url: string): Extension | undefined => ext.extension?.find((e) => e.url === url);

//     return {
//       testToRun: {
//         testCanonicalUrl: get(REFLEX_TEST_TO_RUN_URL)?.valueCanonical!,
//         testName: get(REFLEX_TEST_TO_RUN_NAME_URL)?.valueString!,
//       },
//       triggerAlert: get(REFLEX_TEST_ALERT_URL)?.valueString!,
//       condition: {
//         description: get(REFLEX_TEST_CONDITION_URL)?.valueExpression?.description ?? '',
//         language: get(REFLEX_TEST_CONDITION_URL)?.valueExpression?.language!,
//         expression: get(REFLEX_TEST_CONDITION_URL)?.valueExpression?.expression!,
//       },
//     };
//   });
// }

// function parseRelatedArtifacts(ad: ActivityDefinition): string[] {
//   return ad.relatedArtifact?.filter((ra) => ra.type === 'depends-on').map((ra) => ra.resource!) ?? [];
// }

// function getObsDefByRef(ad: ActivityDefinition, ref: Reference): ObservationDefinition | undefined {
//   const id = ref.reference?.replace('#', '');
//   return ad.contained?.find((r) => r.resourceType === 'ObservationDefinition' && r.id === id) as
//     | ObservationDefinition
//     | undefined;
// }

// function parseComponents(
//   ad: ActivityDefinition,
//   reflexExtensions: ReflexLogic[],
//   parentArtifacts: string[]
// ): TestItemComponent[] {
//   const refs = ad.observationRequirement ?? [];

//   return refs.map((ref, index) => {
//     const obsDef = getObsDefByRef(ad, ref);
//     if (!obsDef) throw new Error('Missing ObservationDefinition');

//     return parseSingleComponent(obsDef, ad, reflexExtensions[index], parentArtifacts[index]);
//   });
// }

// function parseSingleComponent(
//   obsDef: ObservationDefinition,
//   ad: ActivityDefinition,
//   reflexLogic?: ReflexLogic,
//   parentTestUrl?: string
// ): TestItemComponent {
//   const base: BaseComponent = {
//     componentName: obsDef.code?.text ?? '',
//     loincCode: obsDef.code?.coding?.filter((c) => c.system === 'http://loinc.org').map((c) => c.code!),
//     reflexLogic: reflexLogic ?? (parentTestUrl ? { parentTestUrl } : undefined),
//   };

//   const dataType = obsDef.permittedDataType?.[0];

//   if (dataType === 'CodeableConcept') {
//     return parseCodeableConceptComponent(base, obsDef, ad);
//   }

//   if (dataType === 'Quantity') {
//     return parseQuantityComponent(base, obsDef);
//   }

//   if (dataType === 'string') {
//     return parseStringComponent(base, obsDef);
//   }

//   throw new Error(`Unknown dataType ${dataType}`);
// }

// function parseCodeableConceptComponent(
//   base: BaseComponent,
//   obsDef: ObservationDefinition,
//   ad: ActivityDefinition
// ): CodeableConceptComponent {
//   const getValueSet = (ref?: Reference): ValueSet | undefined => {
//     const id = ref?.reference?.replace('#', '');
//     return ad.contained?.find((r): r is ValueSet => r.resourceType === 'ValueSet' && r.id === id);
//   };

//   const valid = getValueSet(obsDef.validCodedValueSet);
//   const abnormal = getValueSet(obsDef.abnormalCodedValueSet);

//   const toValues = (vs?: ValueSet, isAbnormal = false): AdminLabComponentValueSetConfig[] =>
//     vs?.compose?.include?.[0]?.concept?.map((c) => ({
//       code: c.code!,
//       display: c.display!,
//       isAbnormal,
//     })) ?? [];

//   const valueSet = [...toValues(valid, false), ...toValues(abnormal, true)];

//   return {
//     ...base,
//     dataType: 'CodeableConcept',
//     valueSet,
//     display: { type: 'Select', nullOption: false }, // ATHENA TODO: The display type might also be radio, need to check this
//   };
// }

// function parseQuantityComponent(base: BaseComponent, obsDef: ObservationDefinition): QuantityComponent {
//   const interval = obsDef.qualifiedInterval?.[0];

//   return {
//     ...base,
//     dataType: 'Quantity',
//     normalRange: {
//       low: interval?.range?.low?.value,
//       high: interval?.range?.high?.value,
//       precision: obsDef.quantitativeDetails?.decimalPrecision ?? 0,
//       unit: obsDef.quantitativeDetails?.unit?.coding?.[0]?.code,
//     },
//     display: { type: 'Numeric', nullOption: false },
//   };
// }

// function parseStringComponent(base: BaseComponent, obsDef: ObservationDefinition): StringComponent {
//   // ATHENA TODO: obsDef is never read, what gives?

//   return {
//     ...base,
//     dataType: 'string',
//     display: { type: 'Free Text' },
//   };
// }
