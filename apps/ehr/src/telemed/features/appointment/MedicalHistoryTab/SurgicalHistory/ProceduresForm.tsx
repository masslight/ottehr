import { otherColors } from '@ehrTheme/colors';
import { Autocomplete, Box, Card, TextField, Typography } from '@mui/material';
import { FC } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { CPTCodeDTO } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { ActionsList, DeleteIconButton } from '../../../../components';
import { useChartDataArrayValue } from '../../../../hooks';
import { useAppointmentStore } from '../../../../state';
import { ProviderSideListSkeleton } from '../ProviderSideListSkeleton';

const surgicalHistoryOptions: CPTCodeDTO[] = [
  { display: 'Adenoidectomy', code: '42830' },
  { display: 'Appendectomy', code: '44950' },
  { display: 'C-section', code: '59510' },
  { display: 'Circumcision', code: '54150' },
  { display: 'Cleft Lip/Palate Repair', code: '42200' },
  { display: 'Cyst removed', code: '97139' },
  { display: 'Dental/Oral Surgery', code: '41899' },
  { display: 'Ear tube placement', code: '69436' },
  { display: 'Elbow/Hand/Arm Surgery', code: '24999' },
  { display: 'Feeding tube', code: '43246' },
  { display: 'Foot/Ankle Surgery', code: '27899' },
  { display: 'Frenotomy', code: '41010' },
  { display: 'Gallbladder removal', code: '47600' },
  { display: 'Heart/Cardiac surgery', code: '33999' },
  { display: 'Hemangioma', code: '17106' },
  { display: 'Hernia Repair', code: '49617' },
  { display: 'Hydrocele Repair', code: '55060' },
  { display: 'Hypospadias repair', code: '53450' },
  { display: 'Kidney surgery', code: '50540' },
  { display: 'Knee Surgery', code: '29850' },
  { display: 'Orchiectomy (Testicle Removal)', code: '54520' },
  { display: 'Other Eye surgery', code: '65799' },
  { display: 'Pyloromyotomy', code: '67599' },
  { display: 'Sinus surgery', code: '43520' },
  { display: 'Splenectomy', code: '31299' },
  { display: 'Tear Duct Eye surgery', code: '38100' },
  { display: 'Tonsillectomy and adenoidectomy', code: '68899' },
  { display: 'Undescended Testicle Repair', code: '42820' },
  { display: 'Ventriculoperitoneal shunt placement', code: '54640' },
  { display: 'Wisdom teeth removal', code: '75809' },
  { display: 'Other', code: '41899' },
];

export const ProceduresForm: FC = () => {
  const methods = useForm<{
    selectedProcedure: CPTCodeDTO | null;
  }>({
    defaultValues: {
      selectedProcedure: null,
    },
  });
  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);

  const { control, reset } = methods;

  const { isLoading, onSubmit, onRemove, values: procedures } = useChartDataArrayValue('surgicalHistory', reset, {});

  const handleSelectOption = (data: CPTCodeDTO | null): void => {
    if (data) {
      void onSubmit(data);
      reset({ selectedProcedure: null });
    }
  };

  return (
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
          <Box data-testid={dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList}>
            <ActionsList
              data={procedures}
              itemDataTestId={dataTestIds.telemedEhrFlow.hpiSurgicalHistoryListItem}
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
            <Autocomplete
              value={value || null}
              onChange={(_e, data) => {
                onChange(data);
                handleSelectOption(data);
              }}
              fullWidth
              size="small"
              disabled={isLoading || isChartDataLoading}
              options={surgicalHistoryOptions}
              noOptionsText="Nothing found for this search criteria"
              getOptionLabel={(option) => `${option.code} ${option.display}`}
              renderOption={(props, option) => (
                <li {...props}>
                  <Typography component="span">
                    {option.code} {option.display}
                  </Typography>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Surgery"
                  placeholder="Search"
                  InputLabelProps={{ shrink: true }}
                  data-testid={dataTestIds.telemedEhrFlow.hpiSurgicalHistoryInput}
                  sx={{
                    '& .MuiInputLabel-root': {
                      fontWeight: 'bold',
                    },
                  }}
                />
              )}
            />
          )}
        />
      </Card>
    </Box>
  );
};
