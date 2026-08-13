import Oystehr, { SearchParam } from '@oystehr/sdk';
import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Operation } from 'fast-json-patch';
import { Encounter, Reference, Task as FhirTask, TaskInput } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
  TASK_CATEGORY_IDENTIFIER,
  TASK_INPUT_SYSTEM,
  TASK_LOCATION_SYSTEM,
} from 'utils/lib/fhir/constants';
import { isFollowupEncounter } from 'utils/lib/fhir/encounter';
import { getCoding, getExtension } from 'utils/lib/fhir/helpers';
import { safelyCaptureException, safelyCaptureMessage } from 'utils/lib/frontend/sentry';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { PROVIDER_NOTIFICATION_TAG_SYSTEM } from 'utils/lib/types/api/practitioner.types';
import { IN_HOUSE_LAB_TASK } from 'utils/lib/types/data/in-house/in-house.constants';
import { LAB_ORDER_TASK } from 'utils/lib/types/data/labs/labs.constants';
import { LabType } from 'utils/lib/types/data/labs/labs.types';
import {
  CreateManualTaskRequest,
  ERX_TASK,
  FAX_TASK,
  MANUAL_TASK,
  RADIOLOGY_TASK,
  Task,
  TaskAlertCode,
} from 'utils/lib/types/data/tasks/types';
import { getRadiologyOrderEditUrl } from '../routing/helpers';

export const GET_TASKS_KEY = 'get-tasks';
export const OPEN_DOSESPOT = 'Open DoseSpot';
// Read-only action label for fax tasks that have already been actioned (filed/deleted).
export const VIEW_FAX = 'View';

const GO_TO_LAB_TEST = 'Go to Lab Test';
const GO_TO_TASK = 'Go to task';
const GO_TO_ORDER = 'Go to Order';

export const TASKS_PAGE_SIZE = 20;

const TASK_CODES_TO_EXCLUDE = [
  LAB_ORDER_TASK.code.preSubmission,
  LAB_ORDER_TASK.code.reviewCancelledResult,
  IN_HOUSE_LAB_TASK.code.collectSampleTask,
  IN_HOUSE_LAB_TASK.code.inputResultsTask,
];

const TASK_STATUSES_TO_EXCLUDE = [
  'cancelled',
  'rejected', // labs sets tasks to rejected when we delete orders
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

export interface TaskSearchStream {
  tasks: FhirTask[];
  total: number | undefined;
}

/**
 * Merge the two searches that back the location filter — tasks tagged with the selected
 * location, and location-agnostic tasks (no location tag at all, e.g. inbound faxes) — into a
 * single page of results.
 *
 * Both streams arrive sorted by `-authored-on`, so merging, sorting by `authoredOn` desc and
 * slicing the requested window reproduces the ordering a single server-side query would give.
 *
 * Exported for tests: this is the only place the "a location filter never hides a
 * location-agnostic task" guarantee is enforced.
 */
export const mergeLocationFilteredTasks = ({
  tagged,
  untagged,
  pageOffset,
  pageSize,
}: {
  tagged: TaskSearchStream;
  untagged: TaskSearchStream;
  pageOffset: number;
  pageSize: number;
}): { tasks: FhirTask[]; total: number } => {
  const hasLocationTag = (task: FhirTask): boolean =>
    !!task.meta?.tag?.some((tag) => tag.system === TASK_LOCATION_SYSTEM);

  // `_tag:not=<system>|` (system, empty code) is meant to exclude every task carrying a tag in
  // the location system. Servers that read the empty code literally instead return
  // location-tagged tasks too, so drop them here rather than showing another location's tasks.
  const locationLessTasks = untagged.tasks.filter((task) => !hasLocationTag(task));
  const untaggedStreamIsUnfiltered = locationLessTasks.length !== untagged.tasks.length;
  if (untaggedStreamIsUnfiltered) {
    // The window we fetched was partly consumed by tasks that should have been excluded
    // server-side, so location-agnostic tasks beyond it may be missing from this page and
    // `untagged.total` counts rows we just discarded. Surface it instead of silently showing a
    // short page with a confident-looking count.
    safelyCaptureMessage('Task location `_tag:not` filter was not honored by the server', {
      level: 'error',
      tags: {
        invariant: 'task-search:tag-not-excludes-location-tagged',
        site: 'useGetTasks',
        returned: String(untagged.tasks.length),
        locationLess: String(locationLessTasks.length),
      },
    });
  }

  const seenTaskIds = new Set<string>();
  const tasks = [...tagged.tasks, ...locationLessTasks]
    .filter((task) => {
      if (!task.id || seenTaskIds.has(task.id)) return false;
      seenTaskIds.add(task.id);
      return true;
    })
    .sort((a, b) => (b.authoredOn ?? '').localeCompare(a.authoredOn ?? ''))
    .slice(pageOffset, pageOffset + pageSize);

  // -1 tells TablePagination the count is unknown, which is honest: either stream may have
  // omitted its total, or the untagged total counts tasks we had to discard client-side.
  const total =
    tagged.total != null && untagged.total != null && !untaggedStreamIsUnfiltered ? tagged.total + untagged.total : -1;

  return { tasks, total };
};

const getTaskEncounterId = (task: FhirTask): string | undefined =>
  task.encounter?.reference?.split('/')?.[1] ?? getInputString(MANUAL_TASK.input.encounterId, task);

/**
 * The encounters behind a page of tasks, keyed by id. They only decide whether a task's link needs
 * a follow-up `encounterId` query param, so a failed lookup degrades the links rather than the
 * page — and, being a separate search, they can never be mistaken for tasks.
 */
const fetchTaskEncounters = async (oystehr: Oystehr, tasks: FhirTask[]): Promise<Map<string, Encounter>> => {
  const encounterIds = [...new Set(tasks.map(getTaskEncounterId).filter((id): id is string => !!id))];
  const encountersMap = new Map<string, Encounter>();
  if (encounterIds.length === 0) return encountersMap;
  try {
    const encounters = (
      await oystehr.fhir.search<Encounter>({
        resourceType: 'Encounter',
        params: [
          { name: '_id', value: encounterIds.join(',') },
          { name: '_count', value: encounterIds.length },
        ],
      })
    ).unbundle();
    encounters.forEach((encounter) => {
      if (encounter.id) {
        encountersMap.set(encounter.id, encounter);
      }
    });
  } catch (error) {
    safelyCaptureException(error);
  }
  return encountersMap;
};

export const useGetTasks = (
  { assignedTo, category, location, status, page }: TasksSearchParams,
  options?: { refetchInterval?: number | false }
): UseQueryResult<{ tasks: Task[]; total: number }, Error> => {
  const { oystehr } = useApiClients();
  return useQuery({
    queryKey: [GET_TASKS_KEY, assignedTo, category, location, status, page],
    queryFn: async () => {
      if (!oystehr) throw new Error('oystehr not defined');
      const baseParams: SearchParam[] = [
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
        ...TASK_STATUSES_TO_EXCLUDE.map((status) => ({ name: 'status:not', value: status })),
        ...TASK_CODES_TO_EXCLUDE.map((code) => ({ name: 'code:not', value: code })),
      ];
      if (assignedTo) {
        baseParams.push({
          name: 'owner',
          value: 'Practitioner/' + assignedTo,
        });
      }
      if (category) {
        baseParams.push({
          name: 'group-identifier',
          value: TASK_CATEGORY_IDENTIFIER + '|' + category,
        });
      }
      if (status) {
        baseParams.push({
          name: 'status',
          value: status,
        });
      }
      // The encounters behind the tasks are fetched separately rather than with `_include`.
      // Observed Oystehr behavior, not FHIR spec (which excludes included resources from both):
      // an included Encounter counts against the page's `_count` budget and against the bundle
      // `total`, so including them here would shrink the page and inflate the count pagination
      // is driven by.
      const searchTasks = async (
        extraParams: SearchParam[],
        count: number,
        offset: number
      ): Promise<TaskSearchStream> => {
        const bundle = await oystehr.fhir.search<FhirTask>({
          resourceType: 'Task',
          params: [...baseParams, ...extraParams, { name: '_count', value: count }, { name: '_offset', value: offset }],
        });
        return {
          tasks: bundle.unbundle().filter((resource): resource is FhirTask => resource.resourceType === 'Task'),
          total: bundle.total,
        };
      };

      const pageOffset = (page ?? 0) * TASKS_PAGE_SIZE;

      let fhirTasks: FhirTask[];
      let total: number;

      if (location) {
        // Tasks with no location tag (e.g. inbound faxes) are location-agnostic and must NOT be
        // hidden by the location filter. FHIR search can't express "location tag == X OR no
        // location tag" in a single query, so we run two disjoint searches — tasks tagged with
        // the selected location, and tasks with no location tag at all — and merge them.
        // To paginate the merged set correctly, fetch each stream through the end of the
        // requested page window, merge-sort, and slice out the page.
        const windowEnd = pageOffset + TASKS_PAGE_SIZE;
        const [tagged, untagged] = await Promise.all([
          searchTasks([{ name: '_tag', value: TASK_LOCATION_SYSTEM + '|' + location }], windowEnd, 0),
          searchTasks([{ name: '_tag:not', value: TASK_LOCATION_SYSTEM + '|' }], windowEnd, 0),
        ]);
        const merged = mergeLocationFilteredTasks({ tagged, untagged, pageOffset, pageSize: TASKS_PAGE_SIZE });
        fhirTasks = merged.tasks;
        total = merged.total;
      } else {
        const result = await searchTasks([], TASKS_PAGE_SIZE, pageOffset);
        fhirTasks = result.tasks;
        total = result.total ?? -1;
      }

      // can probably remove filterTasks, leaving for now because we have a handful of tasks in prod that will get pulled on in a weird way if removed
      // Filter before fetching encounters so the lookup only covers tasks that reach the page.
      const visibleTasks = fhirTasks.filter(filterTasks);
      const encountersMap = await fetchTaskEncounters(oystehr, visibleTasks);
      const transformedTasks = visibleTasks.map((task) => fhirTaskToTask(task, encountersMap));
      return {
        tasks: transformedTasks,
        total,
      };
    },
    enabled: oystehr != null,
    retry: 2,
    staleTime: 5 * 1000,
    refetchInterval: options?.refetchInterval,
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
      enqueueSnackbar('Task assigned successfully and moved to In Progress status.', { variant: 'success' });
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
      const operations: Operation[] = [
        {
          op: 'remove',
          path: '/owner',
        },
        {
          op: 'replace',
          path: '/status',
          value: 'ready',
        },
      ];

      const taskMetaTags = taskResource.meta?.tag;
      if (taskMetaTags) {
        const updatedMetaTags = taskResource.meta?.tag?.filter(
          (tag) => tag.system !== PROVIDER_NOTIFICATION_TAG_SYSTEM
        );
        operations.push({
          op: updatedMetaTags?.length ? 'replace' : 'remove',
          path: '/meta/tag',
          value: updatedMetaTags?.length ? updatedMetaTags : undefined,
        });
      }
      await oystehr.fhir.patch<FhirTask>({
        resourceType: 'Task',
        id: input.taskId,
        operations,
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
  let completable = false;
  let details: string | undefined = undefined;

  // Extract encounterId and check if it's a follow-up encounter
  const encounterId = getTaskEncounterId(task);
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
      title = `Match unsolicited test results${fullTestName ? ` for ${fullTestName}` : ''}${
        patientName ? ` for ${patientName}` : ''
      }`;
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
    const documentReferenceId = getInputString(MANUAL_TASK.input.documentReferenceId, task);
    // Follow-up tasks emitted by completed practice-managed forms carry a
    // document-reference-id; use it as a signal to route to the patient docs
    // page with the Paperwork folder preselected, rather than the default
    // manual-task behaviour.
    const patientIdFromRef = patientReference?.reference?.split('/')?.[1];
    if (category === MANUAL_TASK.category.patientFollowUp && documentReferenceId && patientIdFromRef) {
      title =
        getInputString(MANUAL_TASK.input.title, task) ||
        `Patient follow-up for ${patientReference?.display?.replaceAll(',', '') ?? ''}`;
      subtitle = `Form completed / ${task.location?.display ?? ''}`;
      details = '';
      completable = true;
      action = {
        name: GO_TO_TASK,
        link: `/patient/${patientIdFromRef}/docs?folder=Paperwork`,
      };
      return {
        id: task.id ?? '',
        category,
        createdDate: task.authoredOn ?? '',
        title,
        subtitle,
        details,
        status: task.status,
        action,
        assignee: task.owner
          ? {
              id: task.owner?.reference?.split('/')?.[1] ?? '',
              name: task.owner?.display ?? '',
              date: getExtension(task.owner, TASK_ASSIGNED_DATE_TIME_EXTENSION_URL)?.valueDateTime ?? '',
            }
          : undefined,
        completable,
      };
    }
    title =
      getInputString(MANUAL_TASK.input.title, task) +
      (patientReference ? ' for ' + patientReference.display?.replaceAll(',', '') : '');
    subtitle = `Manual task by ${providerName} / ${task.location?.display ?? ''}`;
    details = getInputString(MANUAL_TASK.input.details, task) ?? '';
    completable = true;
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
    const patientName = getInputString(RADIOLOGY_TASK.input.patientName, task);
    const code = getCoding(task.code, RADIOLOGY_TASK.system)?.code ?? '';
    const appointmentId = getInputString(RADIOLOGY_TASK.input.appointmentId, task) ?? '';
    const orderId =
      task.basedOn
        ?.find((ref) => ref.reference?.startsWith('ServiceRequest/'))
        ?.reference?.replace('ServiceRequest/', '') ?? '';
    const link = getRadiologyOrderEditUrl(appointmentId, orderId);
    action = { name: GO_TO_ORDER, link: addEncounterIdToLink(link) };

    const orderDate = getInputString(RADIOLOGY_TASK.input.orderDate, task);
    const providerName = getInputString(RADIOLOGY_TASK.input.providerName, task);
    const locationDisplay = task.location?.display ? ` | ${task.location?.display}` : '';
    subtitle = `Ordered by ${providerName} on ${orderDate ? formatDate(orderDate) : ''}${locationDisplay}`;

    const studyTypeCode = getInputString(RADIOLOGY_TASK.input.studyTypeCode, task);
    const studyTypeDisplay = getInputString(RADIOLOGY_TASK.input.studyTypeDisplay, task);
    const studyTypeForTitle = studyTypeCode || studyTypeDisplay ? `for ${studyTypeCode} - ${studyTypeDisplay}` : '';

    if (code === RADIOLOGY_TASK.code.reviewFinalResultTask) {
      title = `Review Radiology Final Results ${studyTypeForTitle} for ${patientName}`;
    }
  }
  if (category === ERX_TASK.category) {
    const providerName = getInputString(ERX_TASK.input.providerName, task);
    title = `Provider ${providerName} has notifications in DoseSpot`;
    completable = true;
    action = { name: OPEN_DOSESPOT, link: '' };
  }
  if (category === FAX_TASK.category) {
    const code = getCoding(task.code, FAX_TASK.system)?.code ?? '';
    const senderFaxNumber = getInputString(FAX_TASK.input.senderFaxNumber, task);
    const pageCount = getInputString(FAX_TASK.input.pageCount, task);
    const receivedDate = getInputString(FAX_TASK.input.receivedDate, task);
    const communicationId = getInputString(FAX_TASK.input.communicationId, task);

    if (code === FAX_TASK.code.matchInboundFax) {
      title = `Inbound fax from ${senderFaxNumber || 'unknown'} (${pageCount || '?'} pages)`;
      subtitle = `Received on ${receivedDate ? formatDate(receivedDate) : ''}`;
      if (communicationId) {
        // Once the fax is actioned (filed = completed, deleted = cancelled), the match page
        // renders read-only, so the action label flips from "Match" to "View".
        const isActioned = task.status === 'completed' || task.status === 'cancelled';
        action = {
          name: isActioned ? VIEW_FAX : 'Match',
          link: `/inbound-fax/${communicationId}/match`,
        };
      }
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
    completable: completable,
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
