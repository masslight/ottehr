import {
  TASK_FOLLOW_UP_PROGRESS_NOTE_SECTIONS,
  TASK_MAIN_PROGRESS_NOTE_SECTIONS,
  TASK_PROGRESS_NOTE_SECTIONS,
  TaskProgressNoteSection,
} from 'utils/lib/types/data/tasks/progress-note-sections';
import { describe, expect, it } from 'vitest';
import { InteractionMode } from '../../src/features/visits/in-person/context/InPersonNavigationContext';
import { routesInPerson } from '../../src/features/visits/in-person/routing/routesInPerson';

const NON_NOTE_GROUPS = ['Actions', 'Additional Resources'];
const REGISTRY_HINT =
  'Visit sidebar sections changed: update packages/utils/lib/types/data/tasks/progress-note-sections.ts';

const sidebarSections = (mode: InteractionMode): string[][] =>
  Object.values(routesInPerson)
    .filter((route) => !route.isSkippedInNavigation && route.modes.includes(mode))
    .filter((route) => !NON_NOTE_GROUPS.includes(route.groupLabel ?? ''))
    .map((route) => [route.sidebarPath || route.path, route.text]);

const withLabels = (sections: TaskProgressNoteSection[]): string[][] =>
  sections.map((section) => [section, TASK_PROGRESS_NOTE_SECTIONS[section]]);

describe('task progress note sections', () => {
  it('list every progress note section of the visit sidebar, in sidebar order', () => {
    expect(sidebarSections('main'), REGISTRY_HINT).toEqual(withLabels(TASK_MAIN_PROGRESS_NOTE_SECTIONS));
  });

  it('list every progress note section of the follow-up sidebar, in sidebar order', () => {
    expect(sidebarSections('follow-up'), REGISTRY_HINT).toEqual(withLabels(TASK_FOLLOW_UP_PROGRESS_NOTE_SECTIONS));
  });

  it('label only sections one of the sidebars shows', () => {
    const listed = new Set([...TASK_MAIN_PROGRESS_NOTE_SECTIONS, ...TASK_FOLLOW_UP_PROGRESS_NOTE_SECTIONS]);

    expect([...listed].sort(), REGISTRY_HINT).toEqual(Object.keys(TASK_PROGRESS_NOTE_SECTIONS).sort());
  });
});
