import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAdmitterPractitionerId, getAttendingPractitionerId } from 'utils';
import { useListTemplates } from '../features/visits/shared/components/templates/useListTemplates';
import { useGetAppointmentAccessibility } from '../features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from '../features/visits/shared/stores/appointment/appointment.store';
import { CommandPaletteItem, useCommandPaletteStore } from '../state/command-palette.store';
import { useCommandPaletteSource } from './useCommandPaletteSource';
import {
  useMergedAllergyQuickPicks,
  useMergedImmunizationQuickPicks,
  useMergedInHouseMedicationQuickPicks,
  useMergedMedicalConditionQuickPicks,
  useMergedMedicationHistoryQuickPicks,
  useMergedProcedureQuickPicks,
  useMergedRadiologyQuickPicks,
} from './useMergedQuickPicks';

export function useGlobalQuickPicks(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const { encounter } = useAppointmentData();
  const { visitType, isAppointmentReadOnly } = useGetAppointmentAccessibility();
  const setPendingQuickPick = useCommandPaletteStore((state) => state.setPendingQuickPick);

  const inPersonBasePath = useMemo(() => {
    const match = location.pathname.match(/^(\/in-person\/[^/]+)/);
    return match?.[1] ?? null;
  }, [location.pathname]);

  const isInPersonVisit = Boolean(inPersonBasePath);
  const assignedIntakePerformerId = encounter ? getAdmitterPractitionerId(encounter) : undefined;
  const assignedProviderId = encounter ? getAttendingPractitionerId(encounter) : undefined;
  const isChartingAvailable = Boolean(
    isInPersonVisit &&
    (visitType === 'follow-up' || assignedIntakePerformerId) &&
    assignedProviderId &&
    !isAppointmentReadOnly
  );
  const { quickPicks: allergyQuickPicks } = useMergedAllergyQuickPicks({
    enabled: isChartingAvailable,
  });
  const { quickPicks: conditionQuickPicks } = useMergedMedicalConditionQuickPicks({
    enabled: isChartingAvailable,
  });
  const { quickPicks: medicationQuickPicks } = useMergedMedicationHistoryQuickPicks({
    enabled: isChartingAvailable,
  });
  const { quickPicks: inHouseMedicationQuickPicks } = useMergedInHouseMedicationQuickPicks({
    enabled: isChartingAvailable,
  });
  const { quickPicks: procedureQuickPicks } = useMergedProcedureQuickPicks({
    enabled: isChartingAvailable,
  });
  const { quickPicks: immunizationQuickPicks } = useMergedImmunizationQuickPicks({
    enabled: isChartingAvailable,
  });
  const { quickPicks: radiologyQuickPicks } = useMergedRadiologyQuickPicks({
    enabled: isChartingAvailable,
  });

  const currentSubPath = useMemo(() => {
    if (!inPersonBasePath) {
      return null;
    }

    return location.pathname.slice(inPersonBasePath.length + 1);
  }, [inPersonBasePath, location.pathname]);

  const { templates } = useListTemplates({ enabled: isChartingAvailable });

  const navigateAndDefer = useCallback(
    (targetPath: string, pendingCategory: string, itemId: string, payload: unknown) => {
      if (!inPersonBasePath) {
        return;
      }

      setPendingQuickPick({
        category: pendingCategory,
        itemId,
        payload,
      });
      navigate(`${inPersonBasePath}/${targetPath}`);
    },
    [inPersonBasePath, navigate, setPendingQuickPick]
  );

  const isOnAllergiesPage = currentSubPath === 'allergies';
  const isOnMedicalConditionsPage = currentSubPath === 'medical-conditions';
  const isOnMedicationsPage = currentSubPath === 'medications';
  const isOnProceduresPage = currentSubPath === 'procedures/new';
  const isOnInHouseMedicationPage = currentSubPath === 'in-house-medication/order/new';
  const isOnImmunizationsPage = currentSubPath === 'immunization/order';
  const isOnRadiologyPage = currentSubPath === 'radiology/create';
  const isOnTemplatesPage = currentSubPath === 'history-of-present-illness-and-templates';

  const items = useMemo<CommandPaletteItem[]>(() => {
    if (!inPersonBasePath || !isChartingAvailable) {
      return [];
    }

    const commandPaletteItems: CommandPaletteItem[] = [];

    if (!isOnAllergiesPage) {
      allergyQuickPicks.forEach((quickPick) => {
        commandPaletteItems.push({
          id: `global-allergy-${quickPick.id ?? quickPick.name}`,
          label: quickPick.name,
          category: 'Add Allergy',
          onSelect: () => navigateAndDefer('allergies', 'allergies', quickPick.id ?? quickPick.name, quickPick),
        });
      });
    }

    if (!isOnMedicalConditionsPage) {
      conditionQuickPicks.forEach((quickPick) => {
        commandPaletteItems.push({
          id: `global-condition-${quickPick.id ?? quickPick.code ?? quickPick.display}`,
          label: `${quickPick.code ? `${quickPick.code} ` : ''}${quickPick.display}`,
          category: 'Add Medical Condition',
          keywords: quickPick.code ? [quickPick.code] : undefined,
          onSelect: () =>
            navigateAndDefer(
              'medical-conditions',
              'medical-conditions',
              quickPick.id ?? quickPick.code ?? quickPick.display,
              quickPick
            ),
        });
      });
    }

    if (!isOnMedicationsPage) {
      medicationQuickPicks.forEach((quickPick) => {
        commandPaletteItems.push({
          id: `global-medication-${quickPick.id ?? `${quickPick.name}-${quickPick.strength ?? ''}`}`,
          label: `${quickPick.name}${quickPick.strength ? ` (${quickPick.strength})` : ''}`,
          category: 'Add Medication',
          keywords: [quickPick.name, quickPick.strength].filter(Boolean) as string[],
          onSelect: () =>
            navigateAndDefer(
              'medications',
              'medications',
              quickPick.id ?? `${quickPick.name}-${quickPick.strength ?? ''}`,
              quickPick
            ),
        });
      });
    }

    if (!isOnInHouseMedicationPage) {
      inHouseMedicationQuickPicks.forEach((quickPick) => {
        commandPaletteItems.push({
          id: `global-in-house-medication-${quickPick.id ?? quickPick.name}`,
          label: `${quickPick.name} (In-house)`,
          category: 'Add Medication',
          keywords: [quickPick.name, 'in-house', quickPick.ndc].filter(Boolean) as string[],
          onSelect: () =>
            navigateAndDefer(
              'in-house-medication/order/new',
              'in-house-medications',
              quickPick.id ?? quickPick.name,
              quickPick
            ),
        });
      });
    }

    if (!isOnProceduresPage) {
      procedureQuickPicks.forEach((quickPick) => {
        commandPaletteItems.push({
          id: `global-procedure-${quickPick.id ?? quickPick.name}`,
          label: quickPick.name,
          category: 'Add Procedure',
          keywords: [quickPick.procedureType].filter(Boolean) as string[],
          onSelect: () => navigateAndDefer('procedures/new', 'procedures', quickPick.id ?? quickPick.name, quickPick),
        });
      });
    }

    if (!isOnImmunizationsPage) {
      immunizationQuickPicks.forEach((quickPick) => {
        const details = quickPick.dose && quickPick.units ? `${quickPick.dose} ${quickPick.units}` : undefined;
        commandPaletteItems.push({
          id: `global-immunization-${quickPick.id ?? quickPick.name}`,
          label: [quickPick.name, details].filter(Boolean).join(', '),
          category: 'Add Immunization',
          keywords: [quickPick.name, quickPick.cvx, quickPick.ndc].filter(Boolean) as string[],
          onSelect: () =>
            navigateAndDefer('immunization/order', 'immunizations', quickPick.id ?? quickPick.name, quickPick),
        });
      });
    }

    if (!isOnRadiologyPage) {
      radiologyQuickPicks.forEach((quickPick) => {
        commandPaletteItems.push({
          id: `global-radiology-${quickPick.id ?? quickPick.name}`,
          label: quickPick.name,
          category: 'Order Radiology',
          keywords: [quickPick.cptCode, quickPick.cptDisplay, quickPick.studyName].filter(Boolean) as string[],
          onSelect: () => navigateAndDefer('radiology/create', 'radiology', quickPick.id ?? quickPick.name, quickPick),
        });
      });
    }

    if (!isOnTemplatesPage) {
      templates.forEach((template) => {
        commandPaletteItems.push({
          id: `global-template-${template.id}`,
          label: template.label,
          category: 'Apply Template',
          keywords: [template.value],
          onSelect: () =>
            navigateAndDefer('history-of-present-illness-and-templates', 'templates', template.id, template),
        });
      });
    }

    return commandPaletteItems;
  }, [
    allergyQuickPicks,
    conditionQuickPicks,
    inHouseMedicationQuickPicks,
    inPersonBasePath,
    immunizationQuickPicks,
    isChartingAvailable,
    isOnAllergiesPage,
    isOnImmunizationsPage,
    isOnInHouseMedicationPage,
    isOnMedicalConditionsPage,
    isOnMedicationsPage,
    isOnProceduresPage,
    isOnRadiologyPage,
    isOnTemplatesPage,
    medicationQuickPicks,
    navigateAndDefer,
    procedureQuickPicks,
    radiologyQuickPicks,
    templates,
  ]);

  useCommandPaletteSource('global-quick-picks', items);
}
