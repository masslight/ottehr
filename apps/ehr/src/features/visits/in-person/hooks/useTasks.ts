import { SearchParam } from '@oystehr/sdk';
import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Encounter, Reference, Task as FhirTask, TaskInput } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  chooseJson,
  CreateManualTaskRequest,
  getCoding,
  getExtension,
  IN_HOUSE_LAB_TASK,
  isFollowupEncounter,
  LAB_ORDER_TASK,
  LabType,
  MANUAL_TASK,
  PROVIDER_NOTIFICATION_TAG_SYSTEM,
  RADIOLOGY_TASK,
  Task,
  TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
  TASK_CATEGORY_IDENTIFIER,
  TASK_INPUT_SYSTEM,
  TASK_LOCATION_SYSTEM,
  TaskAlertCode,
} from 'utils';
import { getRadiologyOrderEditUrl } from '../routing/helpers';

export const GET_TASKS_KEY = 'get-tasks';
const GO_TO_LAB_TEST = 'Go to Lab Test';
const GO_TO_TASK = 'Go to task';
const GO_TO_ORDER = 'Go to Order';

export const TASKS_PAGE_SIZE = 20;

const TASK_CODES_TO_EXCLUDE = [
  LAB_ORDER_TASK.code.preSubmission,
  IN_HOUSE_LAB_TASK.code.collectSampleTask,
  IN_HOUSE_LAB_TASK.code.inputResultsTask,
];

export interface TasksSearchParams {
  assignedTo?: string | null;
  category?: string | null;
  location?: string | null;
  status?: string | null;
  page?: number;
}

export interface AssignTaskRequest {
  taskId: string;
  assignee: {
    id: string;
    name: string;
  };
}

export interface UnassignTaskRequest {
  taskId: string;
}

export interface CompleteTaskRequest {
  taskId: string;
}

export const useGetTasks = ({
  assignedTo,
  category,
  location,
  status,
  page,
}: TasksSearchParams): UseQueryResult<{ tasks: Task[]; total: number }, Error> => {
  const { oystehr } = useApiClients();
  return useQuery({
    queryKey: [GET_TASKS_KEY, assignedTo, category, location, status, page],
    queryFn: async () => {
      if (!oystehr) throw new Error('oystehr not defined');
      const params: SearchParam[] = [
        {
          name: '_tag',
          value: 'task',
        },
        {
          name: '_sort',
          value: '-authored-on',
        },
        {
          name: '_total',
          value: 'accurate',
        },
        {
          name: '_count',
          value: TASKS_PAGE_SIZE,
        },
        {
          name: 'status:not',
          value: 'cancelled',
        },
        ...TASK_CODES_TO_EXCLUDE.map((code) => ({ name: 'code:not', value: code })),
      ];
      if (page) {
        params.push({
          name: '_offset',
          value: page * TASKS_PAGE_SIZE,
        });
      }
      if (assignedTo) {
        params.push({
          name: 'owner',
          value: 'Practitioner/' + assignedTo,
        });
      }
      if (category) {
        params.push({
          name: 'group-identifier',
          value: TASK_CATEGORY_IDENTIFIER + '|' + category,
        });
      }
      if (location) {
        params.push({
          name: '_tag',
          value: TASK_LOCATION_SYSTEM + '|' + location,
        });
      }
      if (status) {
        params.push({
          name: 'status',
          value: status,
        });
      }
      params.push({
        name: '_include',
        value: 'Task:encounter',
      });
      const bundle = await oystehr.fhir.search<FhirTask | Encounter>({
        resourceType: 'Task',
        params,
      });
      const resources = bundle.unbundle();
      const tasks = resources.filter((r) => r.resourceType === 'Task') as FhirTask[];
      const encounters = resources.filter((r) => r.resourceType === 'Encounter') as Encounter[];
      const encountersMap = new Map<string, Encounter>();
      encounters.forEach((encounter) => {
        if (encounter.id) {
          encountersMap.set(encounter.id, encounter);
        }
      });
      // can probably remove filterTasks, leaving for now because we have a handful of tasks in prod that will get pulled on in a weird way if removed
      const transformedTasks = tasks.filter(filterTasks).map((task) => fhirTaskToTask(task, encountersMap));
      return {
        tasks: transformedTasks,
        total: bundle.total ?? -1,
      };
    },
    enabled: oystehr != null,
    retry: 2,
    staleTime: 5 * 1000,
  });
};

export const useAssignTask = (): UseMutationResult<void, Error, AssignTaskRequest> => {
  const { oystehr } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AssignTaskRequest) => {
      if (!oystehr) throw new Error('oystehr not defined');
      await oystehr.fhir.patch<FhirTask>({
        resourceType: 'Task',
        id: input.taskId,
        operations: [
          {
            op: 'add',
            path: '/owner',
            value: {
              reference: 'Practitioner/' + input.assignee.id,
              display: input.assignee.name,
              extension: [
                {
                  url: TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
                  valueDateTime: DateTime.now().toISO(),
                },
              ],
            },
          },
          {
            op: 'replace',
            path: '/status',
            value: 'in-progress',
          },
        ],
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [GET_TASKS_KEY],
        exact: false,
      });
    },
  });
};

export const useUnassignTask = (): UseMutationResult<void, Error, UnassignTaskRequest> => {
  const { oystehr } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UnassignTaskRequest) => {
      if (!oystehr) throw new Error('oystehr not defined');
      const taskResource = await oystehr.fhir.get<FhirTask>({
        resourceType: 'Task',
        id: input.taskId,
      });
      const updatedMetaTags = taskResource.meta?.tag?.filter((tag) => tag.system !== PROVIDER_NOTIFICATION_TAG_SYSTEM);
      await oystehr.fhir.patch<FhirTask>({
        resourceType: 'Task',
        id: input.taskId,
        operations: [
          {
            op: 'remove',
            path: '/owner',
          },
          {
            op: 'replace',
            path: '/status',
            value: 'ready',
          },
          {
            op: 'replace',
            path: `/meta/tag`,
            value: updatedMetaTags,
          },
        ],
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [GET_TASKS_KEY],
        exact: false,
      });
    },
  });
};

// this is probably not needed
// pdf attachment results are no longer saved in diagnostic reports so these tasks are not getting made anymore
function filterTasks(task: FhirTask): boolean {
  const category = task.groupIdentifier?.value ?? '';
  if (category === LAB_ORDER_TASK.category) {
    const labTypeString = getInputString(LAB_ORDER_TASK.input.drTag, task);
    if (labTypeString === 'pdfAttachment') return false;
  }
  return true;
}

export const useCreateManualTask = (): UseMutationResult<void, Error, CreateManualTaskRequest> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateManualTaskRequest) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        ...input,
        id: 'create-manual-task',
      });
      return chooseJson(response);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [GET_TASKS_KEY],
        exact: false,
      });
    },
  });
};

export const useCompleteTask = (): UseMutationResult<void, Error, CompleteTaskRequest> => {
  const { oystehr } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CompleteTaskRequest) => {
      if (!oystehr) throw new Error('oystehr not defined');
      await oystehr.fhir.patch<FhirTask>({
        resourceType: 'Task',
        id: input.taskId,
        operations: [
          {
            op: 'replace',
            path: '/status',
            value: 'completed',
          },
        ],
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [GET_TASKS_KEY],
        exact: false,
      });
    },
  });
};

function fhirTaskToTask(task: FhirTask, encountersMap?: Map<string, Encounter>): Task {
  const category = task.groupIdentifier?.value ?? '';
  let action: any = undefined;
  let title = '';
  let subtitle = '';
  let details: string | undefined = undefined;

  // Extract encounterId and check if it's a follow-up encounter
  let encounterId = task.encounter?.reference?.split('/')?.[1];
  if (!encounterId) {
    encounterId = getInputString(MANUAL_TASK.input.encounterId, task);
  }
  const encounter = encounterId ? encountersMap?.get(encounterId) : undefined;
  const isFollowUp = encounter ? isFollowupEncounter(encounter) : false;

  // Helper function to add encounterId query parameter if it's a follow-up
  const addEncounterIdToLink = (link: string | undefined): string | undefined => {
    if (!link || !isFollowUp || !encounterId) return link;
    return `${link}?encounterId=${encounterId}`;
  };
  if (category === LAB_ORDER_TASK.category) {
    const code = getCoding(task.code, LAB_ORDER_TASK.system)?.code ?? '';
    const testName = getInputString(LAB_ORDER_TASK.input.testName, task);
    const labName = getInputString(LAB_ORDER_TASK.input.labName, task);
    const fullTestName = testName + (labName ? ' / ' + labName : '');
    const patientName = getInputString(LAB_ORDER_TASK.input.patientName, task);
    const appointmentId = getInputString(LAB_ORDER_TASK.input.appointmentId, task);
    const serviceRequestId = task.basedOn
      ?.find((reference) => reference.reference?.startsWith('ServiceRequest'))
      ?.reference?.split('/')?.[1];
    const diagnosticReportId = task.basedOn
      ?.find((reference) => reference.reference?.startsWith('DiagnosticReport'))
      ?.reference?.split('/')?.[1];
    const providerName = getInputString(LAB_ORDER_TASK.input.providerName, task);
    const orderDate = getInputString(LAB_ORDER_TASK.input.orderDate, task);
    const labTypeString = getInputString(LAB_ORDER_TASK.input.drTag, task);

    if (code === LAB_ORDER_TASK.code.preSubmission) {
      title = `Collect sample for “${fullTestName}” for ${patientName}`;
      subtitle = `Ordered by ${providerName} on ${orderDate ? formatDate(orderDate) : ''}`;
      action = {
        name: GO_TO_LAB_TEST,
        link: addEncounterIdToLink(`/in-person/${appointmentId}/external-lab-orders/${serviceRequestId}/order-details`),
      };
    }
    if (
      serviceRequestId &&
      (code === LAB_ORDER_TASK.code.reviewFinalResult || code === LAB_ORDER_TASK.code.reviewCorrectedResult)
    ) {
      title = `Review results for “${fullTestName}” for ${patientName}`;
      subtitle = `Ordered by ${providerName} on ${orderDate ? formatDate(orderDate) : ''}`;
      action = {
        name: GO_TO_LAB_TEST,
        link: addEncounterIdToLink(`/in-person/${appointmentId}/external-lab-orders/${serviceRequestId}/order-details`),
      };
    }
    if (code === LAB_ORDER_TASK.code.matchUnsolicitedResult) {
      const receivedDate = getInputString(LAB_ORDER_TASK.input.receivedDate, task);
      title = `Match unsolicited test results`;
      subtitle = `Received on ${receivedDate ? formatDate(receivedDate) : ''}`;
      action = {
        name: 'Match',
        link: `/unsolicited-results/${diagnosticReportId}/match`,
      };
    }
    if (
      diagnosticReportId &&
      (code === LAB_ORDER_TASK.code.reviewFinalResult ||
        code === LAB_ORDER_TASK.code.reviewCorrectedResult ||
        code === LAB_ORDER_TASK.code.reviewPreliminaryResult)
    ) {
      if (labTypeString === LabType.unsolicited && !serviceRequestId) {
        const receivedDate = getInputString(LAB_ORDER_TASK.input.receivedDate, task);
        title = `Review unsolicited test results for “${fullTestName}” for ${patientName}`;
        subtitle = `Received on ${receivedDate ? formatDate(receivedDate) : ''}`;
        action = {
          name: 'Go to Lab Test',
          link: `/unsolicited-results/${diagnosticReportId}/review`,
        };
      }
      if (labTypeString === LabType.reflex) {
        const receivedDate = getInputString(LAB_ORDER_TASK.input.receivedDate, task);
        title = `Review reflex results for “${fullTestName}” for ${patientName}`;
        subtitle = `Received on ${receivedDate ? formatDate(receivedDate) : ''}`;
        action = {
          name: 'Go to Lab Test',
          link: addEncounterIdToLink(
            `/in-person/${appointmentId}/external-lab-orders/report/${diagnosticReportId}/order-details`
          ),
        };
      }
    }
  }
  if (category === IN_HOUSE_LAB_TASK.category) {
    const code = getCoding(task.code, IN_HOUSE_LAB_TASK.system)?.code ?? '';
    const testName = getInputString(IN_HOUSE_LAB_TASK.input.testName, task);
    const patientName = getInputString(IN_HOUSE_LAB_TASK.input.patientName, task);
    const providerName = getInputString(IN_HOUSE_LAB_TASK.input.providerName, task);
    const orderDate = getInputString(IN_HOUSE_LAB_TASK.input.orderDate, task);
    const appointmentId = getInputString(IN_HOUSE_LAB_TASK.input.appointmentId, task);
    subtitle = `Ordered by ${providerName} on ${orderDate ? formatDate(orderDate) : ''}`;
    if (code === IN_HOUSE_LAB_TASK.code.collectSampleTask) {
      title = `Collect sample for “${testName}” for ${patientName}`;
    }
    if (code === IN_HOUSE_LAB_TASK.code.inputResultsTask) {
      title = `Perform test & enter results for “${testName}” for ${patientName}`;
    }
    action = {
      name: GO_TO_LAB_TEST,
      link: addEncounterIdToLink(
        `/in-person/${appointmentId}/in-house-lab-orders/${task.basedOn?.[0]?.reference?.split('/')?.[1]}/order-details`
      ),
    };
  }
  if (category.startsWith('manual')) {
    const providerName = getInputString(MANUAL_TASK.input.providerName, task);
    const patientReference = getInputReference(MANUAL_TASK.input.patient, task);
    const appointmentId = getInputString(MANUAL_TASK.input.appointmentId, task);
    const orderId = getInputString(MANUAL_TASK.input.orderId, task);
    title =
      getInputString(MANUAL_TASK.input.title, task) +
      (patientReference ? ' for ' + patientReference.display?.replaceAll(',', '') : '');
    subtitle = `Manual task by ${providerName} / ${task.location?.display ?? ''}`;
    details = getInputString(MANUAL_TASK.input.details, task) ?? '';
    if (orderId) {
      if (category === MANUAL_TASK.category.inHouseLab) {
        action = {
          name: GO_TO_TASK,
          link: addEncounterIdToLink(`/in-person/${appointmentId}/in-house-lab-orders/${orderId}/order-details`),
        };
      }
      if (category === MANUAL_TASK.category.externalLab) {
        action = {
          name: GO_TO_TASK,
          link: addEncounterIdToLink(`/in-person/${appointmentId}/external-lab-orders/${orderId}/order-details`),
        };
      }
      if (category === MANUAL_TASK.category.nursingOrders) {
        action = {
          name: GO_TO_TASK,
          link: addEncounterIdToLink(`/in-person/${appointmentId}/nursing-orders/${orderId}/order-details`),
        };
      }
      if (category === MANUAL_TASK.category.radiology) {
        action = {
          name: GO_TO_TASK,
          link: addEncounterIdToLink(`/in-person/${appointmentId}/radiology/${orderId}/order-details`),
        };
      }
      if (category === MANUAL_TASK.category.procedures) {
        action = {
          name: GO_TO_TASK,
          link: addEncounterIdToLink(`/in-person/${appointmentId}/procedures/${orderId}`),
        };
      }
    } else if (appointmentId) {
      action = {
        name: GO_TO_TASK,
        link: addEncounterIdToLink(`/in-person/${appointmentId}`),
      };
    } else if (patientReference) {
      action = {
        name: GO_TO_TASK,
        link: `/patient/${patientReference.reference?.split('/')?.[1]}`,
      };
    }
  }
  if (category === RADIOLOGY_TASK.category) {
    // const patientName = getInputString(IN_HOUSE_LAB_TASK.input.patientName, task);
    const code = getCoding(task.code, RADIOLOGY_TASK.system)?.code ?? '';
    const appointmentId = getInputString(IN_HOUSE_LAB_TASK.input.appointmentId, task) ?? '';
    const orderId =
      task.basedOn
        ?.find((ref) => ref.reference?.startsWith('ServiceRequest/'))
        ?.reference?.replace('ServiceRequest/', '') ?? '';
    const link = getRadiologyOrderEditUrl(appointmentId, orderId);
    action = { name: GO_TO_ORDER, link: addEncounterIdToLink(link) };

    const orderDate = getInputString(RADIOLOGY_TASK.input.orderDate, task);
    const providerName = getInputString(LAB_ORDER_TASK.input.providerName, task);
    subtitle = `Ordered by ${providerName} on ${orderDate ? formatDate(orderDate) : ''}`;

    if (code === RADIOLOGY_TASK.code.reviewFinalResultTask) {
      title = `Review Radiology Final Results`;
    }
  }
  return {
    id: task.id ?? '',
    category: category,
    createdDate: task.authoredOn ?? '',
    title: title,
    subtitle: subtitle,
    details: details,
    status: task.status,
    action: action,
    assignee: task.owner
      ? {
          id: task.owner?.reference?.split('/')?.[1] ?? '',
          name: task.owner?.display ?? '',
          date: getExtension(task.owner, TASK_ASSIGNED_DATE_TIME_EXTENSION_URL)?.valueDateTime ?? '',
        }
      : undefined,
    alert: getAlertCode(task),
    completable: category.startsWith('manual'),
  };
}

function getInputString(code: string, task: FhirTask): string | undefined {
  return getInput(code, task)?.valueString;
}

function getAlertCode(task: FhirTask): TaskAlertCode | undefined {
  const code = getInput('alert', task)?.valueString;
  if (!code) return;
  const isAlertInputCode = Object.values(TaskAlertCode).includes(code as any);
  if (isAlertInputCode) return code as TaskAlertCode;
  return;
}

function getInputReference(code: string, task: FhirTask): Reference | undefined {
  return getInput(code, task)?.valueReference;
}

function getInput(code: string, task: FhirTask): TaskInput | undefined {
  return task.input?.find((input) => getCoding(input.type, TASK_INPUT_SYSTEM)?.code === code);
}

export function formatDate(dateIso: string): string {
  return DateTime.fromISO(dateIso).toFormat('MM/dd/yyyy h:mm a', { locale: 'en-US' });
}
