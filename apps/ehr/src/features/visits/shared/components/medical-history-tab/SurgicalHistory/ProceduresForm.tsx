import { otherColors } from '@ehrTheme/colors';
import { Box, Card, Stack, TextField, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActionsList } from 'src/components/ActionsList';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useChartDataArrayValue } from '../../../hooks/useChartDataArrayValue';
import { useChartData } from '../../../stores/appointment/appointment.store';
import { ProviderSideListSkeleton } from '../../ProviderSideListSkeleton';
import { SurgicalHistoryField } from './SurgicalHistoryField';

export const ProceduresForm: FC = () => {
  const methods = useForm<{
    selectedProcedure: CPTCodeDTO | null;
    otherProcedureName: string;
  }>({
    defaultValues: {
      selectedProcedure: null,
      otherProcedureName: '',
    },
  });
  const { isChartDataLoading } = useChartData();
  const [isOtherOptionSelected, setIsOtherOptionSelected] = useState(false);

  const { control, reset, handleSubmit } = methods;

  const { isLoading, onSubmit, onRemove, values: procedures } = useChartDataArrayValue('surgicalHistory', reset, {});

  const handleSelectOption = (data: CPTCodeDTO | null): void => {
    if (data) {
      void onSubmit(data);
      reset({ selectedProcedure: null, otherProcedureName: '' });
      setIsOtherOptionSelected(false);
    }
  };

  const onSubmitForm = (data: { selectedProcedure: CPTCodeDTO | null; otherProcedureName: string }): void => {
    if (data.selectedProcedure) {
      handleSelectOption({
        ...data.selectedProcedure,
        display: 'Other' + (data.otherProcedureName ? ` (${data.otherProcedureName})` : ''),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmitForm)}>
      <Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            mb: procedures.length || isChartDataLoading ? 2 : 0,
          }}
        >
          {isChartDataLoading ? (
            <ProviderSideListSkeleton />
          ) : (
            <Box data-testid={dataTestIds.surgicalHistory.surgicalHistoryList}>
              <ActionsList
                data={procedures}
                itemDataTestId={dataTestIds.surgicalHistory.surgicalHistoryListItem}
                getKey={(value) => value.resourceId!}
                renderItem={(value) => (
                  <Typography>
                    {value.code} {value.display}
                  </Typography>
                )}
                renderActions={(value) => (
                  <DeleteIconButton disabled={isLoading} onClick={() => onRemove(value.resourceId!)} />
                )}
                divider
              />
            </Box>
          )}
        </Box>
        <Card
          elevation={0}
          sx={{
            p: 3,
            backgroundColor: otherColors.formCardBg,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Controller
            name="selectedProcedure"
            control={control}
            rules={{ required: true }}
            render={({ field: { value, onChange } }) => (
              <SurgicalHistoryField
                value={value}
                disabled={isLoading || isChartDataLoading}
                onChange={(data) => {
                  onChange(data);
                  // "Other" is the page's own branch: it reveals a free-text name and an Add button, so it
                  // must NOT go straight to the write.
                  if (data?.display === 'Other') {
                    setIsOtherOptionSelected(true);
                  } else {
                    setIsOtherOptionSelected(false);
                    handleSelectOption(data);
                  }
                }}
              />
            )}
          />
          {isOtherOptionSelected && (
            <Stack direction="row" spacing={2} alignItems="center">
              <Controller
                name="otherProcedureName"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <TextField
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    label="Other surgery"
                    placeholder="Please specify"
                    fullWidth
                    size="small"
                  />
                )}
              />
              <RoundedButton type="submit">Add</RoundedButton>
            </Stack>
          )}
        </Card>
      </Box>
    </form>
  );
};
