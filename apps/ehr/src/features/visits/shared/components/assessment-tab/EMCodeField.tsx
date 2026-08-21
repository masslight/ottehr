import { Autocomplete, TextField } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { CPTCodeOption } from 'utils/lib/types/common';
import { useEMCodes } from '../../hooks/useEMCodes';
import { useChartData, useDeleteChartData, useSaveChartData } from '../../stores/appointment/appointment.store';

export interface EMCodeFieldProps {
  /**
   * Write to this encounter instead of resolving one from the appointment store — for a page keyed by
   * encounter, where the store is empty and the save would fall back to an undefined id and throw.
   */
  encounterId?: string;
  /**
   * The currently charted code, when the caller has it. This field normally reads it from the appointment
   * store's chart data; a page that does not populate the store would otherwise show an empty dropdown
   * for a visit that HAS a level set — and picking a new one would then build on `{ ...undefined }`,
   * losing the existing resourceId and charting a SECOND E&M row.
   */
  emCode?: CPTCodeDTO;
  /** Called after a save or delete lands, so a page with its own chart query can refresh it. */
  onSaved?: () => void;
  /**
   * Focus the input on mount and open the dropdown with it.
   *
   * OPT-IN, as on DiagnosesField and CptCodeField: the Assessment page renders this field permanently, so
   * autofocusing there would steal the caret whenever the page opened. It is for a field that appears in
   * response to a click, where the click IS the request to start editing.
   */
  autoFocus?: boolean;
}

export const EMCodeField: FC<EMCodeFieldProps> = ({ encounterId, emCode: emCodeOverride, onSaved, autoFocus }) => {
  const { emCodes, isLoading: emCodesLoading } = useEMCodes();
  const { chartData, setPartialChartData } = useChartData();
  const emCode = emCodeOverride ?? chartData?.emCode;
  const { mutate: saveChartData, isPending: isSaveLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();

  const onChange = (value: CPTCodeOption | null): void => {
    const prevValue = emCode ? { ...emCode } : undefined;
    if (value) {
      saveChartData(
        { encounterId, emCode: { ...emCode, ...value } },
        {
          onSuccess: (data) => {
            const saved = data.chartData?.emCode;

            if (saved) {
              setPartialChartData({ emCode: saved });
            }
            onSaved?.();
          },
          onError: () => {
            enqueueSnackbar('An error has occurred while saving E&M code. Please try again.', { variant: 'error' });
            // Rollback to previous state
            setPartialChartData({ emCode: prevValue });
          },
        }
      );
      setPartialChartData({ emCode: value }, { invalidateQueries: false });
    } else {
      // Optimistic update
      setPartialChartData({ emCode: undefined }, { invalidateQueries: false });
      deleteChartData(
        { encounterId, emCode },
        {
          onSuccess: async () => {
            // No need to update again, optimistic update already applied
            onSaved?.();
          },
          onError: () => {
            enqueueSnackbar('An error has occurred while deleting E&M code. Please try again.', { variant: 'error' });
            // Rollback to previous state
            setPartialChartData({ emCode: prevValue });
          },
        }
      );
    }
  };

  return (
    <Autocomplete
      // Paired with autoFocus: focusing without this leaves the caret in a closed field, which reads as
      // nothing having happened.
      openOnFocus={autoFocus}
      disabled={isSaveLoading || isDeleteLoading || emCodesLoading}
      options={emCodes}
      data-testid={dataTestIds.assessmentCard.emCodeDropdown}
      isOptionEqualToValue={(option, value) => option.code === value.code}
      value={emCode ? { display: emCode.display, code: emCode.code } : null}
      getOptionLabel={(option) => option.display}
      onChange={(_e, value) => onChange(value)}
      renderInput={(params) => (
        <TextField {...params} autoFocus={autoFocus} size="small" label="E&M code" placeholder="Search E&M code" />
      )}
    />
  );
};
