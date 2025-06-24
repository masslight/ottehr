import { otherColors } from '@ehrTheme/colors';
import {
  Box,
  Card,
  CircularProgress,
  debounce,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, useMemo, useState } from 'react';
import { BirthHistoryDTO } from 'utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import {
  AccordionCard,
  useAppointmentStore,
  useGetAppointmentAccessibility,
  useSaveChartData,
} from '../../../../telemed';
import { useAppointment } from '../../hooks/useAppointment';
import { useChartData } from '../../hooks/useChartData';

type BirthHistoryProps = {
  appointmentID?: string;
};

export const BirthHistory: FC<BirthHistoryProps> = ({ appointmentID }) => {
  const { mappedData } = useAppointment(appointmentID);

  const [isCollapsed, setIsCollapsed] = useState(
    -DateTime.fromFormat(mappedData.DOB || '', 'yyyy-dd-MM').diff(DateTime.now(), 'days').days > 90
  );
  const { encounter, chartData } = getSelectors(useAppointmentStore, ['encounter', 'chartData']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const { isLoading: isChartDataLoading } = useChartData({
    encounterId: encounter.id || '',
    requestedFields: {
      birthHistory: {
        _search_by: 'patient',
        _sort: '-_lastUpdated',
      },
    },
    onSuccess: (data) => {
      useAppointmentStore.setState((prevState) => ({
        ...prevState,
        chartData: {
          ...prevState.chartData,
          patientId: prevState.chartData?.patientId || '',
          birthHistory: data.birthHistory,
        },
      }));
    },
  });

  const age = chartData?.birthHistory?.find((item) => item.field === 'age');
  const weight = chartData?.birthHistory?.find((item) => item.field === 'weight');
  const length = chartData?.birthHistory?.find((item) => item.field === 'length');
  const pregCompl = chartData?.birthHistory?.find((item) => item.field === 'preg-compl');
  const delCompl = chartData?.birthHistory?.find((item) => item.field === 'del-compl');

  return (
    <AccordionCard
      label={
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" color="primary.dark">
            Birth history
          </Typography>
          {(typeof age?.value === 'number' ||
            typeof weight?.value === 'number' ||
            typeof length?.value === 'number') && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              {typeof age?.value === 'number' && <Typography>Gestational age at birth: {age?.value} weeks</Typography>}
              {typeof weight?.value === 'number' && <Typography>Weight: {weight?.value} kg</Typography>}
              {typeof length?.value === 'number' && <Typography>Length: {length?.value} cm</Typography>}
            </Box>
          )}
        </Box>
      }
      collapsed={isCollapsed}
      onSwitch={() => setIsCollapsed((state) => !state)}
    >
      {isChartDataLoading ? (
        <Box sx={{ p: 2 }}>
          <Skeleton variant="rounded" width="100%" height={200} />
        </Box>
      ) : (
        <Card
          elevation={0}
          sx={{
            p: 2,
            m: 2,
            backgroundColor: otherColors.formCardBg,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            <NumberDebounceField
              field={age}
              disabled={isReadOnly}
              fieldName="age"
              label="Gestational age at birth (weeks)"
            />
            <NumberDebounceField
              field={weight}
              disabled={isReadOnly}
              fieldName="weight"
              label="Wt (kg)"
              convertProps={{
                label: 'Wt (lbs)',
                convertFunc: (value) => {
                  const num = toNumber(value);
                  if (typeof num === 'number') {
                    return (Math.round(num * 2.205 * 100) / 100).toString();
                  } else {
                    return '';
                  }
                },
              }}
            />
            <NumberDebounceField
              field={length}
              disabled={isReadOnly}
              fieldName="length"
              label="Length (cm)"
              convertProps={{
                label: 'Length (inch)',
                convertFunc: (value) => {
                  const num = toNumber(value);
                  if (typeof num === 'number') {
                    return (Math.round((num / 2.54) * 100) / 100).toString();
                  } else {
                    return '';
                  }
                },
              }}
            />
          </Box>

          <CheckboxWithNotesField
            field={pregCompl}
            fieldName="preg-compl"
            disabled={isReadOnly}
            label="Any complications during pregnancy?"
          />
          <CheckboxWithNotesField
            field={delCompl}
            fieldName="del-compl"
            disabled={isReadOnly}
            label="Any complications during delivery??"
          />
        </Card>
      )}
    </AccordionCard>
  );
};

const showErrorSnackbar = (field: BirthHistoryDTO['field']): void => {
  const mapFieldToName: { [field in BirthHistoryDTO['field']]: string } = {
    age: 'gestational age',
    weight: 'weight',
    length: 'length',
    'preg-compl': 'pregnancy complications',
    'del-compl': 'delivery complications',
  };

  enqueueSnackbar(`An error has occurred while updating ${mapFieldToName[field]}. Please try again.`, {
    variant: 'error',
  });
};

const setUpdatedField = (updated?: BirthHistoryDTO): void => {
  if (updated) {
    useAppointmentStore.setState((prevState) => ({
      chartData: {
        ...prevState.chartData!,
        birthHistory: prevState.chartData?.birthHistory?.find((item) => item.resourceId === updated.resourceId)
          ? prevState.chartData?.birthHistory?.map((item) => (item.resourceId === updated.resourceId ? updated : item))
          : [...(prevState.chartData?.birthHistory || []), updated],
      },
    }));
  }
};

const toNumber = (value: string): number | undefined => (value ? (isNaN(+value) ? undefined : +value) : undefined);

type NumberDebounceFieldProps = {
  fieldName: 'age' | 'weight' | 'length';
  field?: BirthHistoryDTO;
  disabled?: boolean;
  label: string;
  convertProps?: {
    label: string;
    convertFunc: (value: string) => string;
  };
};

const NumberDebounceField: FC<NumberDebounceFieldProps> = (props) => {
  const { field, disabled, fieldName, label, convertProps } = props;

  const [value, setValue] = useState<string>(typeof field?.value === 'number' ? field.value.toString() : '');
  const { mutate: updateChartData, isLoading: isUpdateLoading } = useSaveChartData();

  const areEqual = value === `${field?.value?.toString() || ''}`;

  const debouncedHandleInputChange = useMemo(
    () =>
      debounce((value?: number) => {
        updateChartData(
          {
            birthHistory: [{ ...(field || { field: fieldName }), value }],
          },
          {
            onSuccess: (data) => {
              const updated = data.chartData.birthHistory?.[0];
              setUpdatedField(updated);
            },
            onError: () => {
              showErrorSnackbar(fieldName);
            },
          }
        );
      }, 1500),
    [field, fieldName, updateChartData]
  );

  return (
    <>
      <TextField
        disabled={disabled}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          debouncedHandleInputChange(toNumber(e.target.value));
        }}
        fullWidth
        size="small"
        label={label}
        type="number"
        InputProps={{
          endAdornment: (!areEqual || isUpdateLoading) && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size="20px" />
            </Box>
          ),
        }}
      />
      {convertProps && (
        <>
          <Typography alignSelf="center" fontSize={20}>
            /
          </Typography>
          <TextField
            fullWidth
            size="small"
            label={convertProps.label}
            sx={{
              '& fieldset': { border: 'none' },
              maxWidth: '110px',
            }}
            disabled
            InputLabelProps={{ shrink: true }}
            value={convertProps.convertFunc(value)}
          />
        </>
      )}
    </>
  );
};

type CheckboxWithNotesFieldProps = {
  fieldName: 'preg-compl' | 'del-compl';
  field?: BirthHistoryDTO;
  disabled?: boolean;
  label: string;
};

const CheckboxWithNotesField: FC<CheckboxWithNotesFieldProps> = (props) => {
  const { fieldName, field, disabled, label } = props;

  const [value, setValue] = useState(field?.note || '');
  const { mutate: updateChartData, isLoading: isUpdateLoading } = useSaveChartData();

  const areEqual = value === `${field?.note?.toString() || ''}`;

  const handleRadioChange = (newValue: string): void => {
    updateChartData(
      {
        birthHistory: [{ ...(field || { field: fieldName }), flag: newValue === 'yes', note: undefined }],
      },
      {
        onSuccess: (data) => {
          const updated = data.chartData.birthHistory?.[0];
          setValue('');
          setUpdatedField(updated);
        },
        onError: () => {
          showErrorSnackbar(fieldName);
        },
      }
    );
  };

  const debouncedHandleInputChange = useMemo(
    () =>
      debounce((value?: string) => {
        updateChartData(
          {
            birthHistory: [{ ...(field || { field: fieldName }), note: value }],
          },
          {
            onSuccess: (data) => {
              const updated = data.chartData.birthHistory?.[0];
              setUpdatedField(updated);
            },
            onError: () => {
              showErrorSnackbar(fieldName);
            },
          }
        );
      }, 1500),
    [field, fieldName, updateChartData]
  );

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
      <FormControl
        disabled={disabled || !areEqual || isUpdateLoading}
        sx={{
          minWidth: 'auto',
        }}
      >
        <FormLabel
          sx={{
            fontWeight: 500,
            color: 'primary.dark',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </FormLabel>
        <RadioGroup
          row
          value={typeof field?.flag === 'boolean' ? (field.flag ? 'yes' : 'no') : null}
          onChange={(e) => handleRadioChange(e.target.value)}
        >
          <FormControlLabel value="yes" control={<Radio />} label="Yes" />
          <FormControlLabel value="no" control={<Radio />} label="No" />
        </RadioGroup>
      </FormControl>
      {field?.flag && (
        <TextField
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            debouncedHandleInputChange(e.target.value || undefined);
          }}
          fullWidth
          size="small"
          label="Please describe"
          disabled={disabled || (areEqual && isUpdateLoading)}
          InputProps={{
            endAdornment: (!areEqual || (!areEqual && isUpdateLoading)) && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size="20px" />
              </Box>
            ),
          }}
        />
      )}
    </Box>
  );
};
