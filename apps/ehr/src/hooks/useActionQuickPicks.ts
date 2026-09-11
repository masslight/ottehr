import { useMemo } from 'react';
import { CommandPaletteItem, useCommandPaletteStore } from '../state/command-palette.store';
import { useCommandPaletteSource } from './useCommandPaletteSource';
import useEvolveUser from './useEvolveUser';
import { PRIMARY_EHR_STAFF_ROLES } from './useNavigationQuickPicks';

/** Registers global action items (currently just "Create Task") in the command palette. */
export function useActionQuickPicks(): void {
  const currentUser = useEvolveUser();
  const setCreateTaskDialogOpen = useCommandPaletteStore((state) => state.setCreateTaskDialogOpen);

  const items = useMemo<CommandPaletteItem[]>(() => {
    if (!currentUser || !currentUser.hasRole(PRIMARY_EHR_STAFF_ROLES)) {
      return [];
    }

    return [
      {
        id: 'action-create-task',
        label: 'Create Task',
        category: 'Actions',
        keywords: ['task', 'new task', 'create task', 'todo', 'assign'],
        onSelect: () => setCreateTaskDialogOpen(true),
      },
    ];
  }, [currentUser, setCreateTaskDialogOpen]);

  useCommandPaletteSource('actions', items);
}
