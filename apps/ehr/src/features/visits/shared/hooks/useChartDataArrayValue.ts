import { enqueueSnackbar } from 'notistack';
import { filterActiveMedications } from 'utils/lib/helpers/medications/current-medications.helper';
import { MedicationDTO, SaveableDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { HistorySectionData } from 'utils/lib/types/api/chart-data/chart-sections.types';
import { useDeleteChartData, useSaveChartData } from '../stores/appointment/appointment.store';
import { useChartSection } from './useChartSection';

type ChartDataArrayValueType = Pick<
  HistorySectionData,
  'episodeOfCare' | 'allergies' | 'medications' | 'conditions' | 'surgicalHistory'
>;

type ElementType<T extends ReadonlyArray<unknown>> = T extends ReadonlyArray<infer ElementType> ? ElementType : never;

const mapValueToLabel: Record<keyof ChartDataArrayValueType, string> = {
  episodeOfCare: 'known hospitalizations',
  allergies: 'known allergies',
  medications: 'current medications',
  conditions: 'medical conditions',
  surgicalHistory: 'surgical history',
};

/** What the screens list: for medications, the active current ones (prescriptions are listed elsewhere). */
const shownValues = <T extends keyof ChartDataArrayValueType>(
  name: T,
  history: HistorySectionData | undefined
): ChartDataArrayValueType[T] => {
  const list = history?.[name] ?? [];
  if (name === 'medications') {
    const current = (list as MedicationDTO[]).filter((medication) => medication.type !== 'prescribed-medication');
    return filterActiveMedications(current) as ChartDataArrayValueType[T];
  }
  return list as ChartDataArrayValueType[T];
};

/**
 * One of the patient-level history lists, with add and remove. The list is the history section's; the
 * section's cache entry is patched with what the server returned, so every reader of the list, this
 * screen's and the visit note's alike, sees the change without another request.
 */
export const useChartDataArrayValue = <
  T extends keyof ChartDataArrayValueType,
  K extends NonNullable<ChartDataArrayValueType[T]>,
>(
  name: T,
  reset?: () => void,
  onRemoveCallback?: () => any
): {
  isLoading: boolean;
  onSubmit: (data: ElementType<K>) => Promise<boolean>;
  onRemove: (resourceId: string) => Promise<void>;
  values: K;
} => {
  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();
  const { isLoading: isChartDataLoading, data: history, setSectionData } = useChartSection('history');

  const values = shownValues(name, history) as K;

  const onSubmit = (data: ElementType<K>): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      saveChartData(
        {
          [name]: [data],
        },
        {
          onSuccess: (response) => {
            const saved = (response.chartData[name] ?? []) as unknown as SaveableDTO[];
            setSectionData(
              (previous) =>
                ({
                  // Items without a resourceId are a caller's optimistic placeholders; the saved items take their place.
                  [name]: [
                    ...(previous[name] as unknown as SaveableDTO[]).filter((item) => item.resourceId !== undefined),
                    ...saved,
                  ],
                }) as Partial<HistorySectionData>
            );
            resolve(true);
          },
          onError: (error) => {
            enqueueSnackbar(`An error has occurred while adding ${mapValueToLabel[name]}. Please try again.`, {
              variant: 'error',
            });
            reject(error);
          },
        }
      );
      if (reset) {
        reset();
      }
    });
  };

  const onRemove = async (resourceId: string): Promise<void> => {
    const toDelete = (values as unknown as SaveableDTO[]).filter((value) => value.resourceId === resourceId);
    return deleteChartData(
      {
        [name]: toDelete,
      },
      {
        onSuccess: () => {
          setSectionData(
            (previous) =>
              ({
                [name]: (previous[name] as unknown as SaveableDTO[]).filter((value) => value.resourceId !== resourceId),
              }) as Partial<HistorySectionData>
          );
          onRemoveCallback?.();
        },
        onError: () => {
          enqueueSnackbar(`An error has occurred while deleting ${mapValueToLabel[name]}. Please try again.`, {
            variant: 'error',
          });
        },
      }
    );
  };

  return { isLoading: isSaveLoading || isDeleteLoading || isChartDataLoading, onSubmit, onRemove, values };
};
