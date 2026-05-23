import { enqueueSnackbar } from 'notistack';
import { useMemo } from 'react';
import { HospitalizationOptions } from 'src/features/visits/in-person/components/hospitalization/hospitalizationOptions';
import { SURGICAL_HISTORY_OPTIONS } from 'src/features/visits/shared/components/medical-history-tab/SurgicalHistory/surgicalHistoryOptions';
import { useCommandPaletteSource } from 'src/hooks/useCommandPaletteSource';
import {
  useMergedAllergyQuickPicks,
  useMergedMedicalConditionQuickPicks,
  useMergedMedicationHistoryQuickPicks,
} from 'src/hooks/useMergedQuickPicks';
import { CommandPaletteItem } from 'src/state/command-palette.store';
import { SaveChartDataRequest } from 'utils';

// Registers practice quick-picks (allergies, conditions, meds-history) plus the static
// surgical-history / hospitalization option lists as command-palette items scoped to the
// easy-chart page. Each onSelect calls the page's saveAndMerge so the page can optimistically
// merge the response into local state and flash the new item — no full chart refetch.
export function useEasyChartQuickPicks(
  encounterId: string | undefined,
  saveAndMerge: (payload: SaveChartDataRequest) => Promise<void>
): void {
  const enabled = Boolean(encounterId);

  const { quickPicks: allergies } = useMergedAllergyQuickPicks({ enabled });
  const { quickPicks: conditions } = useMergedMedicalConditionQuickPicks({ enabled });
  const { quickPicks: medications } = useMergedMedicationHistoryQuickPicks({ enabled });

  const items = useMemo<CommandPaletteItem[]>(() => {
    if (!encounterId) return [];

    const save = async (payload: SaveChartDataRequest, label: string): Promise<void> => {
      try {
        await saveAndMerge(payload);
        enqueueSnackbar(`Added ${label}`, { variant: 'success' });
      } catch (e) {
        console.error('Easy-chart quick-pick save failed:', e);
        enqueueSnackbar(`Failed to add ${label}`, { variant: 'error' });
      }
    };

    const out: CommandPaletteItem[] = [];

    allergies.forEach((q) => {
      out.push({
        id: `easy-chart-allergy-${q.id ?? q.allergyId ?? q.name}`,
        label: q.name,
        category: 'Add Allergy',
        keywords: [q.name],
        onSelect: () => {
          void save(
            {
              encounterId,
              allergies: [
                {
                  name: q.name,
                  id: q.allergyId != null ? String(q.allergyId) : undefined,
                  current: true,
                },
              ],
            },
            q.name
          );
        },
      });
    });

    conditions.forEach((q) => {
      if (!q.code) return;
      out.push({
        id: `easy-chart-condition-${q.id ?? q.code}`,
        label: q.display,
        category: 'Add Medical Condition',
        keywords: [q.code, q.display],
        onSelect: () => {
          void save(
            {
              encounterId,
              conditions: [{ code: q.code!, display: q.display, current: true }],
            },
            q.display
          );
        },
      });
    });

    medications.forEach((q) => {
      const label = q.strength ? `${q.name} (${q.strength})` : q.name;
      out.push({
        id: `easy-chart-medication-${q.id ?? `${q.name}-${q.strength ?? ''}`}`,
        label,
        category: 'Add Medication',
        keywords: [q.name, q.strength].filter(Boolean) as string[],
        onSelect: () => {
          void save(
            {
              encounterId,
              medications: [
                {
                  name: label,
                  id: q.medicationId != null ? String(q.medicationId) : undefined,
                  type: 'scheduled',
                  status: 'active',
                  intakeInfo: {},
                },
              ],
            },
            label
          );
        },
      });
    });

    SURGICAL_HISTORY_OPTIONS.forEach((o) => {
      out.push({
        id: `easy-chart-surgical-${o.code}`,
        label: o.display,
        category: 'Add Surgical History',
        keywords: [o.code, o.display].filter(Boolean) as string[],
        onSelect: () => {
          void save(
            {
              encounterId,
              surgicalHistory: [{ code: o.code, display: o.display }],
            },
            o.display
          );
        },
      });
    });

    HospitalizationOptions.forEach((o) => {
      out.push({
        id: `easy-chart-hospitalization-${o.code}`,
        label: o.display,
        category: 'Add Hospitalization',
        keywords: [o.code, o.display].filter(Boolean) as string[],
        onSelect: () => {
          void save(
            {
              encounterId,
              episodeOfCare: [{ code: o.code, display: o.display }],
            },
            o.display
          );
        },
      });
    });

    return out;
  }, [encounterId, allergies, conditions, medications, saveAndMerge]);

  useCommandPaletteSource('easy-chart-quickpicks', items);
}
