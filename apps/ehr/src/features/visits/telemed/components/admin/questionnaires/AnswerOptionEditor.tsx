import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { Box, IconButton, TextField, Typography } from '@mui/material';
import { FC } from 'react';
import { ItemAction } from './questionnaire.reducer';
import { QuestionnaireAnswerOption } from './questionnaire.types';

interface AnswerOptionEditorProps {
  itemKey: string;
  options: QuestionnaireAnswerOption[];
  dispatch: React.Dispatch<ItemAction>;
}

export const AnswerOptionEditor: FC<AnswerOptionEditorProps> = ({ itemKey, options, dispatch }) => {
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        Answer Options
      </Typography>
      {options.map((option, index) => {
        const currentLabel = option.valueCoding?.display ?? option.valueString ?? '';
        const handleChange = (newLabel: string): void => {
          const next = option.valueCoding
            ? { ...option, valueCoding: { ...option.valueCoding, display: newLabel } }
            : { ...option, valueString: newLabel };
          dispatch({ type: 'UPDATE_ANSWER_OPTION', key: itemKey, index, option: next });
        };
        return (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <TextField
              size="small"
              value={currentLabel}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={`Option ${index + 1}`}
              fullWidth
            />
            <IconButton size="small" onClick={() => dispatch({ type: 'REMOVE_ANSWER_OPTION', key: itemKey, index })}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}
      <IconButton size="small" color="primary" onClick={() => dispatch({ type: 'ADD_ANSWER_OPTION', key: itemKey })}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};
