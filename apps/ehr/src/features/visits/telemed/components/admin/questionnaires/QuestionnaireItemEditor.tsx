import AbcIcon from '@mui/icons-material/Abc';
import AddIcon from '@mui/icons-material/Add';
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
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Checkbox,
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
import { AnswerOptionEditor } from './AnswerOptionEditor';
import { ItemAction } from './questionnaire.reducer';
import {
  DATA_TYPES_BY_ITEM_TYPE,
  OTTEHR_INPUT_WIDTHS,
  OttehrDataType,
  QUESTIONNAIRE_ITEM_TYPES,
  QuestionnaireItem,
} from './questionnaire.types';

interface QuestionnaireItemEditorProps {
  item: QuestionnaireItem;
  dispatch: React.Dispatch<ItemAction>;
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

const ItemActions: FC<{ item: QuestionnaireItem; dispatch: React.Dispatch<ItemAction> }> = ({ item, dispatch }) => (
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

const ItemFields: FC<{ item: QuestionnaireItem; dispatch: React.Dispatch<ItemAction> }> = ({ item, dispatch }) => {
  const isChoice = item.type === 'choice' || item.type === 'open-choice';
  const isGroup = item.type === 'group';
  const showMaxLength = item.type === 'string' || item.type === 'text' || item.type === 'url';
  const isDisplay = item.type === 'display';
  const availableDataTypes = (DATA_TYPES_BY_ITEM_TYPE[item.type] || []) as readonly OttehrDataType[];

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
            {QUESTIONNAIRE_ITEM_TYPES.filter((t) => t !== 'group').map((t) => (
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

      {!isDisplay && !isGroup && (
        <>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2 }}>
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
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={item.repeats || false}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_ITEM',
                        key: item._key,
                        field: 'repeats',
                        value: e.target.checked || undefined,
                      })
                    }
                  />
                }
                label="Repeats"
              />
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
              {showMaxLength && (
                <TextField
                  size="small"
                  label="Max Length"
                  type="number"
                  value={item.maxLength || ''}
                  onChange={(e) =>
                    dispatch({
                      type: 'UPDATE_ITEM',
                      key: item._key,
                      field: 'maxLength',
                      value: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
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
                  {w === 's' ? 'Small (1/3)' : w === 'm' ? 'Medium (1/2)' : 'Large (7/12)'}
                </MenuItem>
              ))}
            </Select>
          </Grid>
        </>
      )}

      {isChoice && (
        <Grid item xs={12}>
          <AnswerOptionEditor itemKey={item._key} options={item.answerOption || []} dispatch={dispatch} />
        </Grid>
      )}
    </Grid>
  );
};

export const QuestionnaireItemEditor: FC<QuestionnaireItemEditorProps> = ({ item, dispatch, depth = 0 }) => {
  const isGroup = item.type === 'group';
  const [expanded, setExpanded] = useState(false);

  // Child items render as plain boxes, no accordion
  if (depth > 0) {
    return (
      <Box sx={{ border: '1px solid #999', borderRadius: '6px', p: 1.5, mb: 1, bgcolor: '#F8F9FA' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 0.5 }}>
          <ItemActions item={item} dispatch={dispatch} />
        </Box>
        <ItemFields item={item} dispatch={dispatch} />
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
                      key={child._key || i}
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
        <ItemFields item={item} dispatch={dispatch} />
        {isGroup && (
          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">Page Content</Typography>
              <IconButton
                size="small"
                color="primary"
                onClick={() => dispatch({ type: 'ADD_CHILD_ITEM', key: item._key })}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
            {(item.item || []).map((child) => (
              <QuestionnaireItemEditor key={child._key} item={child} dispatch={dispatch} depth={1} />
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
