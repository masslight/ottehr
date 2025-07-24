import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { TooltipWrapper } from 'src/components/WithTooltip';
import { CPT_TOOLTIP_PROPS } from 'src/components/WithTooltip';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { ActionsList, DeleteIconButton } from '../../../../components';
import { useDebounce, useGetAppointmentAccessibility } from '../../../../hooks';
import { useAppointmentStore, useDeleteChartData, useGetIcd10Search, useSaveChartData } from '../../../../state';
import { AssessmentTitle } from './AssessmentTitle';
import { CPTCodeOption, emCodeOptions } from './EMCodeField';

export const BillingCodesContainer: FC = () => {
  const { chartData, setPartialChartData } = getSelectors(useAppointmentStore, ['chartData', 'setPartialChartData']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const cptCodes = chartData?.cptCodes || [];
  const emCode = chartData?.emCode;

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useGetIcd10Search({ search: debouncedSearchTerm, sabs: 'CPT' });
  const cptSearchOptions = data?.codes || [];

  const { mutate: saveEMChartData, isLoading: isSaveEMLoading } = useSaveChartData();
  const { mutate: saveCPTChartData, isLoading: isSaveCPTLoading } = useSaveChartData();
  const { mutate: deleteEMChartData, isLoading: isDeleteEMLoading } = useDeleteChartData();
  const { mutate: deleteCPTChartData, isLoading: isDeleteCPTLoading } = useDeleteChartData();

  const disabledEM = isSaveEMLoading || isDeleteEMLoading || (emCode && !emCode.resourceId);
  const disabledCPT = isSaveCPTLoading || isDeleteCPTLoading;

  const { debounce } = useDebounce(800);

  const debouncedHandleInputChange = (data: string): void => {
    debounce(() => {
      setDebouncedSearchTerm(data);
    });
  };

  const onInternalChange = (_e: unknown, data: CPTCodeOption | null): void => {
    if (data) {
      onAdd(data);
    }
  };

  const onAdd = (value: CPTCodeOption): void => {
    saveCPTChartData(
      {
        cptCodes: [value],
      },
      {
        onSuccess: (data) => {
          const cptCode = data.chartData?.cptCodes?.[0];
          if (cptCode) {
            setPartialChartData({
              cptCodes: [...cptCodes, cptCode],
            });
          }
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while adding CPT code. Please try again.', { variant: 'error' });
          setPartialChartData({
            cptCodes: cptCodes,
          });
        },
      }
    );
    setPartialChartData({ cptCodes: [...cptCodes, value] });
  };

  const onDelete = (resourceId: string): void => {
    let localCodes = cptCodes;
    const preparedValue = localCodes.find((item) => item.resourceId === resourceId)!;

    deleteCPTChartData(
      {
        cptCodes: [preparedValue],
      },
      {
        onSuccess: () => {
          localCodes = localCodes.filter((item) => item.resourceId !== resourceId);
          setPartialChartData({ cptCodes: localCodes });
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while deleting CPT code. Please try again.', { variant: 'error' });
        },
      }
    );
  };

  const onEMCodeChange = (value: CPTCodeOption | null): void => {
    if (value) {
      const prevValue = emCode;

      saveEMChartData(
        { emCode: { ...emCode, ...value } },
        {
          onSuccess: (data) => {
            const saved = data.chartData?.emCode;
            console.log(data);

            if (saved) {
              setPartialChartData({ emCode: saved });
            }
          },
          onError: () => {
            enqueueSnackbar('An error has occurred while saving E&M code. Please try again.', { variant: 'error' });
            setPartialChartData({ emCode: prevValue });
          },
        }
      );
      setPartialChartData({ emCode: value });
    } else {
      deleteEMChartData({ emCode });
      setPartialChartData({ emCode: undefined });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ color: '#0F347C' }}>
          <TooltipWrapper tooltipProps={CPT_TOOLTIP_PROPS}>
            <AssessmentTitle>Billing</AssessmentTitle>
          </TooltipWrapper>
        </Box>
        <Autocomplete
          options={emCodeOptions}
          disabled={disabledEM}
          isOptionEqualToValue={(option, value) => option.code === value.code}
          value={emCode ? { display: emCode.display, code: emCode.code } : null}
          getOptionLabel={(option) => option.display}
          onChange={(_e, value) => onEMCodeChange(value)}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="E&M code"
              placeholder="Search E&M code"
              data-testid={dataTestIds.assessmentCard.emCodeDropdown}
            />
          )}
        />
        <Autocomplete
          fullWidth
          blurOnSelect
          disabled={disabledCPT}
          options={cptSearchOptions}
          noOptionsText={
            debouncedSearchTerm && cptSearchOptions.length === 0
              ? 'Nothing found for this search criteria'
              : 'Start typing to load results'
          }
          autoComplete
          includeInputInList
          disableClearable
          filterOptions={(x) => x}
          value={null as unknown as undefined}
          isOptionEqualToValue={(option, value) => value.code === option.code}
          loading={isSearching}
          onChange={onInternalChange}
          getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="Additional CPT codes"
              placeholder="Search CPT code"
              onChange={(e) => debouncedHandleInputChange(e.target.value)}
              data-testid={dataTestIds.assessmentCard.cptCodeField}
            />
          )}
        />
      </Box>

      {emCode && (
        <Box
          sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
          data-testid={dataTestIds.billingContainer.container}
        >
          <AssessmentTitle>E&M code</AssessmentTitle>
          <ActionsList
            data={[emCode]}
            getKey={(value, index) => value.resourceId || index}
            renderItem={(value) => (
              <Typography>
                {value.display} {value.code}
              </Typography>
            )}
            renderActions={
              isReadOnly
                ? undefined
                : () => (
                    <DeleteIconButton
                      dataTestId={dataTestIds.billingContainer.deleteButton}
                      disabled={disabledEM}
                      onClick={() => onEMCodeChange(null)}
                    />
                  )
            }
          />
        </Box>
      )}

      {cptCodes.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <AssessmentTitle>Additional CPT codes</AssessmentTitle>
          <ActionsList
            data={cptCodes}
            getKey={(value, index) => value.resourceId || index}
            renderItem={(value) => (
              <Typography data-testid={dataTestIds.billingContainer.cptCodeEntry(value.code)}>
                {value.code} {value.display}
              </Typography>
            )}
            renderActions={
              isReadOnly
                ? undefined
                : (value) => (
                    <DeleteIconButton
                      dataTestId={dataTestIds.billingContainer.deleteCptCodeButton(value.code)}
                      disabled={!value.resourceId || disabledCPT}
                      onClick={() => onDelete(value.resourceId!)}
                    />
                  )
            }
          />
        </Box>
      )}
    </Box>
  );
};
