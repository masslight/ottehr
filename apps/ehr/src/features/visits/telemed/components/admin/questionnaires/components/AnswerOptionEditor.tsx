import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Box, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { FC } from 'react';
import { ItemAction } from '../questionnaire.reducer';

interface AnswerOptionEditorProps {
  itemKey: string;
  options: QuestionnaireItemAnswerOption[];
  dispatch: React.Dispatch<ItemAction>;
  /** option codes that are harvest-protected: their code is frozen (label editable, remove blocked) */
  protectedOptionCodes?: ReadonlySet<string>;
}

// the harvested value of an option is its coded `code` when present, else the raw `valueString`
const optionCode = (option: QuestionnaireItemAnswerOption): string | undefined =>
  option.valueCoding?.code ?? option.valueString;

export const AnswerOptionEditor: FC<AnswerOptionEditorProps> = ({
  itemKey,
  options,
  dispatch,
  protectedOptionCodes,
}) => {
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        Answer Options
      </Typography>
      {options.map((option, index) => {
        const currentLabel = option.valueCoding?.display ?? option.valueString ?? '';
        const code = optionCode(option);
        const isProtected = code !== undefined && Boolean(protectedOptionCodes?.has(code));
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
              helperText={isProtected ? `Reported value: ${code} (locked)` : undefined}
              fullWidth
            />
            {isProtected ? (
              <Tooltip title="This option's reported value is required by default paperwork and can't be removed">
                <LockOutlinedIcon fontSize="small" sx={{ color: 'text.disabled', mx: 0.5 }} />
              </Tooltip>
            ) : (
              <IconButton
                size="small"
                color="error"
                onClick={() => dispatch({ type: 'REMOVE_ANSWER_OPTION', key: itemKey, index })}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        );
      })}
      <IconButton size="small" color="primary" onClick={() => dispatch({ type: 'ADD_ANSWER_OPTION', key: itemKey })}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};
