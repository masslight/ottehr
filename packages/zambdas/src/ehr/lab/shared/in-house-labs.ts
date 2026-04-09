import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { ProcedureModifier } from 'candidhealth/api';
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
import { DateTime } from 'luxon';
import {
  AdminInHouseLabConfigOutput,
  AdminInHouseLabItemDefinition,
  AdminLabComponentValueSetConfig,
  BaseComponent,
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_CPT_MODIFIER,
  CodeableConceptComponent,
  CodeableConceptComponentDisplayTypes,
  CptCodeInHouseLabDefinition,
  DEFAULT_OBSERVATION_DEFINITION_CODING,
  EXTENSION_URL_CPT_MODIFIER,
  IN_HOUSE_DEVICE_PARTICIPANT_CODING,
  IN_HOUSE_LAB_ACTIVITY_DEFINITION_DEVICE_PARTICIPANT_TYPE,
  IN_HOUSE_LAB_LATEST_TAG_DEFINITION,
  IN_HOUSE_LAB_OBSERVATION_DEF_DISPLAY_SYSTEM,
  IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG,
  IN_HOUSE_LAB_OD_NULL_OPTION_SYSTEM,
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
  REFLEX_TEST_CONDITION_LANGUAGES,
  REFLEX_TEST_CONDITION_URL,
  REFLEX_TEST_LOGIC_URL,
  REFLEX_TEST_TO_RUN_NAME_URL,
  REFLEX_TEST_TO_RUN_URL,
  ReflexLogic,
  REPEATABLE_TEXT_EXTENSION_CONFIG,
  SPECIMEN_COLLECTION_CUSTOM_SOURCE_SYSTEM,
  SPECIMEN_COLLECTION_SOURCE_SYSTEM,
  StringComponent,
  TEST_ITEM_METHOD_KEYS,
  TestItemComponent,
  TestItemMethods,
  TestItemMethodsKey,
  TestStatus,
  Validation,
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
    .then((response) => {
      const unbundled = response.unbundle();
      console.log(
        `These are the ActivityDefinitions found in fetchActiveInHouseLabActivityDefinitions: `,
        JSON.stringify(
          unbundled.map((ad) => ({
            name: ad.name,
            id: ad.id,
            url: ad.url,
            version: ad.version,
            status: ad.status,
          })),
          undefined,
          2
        )
      );
      return unbundled;
    });
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
  return str.replace(/[ ()\/\\]/g, '').replace(/,/g, '-');
};

// Don't want things like commas in code fields in case we ever try to do fhir searches and commas are meaningful
const sanitizeForCode = (str: string): string => {
  return str.replace(/,/g, '');
};

const sanitizeComma = (str: string): string => {
  return str.replace(/,/g, '-');
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

// labs todo: this is brittle because you can't reliably walk it back to its corresponding component without relying
// solely on ordering in the array (which could change). In the future consider adding the component name or some identifier
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

// labs todo: this is also brittle for the same reason -- can't reliably tie the reflex logic back to its corresponding component without
// relying solely on index in the extension array. Should also consider adding a component name or some such
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

    const validValuesFromConfig = item.valueSet;
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

export type SemVer = {
  major: number;
  minor: number;
  patch: number;
};

type SemVerPart = 'major' | 'minor' | 'patch';

export function incrementSemVer(version: SemVer, part: SemVerPart): SemVer {
  switch (part) {
    case 'major':
      return {
        major: version.major + 1,
        minor: 0,
        patch: 0,
      };
    case 'minor':
      return {
        major: version.major,
        minor: version.minor + 1,
        patch: 0,
      };
    case 'patch':
      return {
        major: version.major,
        minor: version.minor,
        patch: version.patch + 1,
      };
  }
}

export function parseSemVer(version: string): SemVer {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    throw new Error(`Invalid semver string: "${version}"`);
  }

  const [, major, minor, patch] = match;

  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
  };
}

export function semverToString(version: SemVer): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

export const getInHouseLabTestUrlAndVersion = (
  item: AdminInHouseLabItemDefinition | ActivityDefinition,
  adUrlVersionMap: { [url: string]: string }
): { url: string; version: string } => {
  if (!item.name) throw new Error('Item must have a name');
  const nameForUrl = sanitizeComma(item.name.split(' ').join(''));
  const url = `${AD_CANONICAL_URL_BASE}/${nameForUrl}`;
  const curVersion = adUrlVersionMap[url];
  const updatedVersion = curVersion ? semverToString(incrementSemVer(parseSemVer(curVersion), 'patch')) : '1.0.0';
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

  const relatedArtifact = makeRelatedArtifact(testConfig);

  const activityDef: ActivityDefinition = {
    resourceType: 'ActivityDefinition',
    status: 'active',
    kind: 'ServiceRequest',
    code: {
      coding: [
        {
          system: IN_HOUSE_TEST_CODE_SYSTEM,
          code: sanitizeForCode(testConfig.name),
        },
        ...testConfig.cptCode.map((cptCode: CptCodeInHouseLabDefinition) => {
          return {
            system: CODE_SYSTEM_CPT,
            code: cptCode.code,
            ...(cptCode.modifier ? { extension: [makeCptModifierExtension(cptCode.modifier)] } : {}),
          };
        }),
        ...(testConfig.loincCode
          ? testConfig.loincCode.map((loinc): Coding => {
              return { system: 'http://loinc.org', code: loinc };
            })
          : []),
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
    ...(relatedArtifact ? { relatedArtifact } : {}),
    extension: makeActivityExtension(testConfig),
  };

  console.log('ActivityDefinition: ', JSON.stringify(activityDef, undefined, 2));

  return activityDef;
}

/**
 * **************************
 *
 * These functions convert an ActivityDefinition to an AdminInHouseLabItemDefinition
 *
 * **************************
 */
export function parseActivityDefinitionToAdminInHouseLabItemDef(ad: ActivityDefinition): AdminInHouseLabItemDefinition {
  const name = ad.name ?? ad.title ?? '';

  const cptCode = parseCptCodes(ad);
  const methods = parseMethods(ad);
  const device = parseDevice(ad);
  const repeatTest = parseRepeatTest(ad);
  const reflexExtensions = parseReflexExtensions(ad);
  const parentArtifacts = parseRelatedArtifacts(ad);
  const loincCode = parseLoincCodes(ad);

  const components = parseComponents(ad, reflexExtensions, parentArtifacts);

  return {
    name,
    ...(device ? { device: device } : {}),
    ...(methods ? { methods } : {}),
    cptCode,
    ...(loincCode && loincCode.length ? { loincCode } : {}),
    repeatTest,
    components,
    // note: undefined, // we never define this anywhere
  };
}

function parseLoincCodes(resource: ActivityDefinition | ObservationDefinition): string[] | undefined {
  return resource.code?.coding
    ?.filter((c) => c.system === 'http://loinc.org')
    .map((c) => c.code)
    .filter((elm) => elm !== undefined);
}

function parseCptCodes(ad: ActivityDefinition): CptCodeInHouseLabDefinition[] {
  const codings = ad.code?.coding ?? [];

  return codings
    .filter((c) => c.system === CODE_SYSTEM_CPT)
    .map((c) => ({
      code: c.code!,
      ...(c.extension ? { modifier: parseCptModifierExtension(c.extension) } : {}),
    }));
}

function parseCptModifierExtension(ext: Extension[]): CptCodeInHouseLabDefinition['modifier'] {
  const cptModifierExt = ext.filter((e) => e.url === EXTENSION_URL_CPT_MODIFIER);

  const modifierCodings = cptModifierExt
    .flatMap((ext) => ext.valueCodeableConcept?.coding)
    .filter((coding): coding is Coding => coding !== undefined && coding.system === CODE_SYSTEM_CPT_MODIFIER);

  if (!modifierCodings.length) return undefined;

  const modifiers = modifierCodings
    ?.map((coding) => {
      if (coding.code && coding.display) return { code: coding.code as ProcedureModifier, display: coding.display };
      return undefined;
    })
    .filter((elm) => elm !== undefined);

  return modifiers;
}

function parseMethods(ad: ActivityDefinition): TestItemMethods | undefined {
  const participant = ad.participant?.find(
    (participant) => participant.type === IN_HOUSE_LAB_ACTIVITY_DEFINITION_DEVICE_PARTICIPANT_TYPE
  );
  if (!participant?.role?.coding) return;

  function isTestItemMethodsKey(key: string): key is TestItemMethodsKey {
    return TEST_ITEM_METHOD_KEYS.includes(key as TestItemMethodsKey);
  }

  const methods: TestItemMethods = {};

  participant.role?.coding?.forEach((coding) => {
    if (coding.code && isTestItemMethodsKey(coding.code))
      methods[coding.code] = {
        device: coding.display ?? '',
      };
  });

  return methods;
}

function parseDevice(ad: ActivityDefinition): AdminInHouseLabItemDefinition['device'] {
  const deviceParticipant = ad.participant?.find(
    (participant) => participant.type === IN_HOUSE_LAB_ACTIVITY_DEFINITION_DEVICE_PARTICIPANT_TYPE
  );
  if (!deviceParticipant) return undefined;

  const device = deviceParticipant.role?.coding?.find(
    (coding) =>
      coding.system === IN_HOUSE_DEVICE_PARTICIPANT_CODING.system &&
      coding.code === IN_HOUSE_DEVICE_PARTICIPANT_CODING.code
  );

  return device ? device.display : undefined;
}

function parseRepeatTest(ad: ActivityDefinition): boolean {
  return (
    ad.extension?.some(
      (ext) =>
        ext.url === REPEATABLE_TEXT_EXTENSION_CONFIG.url &&
        ext.valueString === REPEATABLE_TEXT_EXTENSION_CONFIG.valueString
    ) ?? false
  );
}

function parseReflexExtensions(ad: ActivityDefinition): ReflexLogic[] {
  const reflexExts = ad.extension?.filter((ext) => ext.url === REFLEX_TEST_LOGIC_URL);
  if (!reflexExts?.length) return [];

  const reflexLogics = reflexExts.map((reflexExt): ReflexLogic => {
    const getExtByUrlWithFail = (url: string): Extension => {
      const expectedExtension = reflexExt.extension?.find((e) => e.url === url);
      if (!expectedExtension) {
        console.error(
          `Error parsing reflex extensions for ActivityDefinition/${ad.id}. Could not find ${url} in ${JSON.stringify(
            reflexExt
          )}`
        );
        throw new Error(`Error parsing reflexLogic for ActivityDefinition/${ad.id}`);
      }
      return expectedExtension;
    };

    // labs todo: consider improving the error checking here when we implement admin in house v2 that handles reflex tests
    // only did this language one because of type checks

    const conditionExt = getExtByUrlWithFail(REFLEX_TEST_CONDITION_URL);
    const expression = conditionExt.valueExpression;

    if (!expression?.language) {
      throw new Error(`Missing language in reflex condition for ActivityDefinition/${ad.id}`);
    }

    if (expression.language !== REFLEX_TEST_CONDITION_LANGUAGES.fhirPath) {
      throw new Error(`Unsupported language "${expression.language}" in ActivityDefinition/${ad.id}`);
    }

    return {
      testToRun: {
        testCanonicalUrl: getExtByUrlWithFail(REFLEX_TEST_TO_RUN_URL).valueCanonical ?? '',
        testName: getExtByUrlWithFail(REFLEX_TEST_TO_RUN_NAME_URL).valueString ?? '',
      },
      triggerAlert: getExtByUrlWithFail(REFLEX_TEST_ALERT_URL).valueString ?? '',
      condition: {
        description: getExtByUrlWithFail(REFLEX_TEST_CONDITION_URL).valueExpression?.description ?? '',
        language: expression.language,
        expression: getExtByUrlWithFail(REFLEX_TEST_CONDITION_URL).valueExpression?.expression ?? '',
      },
    };
  });

  return reflexLogics;
}

function parseRelatedArtifacts(ad: ActivityDefinition): string[] {
  return ad.relatedArtifact?.filter((ra) => ra.type === 'depends-on').map((ra) => ra.resource!) ?? [];
}

function getContainedObsDefByRef(ad: ActivityDefinition, ref: Reference): ObservationDefinition | undefined {
  const id = ref.reference?.replace('#', '');
  return ad.contained?.find(
    (r): r is ObservationDefinition => r.resourceType === 'ObservationDefinition' && r.id === id
  );
}

function parseComponents(
  ad: ActivityDefinition,
  reflexExtensions: ReflexLogic[],
  parentArtifacts: string[]
): TestItemComponent[] {
  const refs = ad.observationRequirement ?? [];

  return refs.map((ref, index) => {
    const obsDef = getContainedObsDefByRef(ad, ref);
    if (!obsDef) throw new Error('Missing ObservationDefinition');

    // labs todo: in the future we should try to make sure that a reflexLogic and a parentArtifact can reliably be tied back to its component
    // without relying on index this way which is brittle
    return parseSingleComponent(obsDef, ad, reflexExtensions[index], parentArtifacts[index]);
  });
}

function parseSingleComponent(
  obsDef: ObservationDefinition,
  ad: ActivityDefinition,
  reflexLogic?: ReflexLogic,
  parentTestUrl?: string
): TestItemComponent {
  let reflexLogicField: BaseComponent['reflexLogic'];

  if (reflexLogic) {
    reflexLogicField = reflexLogic;
  } else if (parentTestUrl) {
    reflexLogicField = { parentTestUrl };
  }

  const loincCode = parseLoincCodes(obsDef);
  const base: BaseComponent = {
    componentName: obsDef.code?.text ?? '',
    ...(loincCode && loincCode.length ? { loincCode } : {}),
    ...(reflexLogicField ? { reflexLogic: reflexLogicField } : {}),
  };

  const dataType = obsDef.permittedDataType?.[0];

  if (dataType === 'CodeableConcept') {
    return parseCodeableConceptComponent(base, obsDef, ad);
  }

  if (dataType === 'Quantity') {
    return parseQuantityComponent(base, obsDef);
  }

  if (dataType === 'string') {
    return parseStringComponent(base, obsDef);
  }

  throw new Error(`Unknown dataType ${dataType}`);
}

function parseCodeableConceptComponent(
  base: BaseComponent,
  obsDef: ObservationDefinition,
  ad: ActivityDefinition
): CodeableConceptComponent {
  const getValueSet = (ref?: Reference): ValueSet | undefined => {
    const id = ref?.reference?.replace('#', '');
    return ad.contained?.find((r): r is ValueSet => r.resourceType === 'ValueSet' && r.id === id);
  };

  // the display info is on the obsDef, not the valueSet itself
  const displayExt = obsDef.extension?.find((ext) => ext.url === IN_HOUSE_LAB_OBSERVATION_DEF_DISPLAY_SYSTEM);
  const nullOptionExt = obsDef.extension?.find((ext) => ext.url === IN_HOUSE_LAB_OD_NULL_OPTION_SYSTEM);

  if (!displayExt || !displayExt.valueString) throw new Error(`Error parsing component display for ${obsDef.id}`);

  const displayFromObsDef: CodeableConceptComponent['display'] = {
    type: displayExt.valueString as CodeableConceptComponentDisplayTypes,
    nullOption: nullOptionExt !== undefined,
  };

  const toConfigValues = (vs?: ValueSet, isAbnormal = false): AdminLabComponentValueSetConfig[] =>
    vs?.compose?.include?.[0]?.concept?.map((c) => ({
      code: c.code,
      display: c.display || c.code, // we assign it this way when we're making it too
      isAbnormal,
    })) ?? [];

  // all values whether abnormal or normal go into the component's validCodedValueSet -- we can then figure out the abnormal ones from there
  // and this should also match the ordering from the original component config
  const allValues = toConfigValues(getValueSet(obsDef.validCodedValueSet));

  const abnormalValueSetCodeLookup = new Set(
    toConfigValues(getValueSet(obsDef.abnormalCodedValueSet)).map((configValue) => configValue.code)
  );

  const updatedValues = allValues.map(
    (configValue): AdminLabComponentValueSetConfig => ({
      ...configValue,
      isAbnormal: abnormalValueSetCodeLookup.has(configValue.code),
    })
  );

  const unit = obsDef.quantitativeDetails?.unit?.coding?.find(
    (coding) => coding.system === IN_HOUSE_UNIT_OF_MEASURE_SYSTEM
  )?.code;

  return {
    ...base,
    dataType: 'CodeableConcept',
    valueSet: updatedValues,
    display: displayFromObsDef,
    ...(unit ? { unit } : {}),
  };
}

function parseQuantityComponent(base: BaseComponent, obsDef: ObservationDefinition): QuantityComponent {
  const interval = obsDef.qualifiedInterval?.[0];
  const low = interval?.range?.low?.value;
  const high = interval?.range?.high?.value;
  const unitCoding = obsDef.quantitativeDetails?.unit?.coding?.find(
    (coding) => coding.system === IN_HOUSE_UNIT_OF_MEASURE_SYSTEM
  );

  const unit = unitCoding?.code ?? '';
  if (low === undefined || high === undefined)
    throw new Error(
      `Unable to parse quantity component for obs def ${obsDef.id}, this was the internal ${JSON.stringify(
        interval
      )} and the unit: ${unit}`
    );

  const precision = obsDef.quantitativeDetails?.decimalPrecision;
  return {
    ...base,
    dataType: 'Quantity',
    normalRange: {
      low,
      high,
      ...(precision !== undefined ? { precision } : {}),
      unit,
    },
    display: { type: 'Numeric', nullOption: false },
  };
}

function parseStringComponent(base: BaseComponent, obsDef: ObservationDefinition): StringComponent {
  const parseValidations = (exts: Extension[] | undefined): Validation | undefined => {
    const validationExt = exts?.find((ext) => ext.url === OD_VALUE_VALIDATION_CONFIG.url);
    if (!validationExt) return undefined;

    if (!validationExt.valueCoding || validationExt.valueCoding.code === undefined)
      throw new Error(`Unable to parse free text component validation for obs def ${obsDef.id}`);

    return {
      format: {
        value: validationExt.valueCoding.code,
        display: validationExt.valueCoding.display,
      },
    };
  };

  return {
    ...base,
    dataType: 'string',
    display: { type: 'Free Text', validations: parseValidations(obsDef.extension) },
  };
}

export const makeAdminInHouseLabConfigOutput = (
  activityDefinition: ActivityDefinition
): AdminInHouseLabConfigOutput => {
  const activityDefinitionId = activityDefinition.id ?? '';

  const isLatest =
    activityDefinition.meta?.tag?.some(
      (tag) =>
        tag.system === IN_HOUSE_LAB_LATEST_TAG_DEFINITION.system && tag.code === IN_HOUSE_LAB_LATEST_TAG_DEFINITION.code
    ) || false;

  const testConfig = parseActivityDefinitionToAdminInHouseLabItemDef(activityDefinition);
  const canonicalUrl = activityDefinition.url;
  if (!canonicalUrl) {
    console.error(`ActivityDefinition/${activityDefinitionId} missing canonical url`);
    throw new Error('Misconfigured ActivityDefinition is missing its url');
  }
  const version = activityDefinition.version;
  if (!version) {
    console.error(`ActivityDefinition/${activityDefinitionId} missing version`);
    throw new Error('Misconfigured ActivityDefinition is missing its version');
  }

  const output: AdminInHouseLabConfigOutput = {
    activityDefinitionId: activityDefinition.id || '',
    activityDefinitionStatus: activityDefinition.status === 'active' ? 'active' : 'retired',
    canonicalUrl,
    version,
    isLatest,
    testConfig,
  };

  return output;
};

export function makeAdminProvenanceResourceRequest(
  targetRefStrings: string[],
  currentUserId: string,
  provenanceType: 'ADD' | 'EDIT' | 'TOGGLE-STATUS'
): BatchInputPostRequest<Provenance> {
  const getProvenanceType = (): Coding => {
    switch (provenanceType) {
      case 'ADD':
        return PROVENANCE_ACTIVITY_CODING_ENTITY.adminCreate;
      case 'EDIT':
        return PROVENANCE_ACTIVITY_CODING_ENTITY.adminEdit;
      case 'TOGGLE-STATUS':
        return PROVENANCE_ACTIVITY_CODING_ENTITY.adminUpdateStatus;
    }
  };

  const provenanceFhir: Provenance = {
    resourceType: 'Provenance',
    target: targetRefStrings.map((target): Reference => {
      return { reference: target };
    }),
    recorded: DateTime.now().toISO(),
    agent: [
      {
        who: { reference: `Practitioner/${currentUserId}` },
      },
    ],
    activity: {
      coding: [getProvenanceType()],
    },
  };

  return {
    method: 'POST',
    url: '/Provenance',
    resource: provenanceFhir,
  };
}
