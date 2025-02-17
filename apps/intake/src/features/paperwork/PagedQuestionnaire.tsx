import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputBaseComponentProps,
  InputProps,
  SxProps,
  TextField,
  Theme,
  Tooltip,
  Typography,
  useTheme,
  Button,
} from '@mui/material';
import { FC, ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, FormProvider, useForm, useFormContext } from 'react-hook-form';
import {
  BoldPurpleInputLabel,
  ControlButtons,
  ControlButtonsProps,
  DescriptionRenderer,
  InputMask,
  LightToolTip,
  LinkRenderer,
  useIntakeThemeContext,
} from 'ui-components';
import {
  IntakeQuestionnaireItem,
  QuestionnaireFormFields,
  QuestionnaireItemGroupType,
  SIGNATURE_FIELDS,
  makeValidationSchema,
  pickFirstValueFromAnswerItem,
  stripMarkdownLink,
} from 'utils';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { StyledQuestionnaireItem, useStyledItems } from './useStyleItems';
import RadioInput from './components/RadioInput';
import RadioListInput from './components/RadioListInput';
import FreeMultiSelectInput from './components/FreeMultiSelectInput';
import { yupResolver } from '@hookform/resolvers/yup';
import DateInput from './components/DateInput';
import FileInput, { AttachmentType } from './components/FileInput';
import Markdown from 'react-markdown';
import { useBeforeUnload } from 'react-router-dom';
import { getInputTypeForItem } from './utils';
import { getPaperworkFieldId, useFieldError, usePaperworkFormHelpers, useQRState } from './useFormHelpers';
import { useAutoFillValues } from './useAutofill';
import { AnyObjectSchema } from 'yup';
import { FieldHelperText } from './components/FieldHelperText';
import { getUCInputType } from '../../helpers/paperworkUtils';
import { usePaperworkContext } from './context';
import MultiAnswerHeader from './components/group/MultiAnswerHeader';
import GroupContainer from './components/group/GroupContainer';
import { CreditCardVerification } from './components/CreditCardVerification';

interface PagedQuestionnaireOptions {
  bottomComponent?: ReactElement;
  hideControls?: boolean;
  controlButtons?: ControlButtonsProps;
}

interface PagedQuestionnaireInput {
  items: IntakeQuestionnaireItem[];
  pageId: string;
  defaultValues?: QuestionnaireFormFields;
  options?: PagedQuestionnaireOptions;
  isSaving?: boolean;
  onSubmit: (data: QuestionnaireFormFields) => void;
  saveProgress: (data: QuestionnaireFormFields) => void;
}

type FormInputProps = {
  format?: string;
  helperText?: string;
  showHelperTextIcon?: boolean;
  inputBaseProps?: InputBaseComponentProps;
} & InputProps;

interface ItemInputProps {
  item: IntakeQuestionnaireItem;
  inputProps?: FormInputProps;
  sx?: SxProps<Theme>;
}

interface StyledItemInputProps extends ItemInputProps {
  item: StyledQuestionnaireItem;
}

const DEFAULT_INPUT_BASE_PROPS: InputBaseComponentProps = {
  width: '100%',
};

const makeFormInputPropsForItem = (item: StyledQuestionnaireItem): FormInputProps => {
  const { mask } = item;

  const inputProps = {
    format: undefined,
    infoText: undefined,
    helperText: undefined,
    showHelperTextIcon: false,
    inputBaseProps: {
      ...DEFAULT_INPUT_BASE_PROPS,
      mask,
    },
  };

  // (`input props for item ${item.linkId}`, inputProps);
  return inputProps;
};

const makeFormErrorMessage = (items: IntakeQuestionnaireItem[], errors: any): string | undefined => {
  const errorKeys = Object.keys(errors);
  let numErrors = errorKeys.length;
  if (numErrors === 0) {
    return undefined;
  }
  const errorItems = items
    .filter((i) => errorKeys.includes(i.linkId) && (i.text !== undefined || i.type === 'group'))
    .flatMap((i) => {
      if (i.type === 'group' && i.dataType !== 'DOB') {
        const items = ((errors[i.linkId] as any)?.item ?? []) as any[];
        const internalErrors: IntakeQuestionnaireItem[] = [];
        items.forEach((e, idx) => {
          if (e != null) {
            const errorItem = (i.item ?? []).filter((i) => i.type !== 'display' && !i.readOnly)[idx];
            if (errorItem) {
              internalErrors.push(errorItem);
            }
          }
        });
        numErrors += internalErrors.length - 1;
        return internalErrors.map((nestedItem) => {
          return `"${stripMarkdownLink(nestedItem.text ?? '')}"`;
        });
      }
      return `"${stripMarkdownLink(i.text ?? '')}"`;
    });
  if (numErrors === errorItems.length) {
    if (numErrors > 1) {
      return `Please fix the errors in the following fields to proceed: ${errorItems.map((ei) => ei)}`;
    } else {
      return `Please fix the error in the ${errorItems[0]} field to proceed`;
    }
  } else if (numErrors === 1) {
    return 'Please fix the error in the field above to proceed';
  } else {
    return `Please fix the error in the ${numErrors} fields above to proceed`;
  }
};

const PagedQuestionnaire: FC<PagedQuestionnaireInput> = ({
  items,
  pageId,
  defaultValues,
  options = {},
  isSaving,
  onSubmit,
  saveProgress,
}) => {
  const { paperwork, allItems } = usePaperworkContext();

  // console.log('questionnaireResponse', questionnaireResponse?.questionnaire, questionnaireResponse?.id);

  const validationSchema = makeValidationSchema(items, pageId, {
    values: paperwork,
    items: allItems,
  }) as AnyObjectSchema;
  const methods = useForm({
    mode: 'onSubmit', // onBlur doesnt seem to work but we use onBlur of FormControl in NestedInput to implement the desired behavior
    reValidateMode: 'onChange',
    context: paperwork,
    defaultValues,
    shouldFocusError: true,
    resolver: yupResolver(validationSchema, { abortEarly: false }),
  });

  const { reset } = methods;

  useEffect(() => {
    if (items) {
      reset({
        ...(defaultValues ?? {}),
      });
    }
  }, [defaultValues, items, reset, pageId]);

  return (
    <FormProvider {...methods}>
      <PaperworkFormRoot
        items={items}
        onSubmit={onSubmit}
        saveProgress={saveProgress}
        options={options}
        parentIsSaving={isSaving}
      />
    </FormProvider>
  );
};

interface PaperworkRootInput {
  items: IntakeQuestionnaireItem[];
  onSubmit: (data: QuestionnaireFormFields) => void;
  saveProgress: (data: QuestionnaireFormFields) => void;
  options?: PagedQuestionnaireOptions;
  parentIsSaving?: boolean;
}
const PaperworkFormRoot: FC<PaperworkRootInput> = ({
  items,
  onSubmit,
  saveProgress,
  options = {},
  parentIsSaving = false,
}) => {
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  const { saveButtonDisabled } = usePaperworkContext();
  //console.log('questionnaire response.q', questionnaireResponse?.questionnaire);
  //console.log('all items', allItems);

  const { handleSubmit, formState } = useFormContext();

  const theme = useTheme();

  const { isSubmitting, isLoading, errors } = formState;

  const errorMessage = makeFormErrorMessage(items, errors);
  // console.log('errors', errors);
  const { formValues } = useQRState();
  // console.log('form values', formValues);

  const submitHandler = useCallback(async () => {
    setIsSavingProgress(true);
    await handleSubmit(onSubmit)();
    setIsSavingProgress(false);
  }, [handleSubmit, onSubmit]);

  const { bottomComponent, hideControls, controlButtons } = options;

  const swizzledCtrlButtons = useMemo(() => {
    const baseStuff = controlButtons ?? {};
    return {
      ...baseStuff,
      submitDisabled: baseStuff.loading || isLoading || saveButtonDisabled,
      onSubmit: submitHandler,
    };
  }, [controlButtons, isLoading, saveButtonDisabled, submitHandler]);

  useBeforeUnload(() => {
    saveProgress(formValues);
  });

  return (
    <form onSubmit={submitHandler}>
      <Grid container spacing={1}>
        <RenderItems items={items} />
      </Grid>
      <div id="page-form-inner-form" />
      {bottomComponent}
      {errorMessage && (
        <FormHelperText
          id={'form-error-helper-text'}
          sx={{ textAlign: 'right', color: theme.palette.error.main, gap: 0, mt: 1 }}
        >
          {errorMessage}
        </FormHelperText>
      )}
      {!hideControls && (
        <ControlButtons {...swizzledCtrlButtons} loading={isSavingProgress || isSubmitting || parentIsSaving} />
      )}
    </form>
  );
};

export interface RenderItemsProps {
  items: IntakeQuestionnaireItem[];
  parentItem?: IntakeQuestionnaireItem;
  fieldId?: string;
}

const RenderItems: FC<RenderItemsProps> = (props: RenderItemsProps) => {
  const { items, parentItem, fieldId } = props;
  const styledItems = useStyledItems({ formItems: items });
  // console.log('styledItems', styledItems);
  // console.log('all items', items);
  useAutoFillValues({ questionnaireItems: items, fieldId, parentItem });

  return (
    <>
      {styledItems.map((item, idx) => {
        if (item.type === 'display') {
          return <FormDisplayField item={item} key={`FDF-${fieldId ?? item.linkId}-${idx}`} />;
        } else if (item.type === 'group' && item.dataType !== 'DOB') {
          return (
            <GroupContainer
              item={item}
              key={`${JSON.stringify(item)}-${idx}`}
              fieldId={fieldId}
              parentItem={parentItem}
              RenderItems={RenderItems}
            />
          );
        } else {
          return (
            <NestedInput
              key={`NI-${JSON.stringify(item)}-${idx}`}
              item={item}
              inputProps={makeFormInputPropsForItem(item)}
              parentItem={props.parentItem}
              inheritedFieldId={fieldId}
            />
          );
        }
      })}
    </>
  );
};

// this probably has a more specific type but not sure what it is right now
const makeStyles = (): any => {
  const signatureFont = 'Dancing Script, Tangerine, Bradley Hand, Brush Script MT, sans-serif';
  return {
    signatureStyles: {
      input: {
        fontFamily: signatureFont,
        fontSize: '20px',
        fontWeight: 500,
      },
      'input::placeholder': {
        fontFamily: signatureFont,
      },
    },
  };
};

interface NestedInputProps extends StyledItemInputProps {
  parentItem?: IntakeQuestionnaireItem;
  inheritedFieldId?: string;
}

const NestedInput: FC<NestedInputProps> = (props) => {
  const { item, inputProps, sx = {}, parentItem, inheritedFieldId } = props;
  const { helperText, showHelperTextIcon } = inputProps || {};
  const { formValues } = useQRState();
  const dependency = item.requireWhen ? formValues[item.requireWhen.question] : undefined;
  const { otherColors } = useIntakeThemeContext();
  const { trigger } = useFormContext();
  const [isFocused, setIsFocused] = useState(false);

  // fieldId returns the path to the scalar value (the thing that the inputs manipulate directly)
  // call site 2: ignores result when no parent item
  //console.log('item, parentItem', item.linkId, parentItem?.linkId, inheritedFieldId);
  const fieldId = getPaperworkFieldId({ item, parentItem, parentFieldId: inheritedFieldId });
  //console.log('linkId, fieldId', item.linkId, fieldId);

  const { hasError, errorMessage } = useFieldError(parentItem ? fieldId : item.linkId);

  useEffect(() => {
    if (hasError && dependency) {
      void trigger(fieldId);
    }
  }, [hasError, dependency, trigger, item.linkId, parentItem, fieldId]);

  return (
    <Grid item xs={12} md={item.width} sx={{ maxWidth: '100%' }}>
      <Controller
        name={fieldId}
        render={(renderProps) => (
          <FormControl
            variant="standard"
            required={item.isRequired}
            error={hasError}
            fullWidth={item.isFullWidth}
            hiddenLabel={true}
            disabled={item.displayStrategy === 'protected'}
            onBlur={() => {
              if (getInputTypeForItem(item) === 'Text') {
                void trigger(fieldId);
              }
              setIsFocused(false);
            }}
            onChange={() => {
              if (hasError) {
                void trigger(fieldId);
              }
            }}
            onFocus={() => setIsFocused(true)}
            margin={'dense'}
            sx={{
              width: '100%',
              ...sx,
              '& .MuiInputBase-root': {
                marginTop: '0px',
              },
            }}
          >
            <BoldPurpleInputLabel
              id={`${item.linkId}-label`}
              htmlFor={`${item.linkId}`}
              sx={(theme) => ({
                ...(item.hideControlLabel ? { display: 'none' } : { whiteSpace: 'pre-wrap', position: 'unset' }),
                color: isFocused ? theme.palette.primary.main : theme.palette.primary.dark,
              })}
            >
              {item.infoText ? (
                <Tooltip enterTouchDelay={0} title={item.infoText} placement="top" arrow>
                  <Box>
                    {item.text}
                    <IconButton>
                      <InfoOutlinedIcon sx={{ fontSize: '18px', color: 'secondary.main' }} />
                    </IconButton>
                  </Box>
                </Tooltip>
              ) : (
                item.text
              )}
            </BoldPurpleInputLabel>
            <FormInputField renderProps={renderProps} itemProps={props} parentItem={parentItem} fieldId={fieldId} />
            {item.secondaryInfoText ? (
              <LightToolTip
                title={item.secondaryInfoText}
                placement="top"
                enterTouchDelay={0}
                backgroundColor={otherColors.toolTipGrey}
                color={otherColors.black}
              >
                <Box
                  sx={{
                    color: otherColors.scheduleBorder,
                    width: 'fit-content',
                    display: 'flex',
                    marginTop: 0.5,
                    cursor: 'default',
                  }}
                >
                  <InfoOutlinedIcon style={{ height: '16px', width: '16px' }} />
                  <Typography sx={{ fontSize: '14px', marginLeft: 0.5 }}>Why do we ask this?</Typography>
                </Box>
              </LightToolTip>
            ) : null}
            <FieldHelperText
              name={fieldId}
              hasError={hasError}
              helperText={helperText}
              showHelperTextIcon={showHelperTextIcon}
              errorMessage={errorMessage}
            />
          </FormControl>
        )}
      />
    </Grid>
  );
};

interface GetFormInputFieldProps {
  itemProps: StyledItemInputProps;
  renderProps: any; // do better
  fieldId: string;
  parentItem?: IntakeQuestionnaireItem;
}

const FormInputField: FC<GetFormInputFieldProps> = ({ itemProps, renderProps, fieldId, parentItem }): ReactElement => {
  const { item, inputProps } = itemProps;
  const { inputBaseProps, inputMode } = inputProps || { disableUnderline: true };
  const {
    field: { value, onChange, ref },
    formState: { defaultValues },
  } = renderProps;
  const inputType = getInputTypeForItem(item);
  const { otherColors } = useIntakeThemeContext();
  const theme = useTheme();
  const myInputComponent = inputBaseProps?.mask ? (InputMask as any) : 'input';

  const { answerLoadingOptions } = item;
  const hasDynamicAnswerOptions = answerLoadingOptions?.strategy === 'dynamic';

  const styles = useMemo(() => {
    return makeStyles();
  }, []);

  const inputSX = useMemo(() => {
    return SIGNATURE_FIELDS.includes(item.linkId)
      ? { ...styles.inputStyles, ...styles.signatureStyles }
      : styles.inputStyles;
  }, [item.linkId, styles.inputStyles, styles.signatureStyles]);

  const {
    onChange: smartOnChange,
    inputRef,
    value: unwrappedValue,
  } = usePaperworkFormHelpers({ item, renderValue: value, renderOnChange: onChange, fieldId });

  const error = useFieldError(fieldId);
  const answerOptions = item.answerOption ?? [];
  const colorForButton = unwrappedValue ? theme.palette.destructive.main : theme.palette.primary.main;
  let attachmentType: AttachmentType = 'image';
  if (item.dataType === 'PDF') {
    attachmentType = 'pdf';
  }
  return (() => {
    switch (inputType) {
      case 'Text':
        return (
          <TextField
            id={fieldId}
            value={unwrappedValue}
            type={getUCInputType(item?.dataType)}
            aria-labelledby={`${item.linkId}-label`}
            aria-describedby={`${item.linkId}-helper-text`}
            inputProps={{
              ...inputBaseProps,
              inputMode:
                inputMode ??
                (item.type === 'integer' || item.type === 'decimal' || item.dataType === 'ZIP' ? 'numeric' : 'text'),
              ...(item.dataType === 'ZIP' && { pattern: '[0-9]*', maxLength: 5 }),
            }}
            placeholder={item.placeholder}
            required={item.required}
            onChange={smartOnChange}
            InputLabelProps={{ shrink: true }}
            InputProps={{
              multiline: item.multiline,
              minRows: item.minRows,
              inputComponent: myInputComponent,
              disabled: item.displayStrategy !== 'enabled',
              ref: parentItem ? ref : inputRef,
              error: error.hasError,
            }}
            // this also overrides explicitly passed in sx in inputProps...
            sx={{
              ...inputSX,
              '.MuiOutlinedInput-root': {
                borderRadius: '8px',
                height: 'auto',
                width: '100%',
                padding: item.minRows ? '12px 16px' : '2px 2px',
                '&.Mui-focused': {
                  boxShadow: '0 -0.5px 0px 3px rgba(77, 21, 183, 0.25)',
                  '& fieldset': {
                    borderWidth: '1px',
                  },
                },
              },
            }}
            size="small"
          />
        );
      case 'Free Select':
      case 'Select':
        if (!item.answerOption && !hasDynamicAnswerOptions) {
          throw new Error('No selectOptions given in select 2');
        }
        return (
          <FreeMultiSelectInput
            name={fieldId}
            disabled={item.displayStrategy !== 'enabled'}
            value={unwrappedValue}
            multiple={item.acceptsMultipleAnswers}
            freeSolo={item.type === 'open-choice'}
            defaultValue={(defaultValues && pickFirstValueFromAnswerItem(defaultValues[item.linkId])) ?? null}
            required={item.required}
            options={item.answerOption ?? []}
            dynamicAnswerOptions={answerLoadingOptions}
            answerValueSet={item.answerValueSet}
            inputRef={ref}
            onChange={smartOnChange}
          />
        );
      case 'Button':
        return (
          <Button
            variant="outlined"
            type="button"
            onClick={smartOnChange}
            sx={{
              color: colorForButton,
              borderColor: colorForButton,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                borderColor: colorForButton,
              },
            }}
          >
            {item.text}
          </Button>
        );
      case 'Checkbox':
        return (
          <FormControlLabel
            label={<Markdown components={{ p: DescriptionRenderer, a: LinkRenderer }}>{item.text}</Markdown>}
            sx={{ pt: item.hideControlLabel ? 0 : 1, alignItems: 'flex-start', margin: '0px' }}
            control={
              <Checkbox
                checked={unwrappedValue}
                color="primary"
                style={{ borderRadius: '4px' }}
                aria-label={`${item.linkId}-label`}
                sx={{
                  alignSelf: 'flex-start',
                  width: '18px',
                  height: '18px',
                  display: 'inline-flex',
                  marginTop: '0px',
                  marginRight: '10px',
                  '&.MuiCheckbox-root': {
                    borderRadius: '4px',
                  },
                  '&.Mui-checked': {
                    color: otherColors.purple,
                    borderRadius: '4px',
                    outline: '1px solid #2169F5',
                  },
                }}
                onChange={smartOnChange}
                required={item.required}
              />
            }
          />
        );
      case 'Radio':
        return (
          <RadioInput
            name={fieldId}
            value={unwrappedValue}
            required={item.required}
            options={answerOptions}
            onChange={smartOnChange}
          />
        );
      case 'Radio List':
        return (
          <RadioListInput
            name={fieldId}
            value={unwrappedValue}
            required={item.required}
            options={answerOptions}
            onChange={smartOnChange}
          />
        );
      case 'Date':
        return (
          <DateInput
            value={unwrappedValue}
            item={item}
            fieldId={parentItem ? fieldId : item.linkId}
            onChange={smartOnChange}
          />
        );
      case 'Attachment':
        return (
          <FileInput
            fileName={item.linkId}
            fieldName={fieldId}
            attachmentType={attachmentType}
            value={unwrappedValue}
            onChange={smartOnChange}
            description={item.attachmentText ?? ''}
            usePaperworkContext={usePaperworkContext}
          />
        );
      case 'Group':
        // will this ever be reached??
        if (item.groupType == QuestionnaireItemGroupType.ListWithForm) {
          return (
            <>
              <MultiAnswerHeader item={item} key={`${fieldId}.group-header`} />
              <RenderItems
                parentItem={item}
                items={item.item ?? []}
                fieldId={fieldId}
                key={`${fieldId}.group-render`}
              />
            </>
          );
        } else {
          return <RenderItems parentItem={item} items={item.item ?? []} fieldId={fieldId} />;
        }
      case 'Credit Card':
        return <CreditCardVerification value={unwrappedValue} onChange={smartOnChange} />;
      default:
        return <></>;
    }
  })();
};

interface FormDisplayFieldProps {
  item: StyledQuestionnaireItem;
}

const FormDisplayField: FC<FormDisplayFieldProps> = ({ item }): ReactElement => {
  const displayType = getInputTypeForItem(item);
  const element = (() => {
    switch (displayType) {
      case 'Header 4':
        return (
          <Box mb={1} key={`form-display-H4-${item.linkId}-${item.text}`}>
            <Typography variant="h4" color="primary">
              {item.text}
            </Typography>
          </Box>
        );
      case 'Header 3':
        return (
          <Box mb={1} key={`form-display-H3-${item.linkId}-${item.text}`}>
            <Typography variant="h3" color="primary">
              {item.text}
            </Typography>
          </Box>
        );
      case 'Description':
        return (
          <Typography
            variant="body1"
            key={`form-display-body1-${item.linkId}-${item.text}`}
            sx={{ paddingBottom: '10px' }}
          >
            {item.text}
          </Typography>
        );
      default:
        return <></>;
    }
  })();
  return (
    <Grid item xs={12} md={item.width} key={`form-display-field-${item.linkId}`} paddingLeft="0px">
      {element}
    </Grid>
  );
};

export default PagedQuestionnaire;
