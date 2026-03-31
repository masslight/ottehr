import { Add, Close, DeleteOutline, ErrorOutline } from '@mui/icons-material';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  lighten,
  MenuItem,
  Paper,
  Select,
  TextField,
  Theme,
  Typography,
} from '@mui/material';
import { ReactElement, useState } from 'react';
import { Control, Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { AccordionCard } from 'src/components/AccordionCard';
import InputMask from 'src/components/InputMask';
import { AdminInHouseLabItemDefinition, TestItemComponent } from 'utils';
import { FieldArrayListItemProps } from './shared.types';

interface TestComponentListProps {
  theme: Theme;
  // TODO eventually will want default values passed in here ? or maybe it will come in through the control...
}

export default function TestComponentList(props: TestComponentListProps): ReactElement {
  const { theme } = props;
  const { control } = useFormContext<AdminInHouseLabItemDefinition>();

  const {
    fields: componentFields,
    append: appendComponent,
    remove: removeComponent,
  } = useFieldArray<AdminInHouseLabItemDefinition, 'components'>({
    control,
    name: 'components',
  });

  return (
    <>
      {componentFields.map((field, index) => (
        <TestComponentFormItem
          key={field.id}
          fieldData={field}
          index={index}
          remove={removeComponent}
          theme={theme}
        ></TestComponentFormItem>
      ))}

      <Button
        startIcon={<Add />}
        onClick={() =>
          // default we will render a new empty free text component
          appendComponent(COMPONENT_TYPE_CONFIG[DEFAULT_COMPONENT_DATATYPE].getDefault())
        }
      >
        Add Component
      </Button>
    </>
  );
}

type ComponentDataType = TestItemComponent['dataType'];
type ComponentProps = {
  index: number;
  control: Control<AdminInHouseLabItemDefinition, any, AdminInHouseLabItemDefinition>;
  theme: Theme;
};

type ComponentTypeConfig = {
  label: string;
  getDefault: () => TestItemComponent;
  Component: React.ComponentType<ComponentProps> | undefined;
};

// this config couples the user-facing label for the component type (which might differ from ComponentDataType) with the actual data model/compnent that should be rendered
const COMPONENT_TYPE_CONFIG: Record<ComponentDataType, ComponentTypeConfig> = {
  CodeableConcept: {
    label: 'Selectable (categorical)',
    getDefault: () => ({
      dataType: 'CodeableConcept',
      componentName: '',
      loincCode: [],
      valueSet: [
        {
          code: 'Detected',
          display: 'Detected',
          isAbnormal: true,
        },
        {
          code: 'Not Detected',
          display: 'Not Detected',
          isAbnormal: false,
        },
      ],
      display: { type: 'Select', nullOption: false },
    }),
    Component: CodeableConceptFields,
  },

  Quantity: {
    label: 'Numeric Result',
    getDefault: () => ({
      dataType: 'Quantity',
      componentName: '',
      loincCode: [],
      normalRange: { low: 0, high: 1, unit: '', precision: 0 },
      display: { type: 'Numeric', nullOption: false },
    }),
    Component: QuantityFields,
  },

  string: {
    label: 'Free Text',
    getDefault: () => ({
      dataType: 'string',
      componentName: '',
      loincCode: [],
      display: { type: 'Free Text' },
    }),
    // labs todo: in the future we may support validations but for the moment there are none and this is a placeholder
    Component: undefined,
  },
};

const DEFAULT_COMPONENT_DATATYPE: ComponentDataType = 'string';

type TestComponentFormItemProps = FieldArrayListItemProps<'components'>;

function TestComponentFormItem(props: TestComponentFormItemProps): ReactElement {
  const { index: componentIndex, remove: removeComponent, theme } = props;
  const { control, setValue, formState, getValues } = useFormContext<AdminInHouseLabItemDefinition>();
  const { errors } = formState;

  const defaultHeaderLabel = 'New Component';
  const [sectionHeaderLabel, setSectionHeaderLabel] = useState(defaultHeaderLabel);
  const [selectedComponentType, setSelectedComponentType] = useState<ComponentDataType>(DEFAULT_COMPONENT_DATATYPE);

  const [isCollapsed, setIsCollapsed] = useState(false);

  if (setValue === undefined) return <></>;

  const componentTypeLabelString = 'Component Type';
  const ComponentTypeToRender = COMPONENT_TYPE_CONFIG[selectedComponentType].Component;

  const componentErrors = errors.components?.[componentIndex];
  const hasComponentError = !!componentErrors;

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
            <Grid item xs={10} sm={10} md={10}>
              <Grid container direction="row" rowSpacing={2}>
                <Grid item width="100%">
                  <Controller
                    name={`components.${componentIndex}.dataType`}
                    control={control}
                    render={({ field, fieldState }) => (
                      <FormControl fullWidth required>
                        <InputLabel id="componentType-dropdown-label">{componentTypeLabelString}</InputLabel>
                        <Select
                          {...field}
                          label={componentTypeLabelString}
                          defaultValue="string"
                          size="small"
                          fullWidth
                          onChange={(e) => {
                            const newType = e.target.value as ComponentDataType;

                            const formValues = getValues();
                            // setValue updates any arbitrary path in the form, and we need to completely update components[componentIndex] with a whole new valid object for the shape
                            // maintain the component name when updating component type
                            setValue(`components.${componentIndex}`, {
                              ...COMPONENT_TYPE_CONFIG[newType].getDefault(),
                              componentName: formValues.components[componentIndex].componentName,
                            });
                            setSelectedComponentType(newType);
                          }}
                          error={!!fieldState.error}
                        >
                          {Object.entries(COMPONENT_TYPE_CONFIG).map(([dataType, config]) => (
                            <MenuItem key={dataType} value={dataType}>
                              {config.label}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText disabled={!!fieldState.error}>{fieldState.error?.message}</FormHelperText>
                      </FormControl>
                    )}
                  />
                </Grid>
                <Grid item width="100%">
                  <Controller
                    name={`components.${componentIndex}.componentName`}
                    control={control}
                    render={({ field: { onChange, value }, fieldState }) => (
                      <TextField
                        id={`componentName-${componentIndex}`}
                        label="Component Name"
                        required
                        value={value || ''}
                        onChange={(e) => {
                          onChange(e);
                          const newValue = e.target.value;
                          setSectionHeaderLabel((): string => {
                            switch (true) {
                              case !!newValue && !!selectedComponentType:
                                return `${newValue}: ${COMPONENT_TYPE_CONFIG[selectedComponentType].label}`;
                              case !!selectedComponentType:
                                return COMPONENT_TYPE_CONFIG[selectedComponentType].label;
                              default:
                                return defaultHeaderLabel;
                            }
                          });
                        }}
                        sx={{ width: '100%' }}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                </Grid>

                {ComponentTypeToRender && (
                  <ComponentTypeToRender index={componentIndex} control={control} theme={theme} />
                )}
              </Grid>
            </Grid>

            <Grid item>
              <IconButton
                onClick={() => {
                  removeComponent(componentIndex);
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

function QuantityFields(props: ComponentProps): ReactElement {
  const { control, index } = props;

  const DEFAULT_DECIMAL_SCALE = 2; // this is arbitrary
  const [decimalScale, setDecimalScale] = useState(DEFAULT_DECIMAL_SCALE);

  const numberToInput = (value: number | undefined | null): string => {
    if (value === null || value === undefined) return '';
    return String(value);
  };

  const inputToNumber = (value: string): number | undefined => {
    if (value === '' || value === null || value === undefined) return undefined;

    const parsed = Number(value);
    return isNaN(parsed) ? undefined : parsed;
  };

  return (
    <>
      <Grid item width="100%">
        <Controller
          name={`components.${index}.normalRange.precision`}
          control={control}
          render={({ field: { onChange, value, name }, fieldState }) => (
            <TextField
              id={`precision-input-${index}`}
              label="Decimal Places"
              value={numberToInput(value)}
              required
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              InputProps={{
                inputComponent: InputMask as any,
                inputProps: {
                  name: name,
                  mask: Number,
                  min: 0,
                  max: Infinity,
                  padFractionalZeros: true,
                  scale: 0,
                  onChange: (e: any) => {
                    // we need to do this because the form is spitting out a string, but our type in RHF wants a number
                    const numericValue = inputToNumber(e.target.value);
                    onChange(numericValue);
                    setDecimalScale(numericValue ?? DEFAULT_DECIMAL_SCALE);
                  },
                },
              }}
              sx={{ width: '100%' }}
            />
          )}
        />
      </Grid>
      <Grid item width="100%">
        <Controller
          name={`components.${index}.normalRange.low`}
          control={control}
          render={({ field: { onChange, value, name }, fieldState }) => (
            <TextField
              id={`lowRange-input-${index}`}
              label="Low Range"
              value={numberToInput(value)}
              required
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              InputProps={{
                inputComponent: InputMask as any,
                inputProps: {
                  name: name,
                  mask: Number,
                  radix: '.',
                  min: -Infinity,
                  max: Infinity,
                  padFractionalZeros: true,
                  scale: decimalScale,
                  onChange: (e: any) => {
                    // we need to do this because the form is spitting out a string, but our type in RHF wants a number
                    const numericValue = inputToNumber(e.target.value);
                    onChange(numericValue);
                  },
                },
              }}
              sx={{ width: '100%' }}
            />
          )}
        />
      </Grid>

      <Grid item width="100%">
        <Controller
          name={`components.${index}.normalRange.high`}
          control={control}
          render={({ field: { onChange, value, name }, fieldState }) => (
            <TextField
              id={`highRange-input-${index}`}
              label="High Range"
              value={numberToInput(value)}
              required
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              InputProps={{
                inputComponent: InputMask as any,
                inputProps: {
                  name: name,
                  mask: Number,
                  radix: '.',
                  min: -Infinity,
                  max: Infinity,
                  padFractionalZeros: true,
                  scale: decimalScale,
                  onChange: (e: any) => {
                    // we need to do this because the form is spitting out a string, but our type in RHF wants a number
                    const numericValue = inputToNumber(e.target.value);
                    onChange(numericValue);
                  },
                },
              }}
              sx={{ width: '100%' }}
            />
          )}
        />
      </Grid>

      <Grid item width="100%">
        <Controller
          name={`components.${index}.normalRange.unit`}
          control={control}
          render={({ field: { onChange, value }, fieldState }) => (
            <TextField
              id={`unit-input-${index}`}
              label="Unit"
              required
              onChange={onChange}
              value={value || ''}
              sx={{ width: '100%' }}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
            />
          )}
        />
      </Grid>

      {/* labs todo: our type also in theory supports a nullOption for quantity components, but nothing to date has that configured, so omitting for now */}
    </>
  );
}

function CodeableConceptFields(props: ComponentProps): ReactElement {
  const { control, index: componentIndex, theme } = props;

  const {
    fields: valueSetFields,
    append: appendValueSet,
    remove: removeValueSet,
  } = useFieldArray({
    control,
    name: `components.${componentIndex}.valueSet`,
  });

  // we use this so we can determine if the display is a radio button or not without bothering the user about it
  const values = useWatch({
    control,
    name: `components.${componentIndex}.valueSet`,
  });

  const components = useWatch({
    control,
    name: 'components',
  });

  const displayType = values?.length === 2 && components?.length === 1 ? 'Radio' : 'Select';

  return (
    <>
      {valueSetFields.map((field, valueIndex) => (
        <Grid item key={field.id}>
          <CodeableConceptValueRow
            componentIndex={componentIndex}
            valueIndex={valueIndex}
            control={control}
            removeValueSet={removeValueSet}
            theme={theme}
          />
        </Grid>
      ))}
      <Grid item xs={12}>
        <Button
          startIcon={<Add />}
          onClick={() =>
            appendValueSet({
              code: '',
              display: '',
              isAbnormal: false,
            })
          }
        >
          Add Value
        </Button>
      </Grid>

      <Grid item xs={12}>
        <Controller
          name={`components.${componentIndex}.display.nullOption`}
          control={control}
          render={({ field }) => (
            <FormControlLabel
              label={
                <Typography
                  sx={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: theme.palette.text.primary,
                  }}
                >
                  Include inconclusive option
                </Typography>
              }
              sx={{
                backgroundColor: 'transparent',
                pr: 0,
              }}
              control={
                <Checkbox
                  size="medium"
                  sx={{
                    color: theme.palette.primary.main,
                    '&.Mui-checked': {
                      color: theme.palette.primary.main,
                    },
                    '&.Mui-disabled': {
                      color: lighten(theme.palette.primary.main, 0.4),
                    },
                  }}
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              }
            />
          )}
        />
      </Grid>

      {/* Derived display.type, hidden from user */}
      <Grid item>
        <Controller
          name={`components.${componentIndex}.display.type`}
          control={control}
          render={({ field }) => {
            if (field.value !== displayType) {
              field.onChange(displayType);
            }
            return <></>;
          }}
        />
      </Grid>
    </>
  );
}

interface ValueRowProps extends Pick<ComponentProps, 'control' | 'theme'> {
  componentIndex: number;
  valueIndex: number;
  removeValueSet: (index: number) => void;
}

function CodeableConceptValueRow(props: ValueRowProps): ReactElement {
  const { componentIndex, valueIndex, control, removeValueSet, theme } = props;

  return (
    <Grid container spacing={1} alignItems="center" justifyContent="space-between">
      {/* Value text */}
      <Grid item xs={6}>
        <Controller
          name={`components.${componentIndex}.valueSet.${valueIndex}.code`}
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              required
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              label="Value"
              size="small"
              fullWidth
            />
          )}
        />
      </Grid>

      {/* Abnormal checkbox */}
      <Grid item>
        <Controller
          name={`components.${componentIndex}.valueSet.${valueIndex}.isAbnormal`}
          control={control}
          render={({ field }) => (
            <FormControlLabel
              label={
                <Typography
                  sx={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: theme.palette.text.primary,
                  }}
                >
                  Abnormal
                </Typography>
              }
              sx={{
                backgroundColor: 'transparent',
                pr: 0,
              }}
              control={
                <Checkbox
                  size="medium"
                  sx={{
                    color: theme.palette.error.main,
                    '&.Mui-checked': {
                      color: theme.palette.error.main,
                    },
                    '&.Mui-disabled': {
                      color: lighten(theme.palette.error.main, 0.4),
                    },
                  }}
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              }
            />
          )}
        />
      </Grid>

      <Grid item>
        <IconButton size="small" onClick={() => removeValueSet(valueIndex)}>
          <DeleteOutline fontSize="small" sx={{ color: theme.palette.primary.main }} />
        </IconButton>
      </Grid>
    </Grid>
  );
}
