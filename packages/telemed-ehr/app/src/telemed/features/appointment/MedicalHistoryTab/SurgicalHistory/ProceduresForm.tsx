import { FC } from 'react';
import { Autocomplete, Box, Card, TextField, Typography } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { otherColors } from '../../../../../CustomThemeProvider';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useChartDataArrayValue } from '../../../../hooks';
import { useAppointmentStore } from '../../../../state';
import { ProviderSideListSkeleton } from '../ProviderSideListSkeleton';
import { ActionsList, DeleteIconButton, RoundedButton } from '../../../../components';

const SURGICAL_HISTORY_OPTIONS = [
  'Adenoidectomy (Adenoid Removal)',
  'Appendectomy',
  'C-section (Cesarean delivery)',
  'Circumcision',
  'Cleft lip/palate repair',
  'Cyst removed',
  'Dental/ Oral Surgery',
  'Ear tube placement (Myringotomy)',
  'Elbow/ Hand/ Arm Surgery',
  'Feeding tube (G-tube)',
  'Foot/ Ankle Surgery',
  'Frenotomy (Tongue Tie Repair)',
  'Gallbladder removal',
  'Heart/ Cardiac surgery',
  'Hemangioma ',
  'Hernia ',
  'Hydrocele Repair',
  'Hypospadias repair',
  'Kidney surgery',
  'Knee Surgery',
  'Orchiectomy (Testicle Removal)',
  'Other Eye surgery',
  'Pyloromyotomy (Pyloric Stenosis Repair)',
  'Sinus surgery',
  'Splenectomy',
  'Tear Duct Eye surgery',
  'Tonsillectomy and adenoidectomy (Tonsil and Adenoid Removal)',
  'Undescended Testicle Repair',
  'Ventriculoperitoneal shunt placement',
  'Wisdom teeth removal',
  'Other',
];

export const ProceduresForm: FC = () => {
  const methods = useForm<{
    name: string;
  }>({
    defaultValues: {
      name: '',
    },
  });
  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);

  const { control, handleSubmit, reset } = methods;

  const { isLoading, onSubmit, onRemove, values: procedures } = useChartDataArrayValue('procedures', reset);

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
          <ActionsList
            data={procedures}
            getKey={(value) => value.resourceId!}
            renderItem={(value) => <Typography>{value.name}</Typography>}
            renderActions={(value) => (
              <DeleteIconButton disabled={isLoading} onClick={() => onRemove(value.resourceId!)} />
            )}
            divider
          />
        )}
      </Box>
      <form onSubmit={handleSubmit(onSubmit)}>
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
            name="name"
            control={control}
            rules={{ required: true }}
            render={({ field: { value, onChange }, fieldState: { error } }) => (
              <Autocomplete
                value={value || null}
                onChange={(_e, data) => onChange(data || '')}
                fullWidth
                size="small"
                disablePortal
                disabled={isLoading || isChartDataLoading}
                options={SURGICAL_HISTORY_OPTIONS}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    helperText={error ? error.message : null}
                    error={!!error}
                    label="Type of surgery"
                    placeholder="Search"
                  />
                )}
              />
            )}
          />
          <RoundedButton disabled={isLoading || isChartDataLoading} type="submit">
            Add to the surgeries
          </RoundedButton>
        </Card>
      </form>
    </Box>
  );
};
