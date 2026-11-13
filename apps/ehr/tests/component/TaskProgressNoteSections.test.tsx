import { TASK_PROGRESS_NOTE_SECTIONS } from 'utils/lib/types/data/tasks/progress-note-sections';
import { describe, expect, it } from 'vitest';
import { routesInPerson } from '../../src/features/visits/in-person/routing/routesInPerson';

const NON_NOTE_GROUPS = ['Actions', 'Additional Resources'];

describe('task progress note sections', () => {
  it('list every progress note section of the visit sidebar, in sidebar order', () => {
    const sidebarSections = Object.values(routesInPerson)
      .filter((route) => !route.isSkippedInNavigation && route.modes.includes('main'))
      .filter((route) => !NON_NOTE_GROUPS.includes(route.groupLabel ?? ''))
      .map((route) => [route.sidebarPath || route.path, route.text]);

    expect(
      sidebarSections,
      'Visit sidebar sections changed: update TASK_PROGRESS_NOTE_SECTIONS in packages/utils/lib/types/data/tasks/progress-note-sections.ts'
    ).toEqual(Object.entries(TASK_PROGRESS_NOTE_SECTIONS));
  });
});
