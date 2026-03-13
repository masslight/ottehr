import { useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ExamType, MEDICAL_HISTORY_CONFIG, PROCEDURES_CONFIG } from 'utils';
import { useListTemplates } from '../features/visits/shared/components/templates/useListTemplates';
import { CommandPaletteItem, useCommandPaletteStore } from '../state/command-palette.store';
import { useCommandPaletteSource } from './useCommandPaletteSource';

/**
 * Registers all quick picks globally in the command palette so they're available
 * from any page within an in-person visit. When a quick pick is selected and the user
 * is not on the target page, it navigates there and stores a pending quick pick
 * that the target page picks up on mount.
 *
 * When the user IS already on the target page, the local page handler (registered
 * via the page's own useCommandPaletteSource) will also be present; the global
 * item's onSelect simply navigates+defers which is harmless when already there.
 *
 * Items from local sources use IDs like "allergy-Amoxicillin" while global items
 * use "global-allergy-Amoxicillin", so they don't collide. The local items take
 * priority in the UI because they appear in their own source and execute directly.
 * To avoid showing duplicates, the global source skips categories whose pages
 * the user is currently on (checked by path, not by store state).
 */
export function useGlobalQuickPicks(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const setPendingQuickPick = useCommandPaletteStore((s) => s.setPendingQuickPick);

  // Extract the in-person base path (e.g., "/in-person/abc123")
  const inPersonBase = useMemo(() => {
    const match = location.pathname.match(/^(\/in-person\/[^/]+)/);
    return match?.[1] ?? null;
  }, [location.pathname]);

  const currentSubPath = useMemo(() => {
    if (!inPersonBase) return null;
    return location.pathname.slice(inPersonBase.length + 1); // e.g. "allergies", "procedures/new"
  }, [inPersonBase, location.pathname]);

  // Use a ref for navigate to avoid re-creating all callbacks on location changes
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const inPersonBaseRef = useRef(inPersonBase);
  inPersonBaseRef.current = inPersonBase;

  const navigateAndDefer = useCallback(
    (targetPath: string, category: string, itemId: string, payload: unknown) => {
      setPendingQuickPick({ category, itemId, payload });
      if (inPersonBaseRef.current) {
        navigateRef.current(`${inPersonBaseRef.current}/${targetPath}`);
      }
    },
    [setPendingQuickPick]
  );

  // Map of target sub-paths to whether the user is currently on that page.
  // When on the page, the local source handles it — skip global items for that category.
  const isOnAllergies = currentSubPath === 'allergies';
  const isOnMedicalConditions = currentSubPath === 'medical-conditions';
  const isOnMedications = currentSubPath === 'medications';
  const isOnProceduresNew = currentSubPath === 'procedures/new';
  const isOnInHouseOrderNew = currentSubPath === 'in-house-medication/order/new';
  const isOnHPI = currentSubPath === 'history-of-present-illness-and-templates';

  // Load templates globally so they appear when typing "HPI" or "template" from any page.
  // Stabilize the array reference to avoid infinite re-render loops — useListTemplates
  // returns a new array on every render, which would retrigger the useMemo below.
  const { templates: rawTemplates } = useListTemplates(ExamType.IN_PERSON);
  const templatesKey = rawTemplates.map((t) => t.value).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const templates = useMemo(() => rawTemplates, [templatesKey]);

  const globalItems = useMemo((): CommandPaletteItem[] => {
    if (!inPersonBase) return [];

    const items: CommandPaletteItem[] = [];

    // Allergies
    if (!isOnAllergies) {
      for (const qp of MEDICAL_HISTORY_CONFIG.allergies.quickPicks) {
        items.push({
          id: `global-allergy-${qp.name}`,
          label: qp.name,
          category: 'Add Allergy',
          onSelect: () => navigateAndDefer('allergies', 'allergies', qp.name, qp),
        });
      }
    }

    // Medical Conditions
    if (!isOnMedicalConditions) {
      for (const qp of MEDICAL_HISTORY_CONFIG.medicalConditions.quickPicks) {
        items.push({
          id: `global-condition-${qp.display}`,
          label: qp.display,
          category: 'Add Medical Condition',
          onSelect: () => navigateAndDefer('medical-conditions', 'medical-conditions', qp.display, qp),
        });
      }
    }

    // Medications (current/prescribed)
    if (!isOnMedications) {
      for (const qp of MEDICAL_HISTORY_CONFIG.medications.quickPicks) {
        const label = qp.strength ? `${qp.name} ${qp.strength}` : qp.name;
        items.push({
          id: `global-medication-${qp.name}-${qp.strength ?? ''}`,
          label,
          category: 'Add Medication',
          onSelect: () => navigateAndDefer('medications', 'medications', `${qp.name}-${qp.strength ?? ''}`, qp),
        });
      }
    }

    // Procedures
    if (!isOnProceduresNew) {
      for (const qp of PROCEDURES_CONFIG.quickPicks) {
        items.push({
          id: `global-procedure-${qp.name}`,
          label: qp.name,
          category: 'Add Procedure',
          onSelect: () => navigateAndDefer('procedures/new', 'procedures', qp.name, qp),
        });
      }
    }

    // In-House Medications
    if (!isOnInHouseOrderNew) {
      const filtered = MEDICAL_HISTORY_CONFIG.inHouseMedications.quickPicks.filter(
        (qp) => qp.dosespotId != null || qp.ndc != null
      );
      for (const qp of filtered) {
        items.push({
          id: `global-in-house-med-${qp.name}`,
          label: qp.name,
          category: 'Add In-House Medication',
          onSelect: () => navigateAndDefer('in-house-medication/order/new', 'in-house-medications', qp.name, qp),
        });
      }
    }

    // Templates (API-driven, skip when on HPI page since ApplyTemplate registers them locally)
    if (!isOnHPI) {
      for (const t of templates) {
        items.push({
          id: `global-template-${t.value}`,
          label: t.label,
          category: 'Add Template',
          onSelect: () => navigateAndDefer('history-of-present-illness-and-templates', 'templates', t.value, t),
        });
      }
    }

    return items;
  }, [
    inPersonBase,
    isOnHPI,
    isOnAllergies,
    isOnMedicalConditions,
    isOnMedications,
    isOnProceduresNew,
    isOnInHouseOrderNew,
    navigateAndDefer,
    templates,
  ]);

  useCommandPaletteSource('global-quick-picks', globalItems);
}
