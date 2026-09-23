import { Box, CircularProgress, Stack } from '@mui/material';
import { FC, useEffect, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { AccordionCard } from 'src/components/AccordionCard';
import { CheckboxInput } from 'src/components/input/CheckboxInput';
import { DateInput } from 'src/components/input/DateInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { AllStates } from 'utils/lib/types/common';
import { useChartFields } from './shared/hooks/useChartFields';
import { useDeleteChartData, useSaveChartData } from './shared/stores/appointment/appointment.store';

interface Props {
  readOnly: boolean;
}

// Typing a date passes through a complete value per keystroke, so writing on every change would send
// a request per character.
const WRITE_DEBOUNCE_MS = 500;

type Write = (done: () => void) => void;

/**
 * Debounces the writes, keeps only the newest, and runs one at a time: each write sends the whole
 * accident, so an older one landing last would put a stale copy of the card on the chart.
 */
const createWriteScheduler = (
  delayMs: number
): {
  schedule: (write: Write) => void;
  flush: () => void;
  isBusy: () => boolean;
} => {
  let pending: Write | null = null;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const run = (): void => {
    if (inFlight || pending == null) return;
    const write = pending;
    pending = null;
    inFlight = true;
    write(() => {
      inFlight = false;
      run();
    });
  };

  return {
    schedule: (write: Write): void => {
      pending = write;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        run();
      }, delayMs);
    },
    flush: (): void => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      run();
    },
    isBusy: (): boolean => timer != null || pending != null || inFlight,
  };
};

interface FormData {
  autoAccident: boolean;
  employmentAccident: boolean;
  otherAccident: boolean;
  date?: string;
  state?: string;
}

export const AccidentField: FC<Props> = ({ readOnly }) => {
  const {
    data: chartDataFields,
    setQueryCache,
    isLoading: isChartDataLoading,
  } = useChartFields({
    requestedFields: {
      accident: {
        _tag: 'accident',
      },
    },
  });
  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();

  const methods = useForm<FormData>({
    defaultValues: {
      autoAccident: false,
      employmentAccident: false,
      otherAccident: false,
    },
  });

  const [writes] = useState(() => createWriteScheduler(WRITE_DEBOUNCE_MS));
  const writtenSnapshotRef = useRef<string | null>(null);

  // Leaving the tab mid-debounce must not drop the edit.
  useEffect(() => () => writes.flush(), [writes]);

  useEffect(() => {
    // A write of ours is still on its way, so the response to an earlier edit would land back in the
    // field being typed in.
    if (writes.isBusy()) {
      return;
    }
    methods.reset({
      autoAccident: chartDataFields?.accident?.type?.includes('AA') ?? false,
      employmentAccident: chartDataFields?.accident?.type?.includes('EM') ?? false,
      otherAccident: chartDataFields?.accident?.type?.includes('OA') ?? false,
      date: chartDataFields?.accident?.date,
      state: chartDataFields?.accident?.state,
    });
    const isAutoAccident = chartDataFields?.accident?.type?.includes('AA') ?? false;
    const hasAccidentType = (chartDataFields?.accident?.type?.length ?? 0) > 0;
    if (hasAccidentType && !chartDataFields?.accident?.date) {
      methods.setError('date', { message: 'Date is required' });
    }
    if (isAutoAccident && !chartDataFields?.accident?.state) {
      methods.setError('state', { message: 'State is required for Auto Accident' });
    }
  }, [chartDataFields, methods, writes]);

  useEffect(() => {
    const callback = methods.subscribe({
      formState: {
        values: true,
        dirtyFields: true,
      },
      callback: ({ values, dirtyFields }) => {
        const types: string[] = [];
        if (values.autoAccident) {
          types.push('AA');
        }
        if (values.employmentAccident) {
          types.push('EM');
        }
        if (values.otherAccident) {
          types.push('OA');
        }
        if (types.length === 0) {
          if (chartDataFields?.accident != null) {
            writtenSnapshotRef.current = null;
            writes.schedule((done) =>
              deleteChartData(
                {
                  accident: chartDataFields?.accident,
                },
                {
                  onSuccess: () => setQueryCache({ accident: undefined }),
                  onSettled: done,
                }
              )
            );
          }
          return;
        }

        // Surface inline validation, but still persist the data below so that missing
        // required fields are detected and shown in the progress note's missing items.
        if (types.length > 0 && !values.date) {
          methods.setError('date', {
            message: 'Date is required',
          });
        } else {
          methods.clearErrors('date');
        }

        if (values.autoAccident && !values.state) {
          methods.setError('state', {
            message: 'State is required for Auto Accident',
          });
        } else {
          methods.clearErrors('state');
        }

        // A half-typed date reads as empty until every section is filled in, so writing it would clear
        // the date on the chart. An untouched empty date is still written, for the missing items list.
        if (!values.date && dirtyFields?.date) {
          return;
        }

        const snapshot = JSON.stringify({ types, date: values.date, state: values.state });
        if (snapshot === writtenSnapshotRef.current) {
          return;
        }
        writtenSnapshotRef.current = snapshot;

        writes.schedule((done) =>
          saveChartData(
            {
              accident: {
                resourceId: chartDataFields?.accident?.resourceId,
                type: types,
                date: values.date,
                state: values.state,
              },
            },
            {
              // Writing an accident the save did not echo back would drop its resource id.
              onSuccess: (data) => {
                if (data.chartData.accident) {
                  setQueryCache({ accident: data.chartData.accident });
                }
              },
              onSettled: done,
            }
          )
        );
      },
    });
    return () => callback();
  }, [methods, chartDataFields, deleteChartData, saveChartData, setQueryCache, writes]);

  const disabled = isChartDataLoading || readOnly;

  return (
    <AccordionCard label="Patient's condition related to">
      <FormProvider {...methods}>
        <Stack spacing={2} padding={2}>
          <Stack spacing={2} direction="row" justifyContent="flex-start">
            <CheckboxInput name="autoAccident" label="Auto Accident" disabled={disabled} />
            <CheckboxInput name="employmentAccident" label="Employment" disabled={disabled} />
            <CheckboxInput name="otherAccident" label="Other Accident" disabled={disabled} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '80px' }}>
              {isSaveLoading || isDeleteLoading ? <CircularProgress size="20px" /> : null}
            </Box>
          </Stack>
          <Stack spacing={2} direction="row">
            <DateInput name="date" label="Date of accident" disabled={disabled} />
            <SelectInput
              name="state"
              label="State"
              options={AllStates.map((state) => state.value)}
              disabled={disabled}
            />
          </Stack>
        </Stack>
      </FormProvider>
    </AccordionCard>
  );
};
