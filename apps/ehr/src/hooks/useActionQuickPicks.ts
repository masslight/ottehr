import { useMemo } from 'react';
import { RoleType } from 'utils/lib/types/api/user.types';
import { CommandPaletteItem, useCommandPaletteStore } from '../state/command-palette.store';
import { useCommandPaletteSource } from './useCommandPaletteSource';
import useEvolveUser from './useEvolveUser';

// Mirrors the /tasks route gating in App.tsx (union of both staff role blocks).
const TASK_CREATION_ROLES = [
  RoleType.Administrator,
  RoleType.Manager,
  RoleType.CustomerSupport,
  RoleType.Staff,
  RoleType.Provider,
  RoleType.Clinician,
];

/** Registers global action items (currently just "Create Task") in the command palette. */
export function useActionQuickPicks(): void {
  const currentUser = useEvolveUser();
  const setCreateTaskDialogOpen = useCommandPaletteStore((state) => state.setCreateTaskDialogOpen);

  const items = useMemo<CommandPaletteItem[]>(() => {
    if (!currentUser || !currentUser.hasRole(TASK_CREATION_ROLES)) {
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
