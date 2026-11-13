import {
  TASK_FOLLOW_UP_PROGRESS_NOTE_SECTIONS,
  TASK_MAIN_PROGRESS_NOTE_SECTIONS,
  TASK_PROGRESS_NOTE_SECTIONS,
} from 'utils/lib/types/data/tasks/progress-note-sections';
import { describe, expect, it } from 'vitest';
import { InteractionMode } from '../../src/features/visits/in-person/context/InPersonNavigationContext';
import { routesInPerson } from '../../src/features/visits/in-person/routing/routesInPerson';

const REGISTRY_HINT =
  "A route's taskSection and packages/utils/lib/types/data/tasks/progress-note-sections.ts must list the same sections";

const linkedRoutes = Object.values(routesInPerson).flatMap((route) =>
  route.taskSection ? [{ route, section: route.taskSection }] : []
);

const linkedSectionsIn = (mode: InteractionMode): string[] =>
  linkedRoutes.filter(({ route }) => route.modes.includes(mode)).map(({ section }) => section);

describe('task progress note sections', () => {
  it.each(linkedRoutes.map(({ route, section }) => [route.path, route, section] as const))(
    'route %s links tasks to the sidebar section it opens',
    (_path, route, section) => {
      expect(route.isSkippedInNavigation, REGISTRY_HINT).toBeFalsy();
      expect(route.sidebarPath || route.path, REGISTRY_HINT).toBe(section);
      expect(route.text, REGISTRY_HINT).toBe(TASK_PROGRESS_NOTE_SECTIONS[section]);
    }
  );

  it('lists the sections of the visit sidebar in sidebar order', () => {
    expect(linkedSectionsIn('main'), REGISTRY_HINT).toEqual(TASK_MAIN_PROGRESS_NOTE_SECTIONS);
  });

  it('lists the sections of the follow-up sidebar in sidebar order', () => {
    expect(linkedSectionsIn('follow-up'), REGISTRY_HINT).toEqual(TASK_FOLLOW_UP_PROGRESS_NOTE_SECTIONS);
  });

  it('registers only sections a route links to', () => {
    const linkedSections = linkedRoutes.map(({ section }) => section);

    expect([...linkedSections].sort(), REGISTRY_HINT).toEqual(Object.keys(TASK_PROGRESS_NOTE_SECTIONS).sort());
  });
});
