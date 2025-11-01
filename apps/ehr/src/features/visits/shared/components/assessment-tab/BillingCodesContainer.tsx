import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { ActionsList } from 'src/components/ActionsList';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { CompleteConfiguration } from 'src/components/CompleteConfiguration';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { CPT_TOOLTIP_PROPS, TooltipWrapper } from 'src/components/WithTooltip';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { APIErrorCode, CPTCodeOption, emCodeOptions } from 'utils';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useGetIcd10Search } from '../../stores/appointment/appointment.queries';
import { useChartData, useDeleteChartData, useSaveChartData } from '../../stores/appointment/appointment.store';

export const BillingCodesContainer: FC = () => {
  const { chartData, setPartialChartData } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const cptCodes = chartData?.cptCodes || [];
  const emCode = Array.isArray(chartData?.emCode) ? null : chartData?.emCode;

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const {
    isFetching: isSearching,
    data,
    error: icdSearchError,
  } = useGetIcd10Search({ search: debouncedSearchTerm, sabs: 'CPT' });
  const cptSearchOptions = data?.codes || [];

  const { mutate: saveEMChartData, isPending: isSaveEMLoading } = useSaveChartData();
  const { mutate: saveCPTChartData, isPending: isSaveCPTLoading } = useSaveChartData();
  const { mutate: deleteEMChartData, isPending: isDeleteEMLoading } = useDeleteChartData();
  const { mutate: deleteCPTChartData, isPending: isDeleteCPTLoading } = useDeleteChartData();

  const disabledEM = Boolean(isSaveEMLoading || isDeleteEMLoading || (emCode && !emCode.resourceId));
  const disabledCPT = Boolean(isSaveCPTLoading || isDeleteCPTLoading);

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
      const prevValue = emCode ? { ...emCode } : undefined;

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
            setPartialChartData({ emCode: prevValue || undefined });
          },
        }
      );
      setPartialChartData({ emCode: value });
    } else if (emCode) {
      deleteEMChartData({ emCode });
      setPartialChartData({ emCode: undefined });
    }
  };

  const nlmApiKeyMissing = (icdSearchError as any)?.code === APIErrorCode.MISSING_NLM_API_KEY_ERROR;

  const handleSetup = (): void => {
    window.open('https://docs.oystehr.com/ottehr/setup/terminology/', '_blank');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ color: '#0F347C' }}>
          <TooltipWrapper tooltipProps={CPT_TOOLTIP_PROPS}>
            <AssessmentTitle>Billing</AssessmentTitle>
          </TooltipWrapper>
        </Box>
        {!isReadOnly && (
          <>
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
          </>
        )}
      </Box>

      {nlmApiKeyMissing && <CompleteConfiguration handleSetup={handleSetup} />}

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
