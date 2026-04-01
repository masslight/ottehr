import { Add, Close, ErrorOutline } from '@mui/icons-material';
import { Autocomplete, Box, Button, Grid, IconButton, Paper, TextField, Theme } from '@mui/material';
import { ProcedureModifier } from 'candidhealth/api';
import { Coding } from 'fhir/r4b';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { AccordionCard } from 'src/components/AccordionCard';
import { useGetCPTHCPCSSearch } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { AdminInHouseLabItemDefinition } from 'utils';
import { FieldArrayListItemProps } from './shared.types';

interface CPTCodeListProps {
  theme: Theme;
}

export default function CPTCodeList(props: CPTCodeListProps): ReactElement {
  const { theme } = props;
  const { control } = useFormContext<AdminInHouseLabItemDefinition>();

  const {
    fields: cptFields,
    append: appendCpt,
    remove: removeCpt,
  } = useFieldArray<AdminInHouseLabItemDefinition, 'cptCode'>({
    control,
    name: 'cptCode',
  });

  return (
    <>
      {cptFields.map((field, index) => (
        <CPTCodeFormItem
          key={field.id}
          fieldData={field}
          index={index}
          remove={removeCpt}
          theme={theme}
        ></CPTCodeFormItem>
      ))}

      <Button startIcon={<Add />} onClick={() => appendCpt({ code: '' })}>
        Add CPT Code
      </Button>
    </>
  );
}

type CPTCodeFormItemProps = FieldArrayListItemProps<'cptCode'>;

function CPTCodeFormItem(props: CPTCodeFormItemProps): ReactElement {
  const { index: cptIndex, remove: removeCpt, theme, fieldData: cptCode } = props;
  const { control, formState } = useFormContext<AdminInHouseLabItemDefinition>();
  const { errors } = formState;

  const defaultHeaderLabel = 'New CPT Code';
  const [sectionHeaderLabel, setSectionHeaderLabel] = useState(defaultHeaderLabel);

  const [isCollapsed, setIsCollapsed] = useState(false);

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(cptCode.code || '');
  const { debounce } = useDebounce(800);

  const debouncedHandleInputChange = (data: string): void => {
    debounce(() => {
      setDebouncedSearchTerm(data);
    });
  };

  const { isFetching: isSearching, data } = useGetCPTHCPCSSearch({ search: debouncedSearchTerm, type: 'both' });
  const cptSearchOptions = useMemo(() => data?.codes || [], [data]);

  const cptModifierOptions: ProcedureModifier[] = Object.values(ProcedureModifier);

  const findFormValueInOptions = (value: string): Required<Pick<Coding, 'code' | 'display'>> | null =>
    cptSearchOptions.find((opt) => opt.code === value) || null;

  const getSelectedOptionLabel = (option: Required<Pick<Coding, 'code' | 'display'>>): string =>
    `${option.code} ${option.display}`;

  const componentErrors = errors.cptCode?.[cptIndex];
  const hasComponentError = !!componentErrors;

  // the use effects are to make sure the cpt code renders pre-populated correctly when there's a value, and for the section header
  useEffect(() => {
    setDebouncedSearchTerm(cptCode.code);
  }, [cptCode]);

  useEffect(() => {
    if (!cptCode.code) return; // no value to display

    const matchedOption = cptSearchOptions.find((opt) => opt.code === cptCode.code);

    if (matchedOption) {
      setSectionHeaderLabel(getSelectedOptionLabel(matchedOption));
    } else {
      // fallback to default if not found in options
      setSectionHeaderLabel(defaultHeaderLabel);
    }
  }, [cptSearchOptions, cptCode.code]);

  return (
    <Box sx={{ marginBottom: 2 }}>
      <AccordionCard
        label={sectionHeaderLabel}
        collapsed={isCollapsed}
        withBorder={false}
        onSwitch={() => {
          setIsCollapsed((prev) => !prev);
        }}
        headerItem={hasComponentError ? <ErrorOutline sx={{ color: theme.palette.error.main }} /> : <></>}
      >
        <Paper sx={{ padding: 3, marginBottom: 2, width: '100%' }}>
          <Grid container direction="row" alignItems="center" justifyContent="space-between">
            <Grid item xs={10} sm={10}>
              <Grid container direction="row" rowSpacing={2}>
                <Grid item width="100%">
                  <Controller
                    name={`cptCode.${cptIndex}.code`}
                    control={control}
                    render={({ field, fieldState }) => (
                      <Autocomplete
                        fullWidth
                        blurOnSelect
                        options={cptSearchOptions}
                        getOptionLabel={(option) => getSelectedOptionLabel(option)}
                        noOptionsText={
                          debouncedSearchTerm && cptSearchOptions.length === 0
                            ? 'Nothing found for this search criteria'
                            : 'Start typing to load results'
                        }
                        autoComplete
                        // includeInputInList
                        // disableClearable
                        loading={isSearching}
                        value={findFormValueInOptions(field.value)} // current form state
                        onChange={(_, selectedOption) => {
                          const newFormValue = selectedOption?.code ?? '';
                          field.onChange(newFormValue); // updating form state
                          setSectionHeaderLabel(
                            selectedOption ? getSelectedOptionLabel(selectedOption) : defaultHeaderLabel
                          );
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            required
                            size="small"
                            label="CPT Code"
                            placeholder="Search CPT Code"
                            onChange={(e) => debouncedHandleInputChange(e.target.value)}
                            error={!!fieldState.error}
                            helperText={fieldState.error?.message}
                          />
                        )}
                      ></Autocomplete>
                    )}
                  ></Controller>
                </Grid>
                <Grid item width="100%">
                  <Controller
                    name={`cptCode.${cptIndex}.modifier`}
                    control={control}
                    render={({ field }) => (
                      <Autocomplete
                        multiple
                        fullWidth
                        blurOnSelect
                        options={cptModifierOptions}
                        getOptionLabel={(option) => option}
                        noOptionsText={'Nothing found for this search criteria'}
                        autoComplete
                        includeInputInList
                        value={(field.value || []).map((modifier) => modifier.code)}
                        onChange={(_, selectedOptions) => {
                          field.onChange(
                            selectedOptions.map((code) => ({
                              code,
                              display: code,
                            }))
                          );
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            size="small"
                            label="Modifier"
                            placeholder="Search CPT Code Modifiers"
                          />
                        )}
                      ></Autocomplete>
                    )}
                  ></Controller>
                </Grid>
              </Grid>
            </Grid>

            <Grid item>
              <IconButton
                onClick={() => {
                  removeCpt(cptIndex);
                }}
              >
                <Close />
              </IconButton>
            </Grid>
          </Grid>
        </Paper>
      </AccordionCard>
    </Box>
  );
}
