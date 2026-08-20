import AbcIcon from '@mui/icons-material/Abc';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LinkIcon from '@mui/icons-material/Link';
import NumbersIcon from '@mui/icons-material/Numbers';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SubjectIcon from '@mui/icons-material/Subject';
import TuneIcon from '@mui/icons-material/Tune';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Collapse,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FC, useState } from 'react';
import {
  DATA_TYPES_BY_ITEM_TYPE,
  OTTEHR_INPUT_WIDTHS,
  type OttehrInputWidth,
  PracticeManagedQuestionnaireItem,
  QUESTIONNAIRE_ITEM_TYPES,
  QuestionnaireItemType,
} from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { ItemAction } from '../questionnaire.reducer';
import { AddFieldControl } from './AddFieldControl';
import { AnswerOptionEditor } from './AnswerOptionEditor';
import { AvailableQuestion, FieldTriggersEditor } from './FieldTriggersEditor';

const WIDTH_LABELS: Record<OttehrInputWidth, string> = {
  s: 'Small (1/3)',
  m: 'Medium (1/2)',
  l: 'Large (7/12)',
};

// preferred-element authoring options per item type. The first option (empty value) is the type's default
// renderer and emits no extension; the rest are the certified alternatives (see PREFERRED_ELEMENTS_BY_ITEM_TYPE
// in utils). Choosing the default clears the field.
const PREFERRED_ELEMENT_OPTIONS: Partial<Record<QuestionnaireItemType, { value: string; label: string }[]>> = {
  choice: [
    { value: '', label: 'Dropdown (default)' },
    { value: 'Radio', label: 'Radio' },
    { value: 'Radio List', label: 'Radio list' },
  ],
  boolean: [
    { value: '', label: 'Checkbox (default)' },
    { value: 'Button', label: 'Button' },
    { value: 'Link', label: 'Link' },
  ],
  display: [
    { value: '', label: 'Header 3 (default)' },
    { value: 'h4', label: 'Header 4' },
    { value: 'p', label: 'Description' },
  ],
};

// The concrete preferred-element value each type renders by default. An item carrying this exact value is
// treated as "default" (shown as the empty option) so it round-trips to a cleared field.
const PREFERRED_ELEMENT_DEFAULT_VALUE: Partial<Record<QuestionnaireItemType, string>> = {
  choice: 'Select',
  display: 'h3',
};

interface QuestionnaireItemEditorProps {
  item: PracticeManagedQuestionnaireItem;
  dispatch: React.Dispatch<ItemAction>;
  availableQuestions: AvailableQuestion[];
  depth?: number;
}

const iconSx = { fontSize: 14 };
const TYPE_ICONS: Record<string, React.ReactNode> = {
  string: <AbcIcon sx={iconSx} />,
  text: <SubjectIcon sx={iconSx} />,
  boolean: <CheckBoxOutlinedIcon sx={iconSx} />,
  choice: <RadioButtonCheckedIcon sx={iconSx} />,
  'open-choice': <RadioButtonCheckedIcon sx={iconSx} />,
  integer: <NumbersIcon sx={iconSx} />,
  decimal: <NumbersIcon sx={iconSx} />,
  quantity: <NumbersIcon sx={iconSx} />,
  date: <CalendarTodayIcon sx={iconSx} />,
  dateTime: <CalendarTodayIcon sx={iconSx} />,
  time: <ScheduleIcon sx={iconSx} />,
  url: <LinkIcon sx={iconSx} />,
  attachment: <AttachFileIcon sx={iconSx} />,
  display: <InfoOutlinedIcon sx={iconSx} />,
  reference: <LinkIcon sx={iconSx} />,
};

const ItemActions: FC<{ item: PracticeManagedQuestionnaireItem; dispatch: React.Dispatch<ItemAction> }> = ({
  item,
  dispatch,
}) => (
  <Box sx={{ display: 'flex', gap: 0.25 }}>
    <Tooltip title="Move up">
      <IconButton size="small" onClick={() => dispatch({ type: 'MOVE_ITEM_UP', key: item._key })}>
        <ArrowUpwardIcon fontSize="small" />
      </IconButton>
    </Tooltip>
    <Tooltip title="Move down">
      <IconButton size="small" onClick={() => dispatch({ type: 'MOVE_ITEM_DOWN', key: item._key })}>
        <ArrowDownwardIcon fontSize="small" />
      </IconButton>
    </Tooltip>
    <Tooltip title="Delete">
      <IconButton size="small" color="error" onClick={() => dispatch({ type: 'REMOVE_ITEM', key: item._key })}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  </Box>
);

const ItemFields: FC<{
  item: PracticeManagedQuestionnaireItem;
  dispatch: React.Dispatch<ItemAction>;
  availableQuestions: AvailableQuestion[];
}> = ({ item, dispatch, availableQuestions }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isChoice = item.type === 'choice' || item.type === 'open-choice';
  const isGroup = item.type === 'group';
  const isDisplay = item.type === 'display';
  const isBoolean = item.type === 'boolean';
  const isAttachment = item.type === 'attachment';
  const isMultilineText = item.type === 'text';
  const isInput = !isDisplay && !isGroup;
  const showMaxLength = item.type === 'string' || item.type === 'text';
  const availableDataTypes = DATA_TYPES_BY_ITEM_TYPE[item.type] || [];
  const preferredElementOptions = PREFERRED_ELEMENT_OPTIONS[item.type] || [];

  // attachment is authored only via grouped fields, so hide it from the basic type dropdown — but keep it
  // selectable-as-current when the item already is an attachment so its Select still shows the value.
  const typeOptions = QUESTIONNAIRE_ITEM_TYPES.filter(
    (t) => t !== 'group' && (t !== 'attachment' || item.type === 'attachment')
  );

  // the default renderer (empty option) also matches an item explicitly carrying the type's default value
  const preferredElementValue =
    item.preferredElement && item.preferredElement !== PREFERRED_ELEMENT_DEFAULT_VALUE[item.type]
      ? item.preferredElement
      : '';
  const disabledDisplayValue = item.disabledDisplay === 'protected' ? 'protected' : '';
  // never let a field auto-fill from itself
  const dynamicPopulationTargets = availableQuestions.filter((q) => q.key !== item._key);

  return (
    <Grid container spacing={1.5}>
      {!isGroup && (
        <Grid item xs={4}>
          <Select
            size="small"
            value={item.type}
            onChange={(e) => dispatch({ type: 'UPDATE_ITEM', key: item._key, field: 'type', value: e.target.value })}
            fullWidth
          >
            {typeOptions.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </Select>
        </Grid>
      )}
      <Grid item xs={isGroup ? 12 : 8}>
        <TextField
          size="small"
          label={isGroup ? 'Page Title' : isDisplay ? 'Display Text' : 'Question Text'}
          value={item.text || ''}
          onChange={(e) => dispatch({ type: 'UPDATE_ITEM', key: item._key, field: 'text', value: e.target.value })}
          fullWidth
        />
      </Grid>

      {isInput && (
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={item.required || false}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_ITEM',
                    key: item._key,
                    field: 'required',
                    value: e.target.checked || undefined,
                  })
                }
              />
            }
            label="Required"
          />
        </Grid>
      )}

      {isChoice && (
        <Grid item xs={12}>
          <AnswerOptionEditor itemKey={item._key} options={item.answerOption || []} dispatch={dispatch} />
        </Grid>
      )}

      {!isGroup && (
        <Grid item xs={12}>
          <Button
            size="small"
            startIcon={<TuneIcon fontSize="small" />}
            onClick={() => setShowAdvanced((v) => !v)}
            sx={{ textTransform: 'none' }}
          >
            {showAdvanced ? 'Hide advanced formatting' : 'Show advanced formatting'}
          </Button>
        </Grid>
      )}

      {!isGroup && (
        <Grid item xs={12} sx={{ pt: '0 !important' }}>
          <Collapse in={showAdvanced} unmountOnExit>
            <Grid container spacing={1.5} sx={{ pt: 1 }}>
              {preferredElementOptions.length > 0 && (
                <Grid item xs={4}>
                  <Select
                    size="small"
                    value={preferredElementValue}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_ITEM',
                        key: item._key,
                        field: 'preferredElement',
                        value: e.target.value || undefined,
                      })
                    }
                    fullWidth
                  >
                    {preferredElementOptions.map((el) => (
                      <MenuItem key={el.value} value={el.value}>
                        {el.label}
                      </MenuItem>
                    ))}
                  </Select>
                </Grid>
              )}

              {isInput && (
                <>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={item.readOnly || false}
                            onChange={(e) =>
                              dispatch({
                                type: 'UPDATE_ITEM',
                                key: item._key,
                                field: 'readOnly',
                                value: e.target.checked || undefined,
                              })
                            }
                          />
                        }
                        label="Read Only"
                      />
                      {isBoolean && (
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={item.hideControlLabel || false}
                              onChange={(e) =>
                                dispatch({
                                  type: 'UPDATE_ITEM',
                                  key: item._key,
                                  field: 'hideControlLabel',
                                  value: e.target.checked || undefined,
                                })
                              }
                            />
                          }
                          label="Hide field label"
                        />
                      )}
                      {showMaxLength && (
                        <TextField
                          size="small"
                          label="Max Length"
                          type="number"
                          value={item.maxLength || ''}
                          inputProps={{ min: 1 }}
                          onKeyDown={(e) => {
                            if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e) => {
                            const parsed = e.target.value ? parseInt(e.target.value) : undefined;
                            if (parsed !== undefined && parsed < 1) {
                              return;
                            }
                            dispatch({
                              type: 'UPDATE_ITEM',
                              key: item._key,
                              field: 'maxLength',
                              value: parsed,
                            });
                          }}
                          sx={{ width: 120 }}
                        />
                      )}
                    </Box>
                  </Grid>

                  {availableDataTypes.length > 0 && (
                    <Grid item xs={4}>
                      <Select
                        size="small"
                        value={item.dataType || ''}
                        onChange={(e) =>
                          dispatch({
                            type: 'UPDATE_ITEM',
                            key: item._key,
                            field: 'dataType',
                            value: e.target.value || undefined,
                          })
                        }
                        displayEmpty
                        fullWidth
                      >
                        <MenuItem value="">No validation</MenuItem>
                        {availableDataTypes.map((dt) => (
                          <MenuItem key={dt} value={dt}>
                            {dt}
                          </MenuItem>
                        ))}
                      </Select>
                    </Grid>
                  )}

                  <Grid item xs={4}>
                    <Select
                      size="small"
                      value={item.inputWidth || ''}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_ITEM',
                          key: item._key,
                          field: 'inputWidth',
                          value: e.target.value || undefined,
                        })
                      }
                      displayEmpty
                      fullWidth
                    >
                      <MenuItem value="">Full width</MenuItem>
                      {OTTEHR_INPUT_WIDTHS.map((w) => (
                        <MenuItem key={w} value={w}>
                          {WIDTH_LABELS[w]}
                        </MenuItem>
                      ))}
                    </Select>
                  </Grid>

                  {isMultilineText && (
                    <Grid item xs={4}>
                      <TextField
                        size="small"
                        label="Min rows (multiline)"
                        type="number"
                        value={item.minRows ?? ''}
                        inputProps={{ min: 1 }}
                        onKeyDown={(e) => {
                          if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const parsed = e.target.value ? parseInt(e.target.value) : undefined;
                          if (parsed !== undefined && parsed < 1) {
                            return;
                          }
                          dispatch({ type: 'UPDATE_ITEM', key: item._key, field: 'minRows', value: parsed });
                        }}
                        fullWidth
                      />
                    </Grid>
                  )}

                  {isAttachment && (
                    <Grid item xs={12}>
                      <TextField
                        size="small"
                        label="Upload instructions"
                        value={item.attachmentText || ''}
                        onChange={(e) =>
                          dispatch({
                            type: 'UPDATE_ITEM',
                            key: item._key,
                            field: 'attachmentText',
                            value: e.target.value || undefined,
                          })
                        }
                        multiline
                        minRows={2}
                        fullWidth
                      />
                    </Grid>
                  )}

                  <Grid item xs={12}>
                    <TextField
                      size="small"
                      label="Info text (tooltip beside the label)"
                      value={item.infoText || ''}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_ITEM',
                          key: item._key,
                          field: 'infoText',
                          value: e.target.value || undefined,
                        })
                      }
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      size="small"
                      label={'Secondary info text ("Why do we ask?")'}
                      value={item.secondaryInfoText || ''}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_ITEM',
                          key: item._key,
                          field: 'secondaryInfoText',
                          value: e.target.value || undefined,
                        })
                      }
                      fullWidth
                    />
                  </Grid>

                  <Grid item xs={6}>
                    <Select
                      size="small"
                      value={disabledDisplayValue}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_ITEM',
                          key: item._key,
                          field: 'disabledDisplay',
                          value: e.target.value || undefined,
                        })
                      }
                      displayEmpty
                      fullWidth
                    >
                      <MenuItem value="">When hidden by a trigger: Hidden (default)</MenuItem>
                      <MenuItem value="protected">When hidden by a trigger: Protected (read-only)</MenuItem>
                    </Select>
                  </Grid>
                  <Grid item xs={6}>
                    <Select
                      size="small"
                      value={
                        dynamicPopulationTargets.some((q) => q.linkId === item.dynamicPopulation?.sourceLinkId)
                          ? item.dynamicPopulation!.sourceLinkId
                          : ''
                      }
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_ITEM',
                          key: item._key,
                          field: 'dynamicPopulation',
                          value: e.target.value ? { sourceLinkId: e.target.value } : undefined,
                        })
                      }
                      displayEmpty
                      fullWidth
                    >
                      <MenuItem value="">Auto-fill from another field: none</MenuItem>
                      {dynamicPopulationTargets.map((q) => (
                        <MenuItem key={q.key} value={q.linkId}>
                          Auto-fill from: {q.text || q.linkId}
                        </MenuItem>
                      ))}
                    </Select>
                  </Grid>
                  {item.dynamicPopulation && (
                    <Grid item xs={12} sx={{ pt: '0 !important' }}>
                      <Typography variant="caption" color="text.secondary">
                        Auto-fill only copies while the field is hidden or protected — pair it with a trigger that hides
                        this field (and a "Protected" display if you want the value shown read-only).
                      </Typography>
                    </Grid>
                  )}
                </>
              )}

              <Grid item xs={12}>
                <FieldTriggersEditor item={item} dispatch={dispatch} availableQuestions={availableQuestions} />
              </Grid>
            </Grid>
          </Collapse>
        </Grid>
      )}
    </Grid>
  );
};

export const QuestionnaireItemEditor: FC<QuestionnaireItemEditorProps> = ({
  item,
  dispatch,
  availableQuestions,
  depth = 0,
}) => {
  const isGroup = item.type === 'group';
  const [expanded, setExpanded] = useState(false);

  // Child items render as plain boxes, no accordion
  if (depth > 0) {
    return (
      <Box sx={{ border: '1px solid #999', borderRadius: '6px', p: 1.5, mb: 1, bgcolor: '#F8F9FA' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 0.5 }}>
          <ItemActions item={item} dispatch={dispatch} />
        </Box>
        <ItemFields item={item} dispatch={dispatch} availableQuestions={availableQuestions} />
      </Box>
    );
  }

  // Pages render with accordion
  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      TransitionProps={{ unmountOnExit: true, mountOnEnter: true }}
      sx={{
        '&:before': { display: 'none' },
        border: '1px solid #1976d2',
        borderRadius: '8px !important',
        boxShadow: 'none',
        mb: 1.5,
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{ '& .MuiAccordionSummary-content': { minWidth: 0, overflow: 'hidden' } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', minWidth: 0, mr: 1 }}>
          {!expanded && (
            <Box sx={{ flexGrow: 1, minWidth: 0, overflow: 'hidden' }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                }}
              >
                {item.text || '(untitled)'}
              </Typography>
              {isGroup && (item.item?.length ?? 0) > 0 && (
                <Box sx={{ ml: 1, mt: 0.5 }}>
                  {item.item!.map((child, i) => (
                    <Typography
                      // key={child._key || i}
                      key={i}
                      variant="caption"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', lineHeight: 1.8 }}
                    >
                      {TYPE_ICONS[child.type] || TYPE_ICONS.string}
                      {child.text || '(untitled)'}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}
          {expanded && <Box sx={{ flexGrow: 1 }} />}
          <Box onClick={(e) => e.stopPropagation()}>
            <ItemActions item={item} dispatch={dispatch} />
          </Box>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <ItemFields item={item} dispatch={dispatch} availableQuestions={availableQuestions} />
        {isGroup && (
          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">Page Content</Typography>
              <AddFieldControl pageKey={item._key} dispatch={dispatch} />
            </Box>
            {(item.item || []).map((child) => (
              <QuestionnaireItemEditor
                key={child._key}
                item={child}
                dispatch={dispatch}
                availableQuestions={availableQuestions}
                depth={1}
              />
            ))}
            {(!item.item || item.item.length === 0) && (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                No items on this page yet. Click + to add one.
              </Typography>
            )}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
};
