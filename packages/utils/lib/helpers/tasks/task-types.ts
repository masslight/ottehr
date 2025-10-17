import { LAB_ORDER_TASK, TaskIndicator } from '../../types';

export interface TaskTypeOption {
  value: string;
  label: string;
  system: string;
  code: string;
}

/**
 * Gets all available task types from the system for use in UI components like TaskAdmin.
 * This function aggregates task types from:
 * - TaskIndicator (appointment-related tasks)
 * - LAB_ORDER_TASK (external lab tasks)
 * - IN_HOUSE_LAB_TASK (in-house lab tasks)
 *
 * @returns Array of task type options with value, label, system, and code properties
 */
export function getAllTaskTypes(): TaskTypeOption[] {
  const taskTypes: TaskTypeOption[] = [{ value: 'all', label: 'All Task Types', system: '', code: '' }];

  // TaskIndicator - specific appointment-related tasks with codes
  Object.entries(TaskIndicator).forEach(([key, taskCoding]) => {
    const label = formatTaskLabel(key);
    taskTypes.push({
      value: key,
      label,
      system: taskCoding.system,
      code: taskCoding.code,
    });
  });

  // LAB_ORDER_TASK - external lab tasks
  Object.entries(LAB_ORDER_TASK.code).forEach(([key, code]) => {
    const label = formatTaskLabel(key);
    taskTypes.push({
      value: `lab-order-${key}`,
      label: `Lab Order: ${label}`,
      system: LAB_ORDER_TASK.system,
      code: code,
    });
  });

  return taskTypes;
}

/**
 * Formats a camelCase or dash-separated task key into a human-readable label
 * @param key - The task key to format
 * @returns Formatted label string
 */
function formatTaskLabel(key: string): string {
  return (
    key
      // Insert space before capital letters
      .replace(/([A-Z])/g, ' $1')
      // Replace dashes with spaces
      .replace(/-/g, ' ')
      // Capitalize first letter of each word
      .replace(/\b\w/g, (char) => char.toUpperCase())
      // Trim any extra spaces
      .trim()
  );
}
