import {
  TASK_FOLLOW_UP_PROGRESS_NOTE_SECTIONS,
  TASK_PROGRESS_NOTE_SECTIONS,
} from 'utils/lib/types/data/tasks/progress-note-sections';
import { describe, expect, it } from 'vitest';
import { routesInPerson } from '../../src/features/visits/in-person/routing/routesInPerson';

const NON_NOTE_GROUPS = ['Actions', 'Additional Resources'];
const REGISTRY_HINT =
  'Visit sidebar sections changed: update packages/utils/lib/types/data/tasks/progress-note-sections.ts';

const noteRoutes = Object.values(routesInPerson)
  .filter((route) => !route.isSkippedInNavigation && route.modes.includes('main'))
  .filter((route) => !NON_NOTE_GROUPS.includes(route.groupLabel ?? ''));

describe('task progress note sections', () => {
  it('list every progress note section of the visit sidebar, in sidebar order', () => {
    const sidebarSections = noteRoutes.map((route) => [route.sidebarPath || route.path, route.text]);

    expect(sidebarSections, REGISTRY_HINT).toEqual(Object.entries(TASK_PROGRESS_NOTE_SECTIONS));
  });

  it('list the sections a follow-up visit shows', () => {
    const followUpSections = noteRoutes
      .filter((route) => route.modes.includes('follow-up'))
      .map((route) => route.sidebarPath || route.path);

    expect(followUpSections, REGISTRY_HINT).toEqual(TASK_FOLLOW_UP_PROGRESS_NOTE_SECTIONS);
  });
});
