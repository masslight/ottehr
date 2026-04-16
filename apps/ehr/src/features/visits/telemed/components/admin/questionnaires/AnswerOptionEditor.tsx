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
      {options.map((option, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <TextField
            size="small"
            value={option.valueString || ''}
            onChange={(e) =>
              dispatch({
                type: 'UPDATE_ANSWER_OPTION',
                key: itemKey,
                index,
                option: { ...option, valueString: e.target.value },
              })
            }
            placeholder={`Option ${index + 1}`}
            fullWidth
          />
          <IconButton size="small" onClick={() => dispatch({ type: 'REMOVE_ANSWER_OPTION', linkId, index })}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <IconButton size="small" color="primary" onClick={() => dispatch({ type: 'ADD_ANSWER_OPTION', key: itemKey })}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};
