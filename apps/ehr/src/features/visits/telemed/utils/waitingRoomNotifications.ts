import Oystehr from '@oystehr/sdk';
import { MutateOptions } from '@tanstack/react-query';
import { Task } from 'fhir/r4b';
import { EvolveUser } from 'src/hooks/useEvolveUser';
import { OttehrTaskSystem, VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE } from 'utils';
import { AssignTaskRequest, UnassignTaskRequest } from '../../in-person/hooks/useTasks';

const getWaitingRoomTasksForAppointment = async (oystehr: Oystehr, appointmentId: string): Promise<Task[]> => {
  const tasks = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        {
          name: 'focus',
          value: `Appointment/${appointmentId}`,
        },
        {
          name: 'status:not',
          value: 'completed',
        },
        {
          name: 'intent',
          value: 'order',
        },
      ],
    })
  ).unbundle();

  const waitingRoomTasks = tasks.filter((task) => {
    const hasCorrectDescription = task.description?.endsWith('is ready to begin their virtual visit.');
    const hasCorrectCode = task.code?.coding?.some(
      (coding) => coding.code === VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE && coding.system === OttehrTaskSystem
    );
    return hasCorrectDescription && hasCorrectCode;
  });

  return waitingRoomTasks;
};

export const assignWaitingRoomTasksToProvider = async (
  oystehr: Oystehr | undefined,
  appointmentId: string | undefined,
  user: EvolveUser | undefined,
  assignTask: (
    variables: AssignTaskRequest,
    options?: MutateOptions<void, Error, AssignTaskRequest, unknown> | undefined
  ) => Promise<void>
): Promise<void> => {
  try {
    if (!oystehr || !appointmentId || !user) {
      throw new Error('oystehr client, appointment id, or user not defined');
    }
    const tasks = await getWaitingRoomTasksForAppointment(oystehr, appointmentId);
    if (tasks.length && user && user.profileResource) {
      await Promise.all(
        tasks.map((task) =>
          assignTask({
            taskId: task.id!,
            assignee: {
              id: user.profileResource!.id!,
              name: user.userName,
            },
          })
        )
      );
    }
  } catch (error) {
    console.error('Failed to assign waiting room tasks to provider', error);
    // don't throw error, notification failure shouldn't block functionality
  }
};

export const unassignWaitingRoomTasksFromProvider = async (
  oystehr: Oystehr | undefined,
  appointmentId: string | undefined,
  unassignTask: (
    variables: UnassignTaskRequest,
    options?: MutateOptions<void, Error, UnassignTaskRequest, unknown> | undefined
  ) => Promise<void>
): Promise<void> => {
  try {
    if (!oystehr || !appointmentId) {
      throw new Error('oystehr client or appointment id not defined');
    }
    const tasks = await getWaitingRoomTasksForAppointment(oystehr, appointmentId);
    if (tasks.length) {
      await Promise.all(
        tasks.map((task) =>
          unassignTask({
            taskId: task.id!,
          })
        )
      );
    }
  } catch (error) {
    console.error('Failed to unassign waiting room tasks from provider', error);
    // don't throw error, notification failure shouldn't block functionality
  }
};
