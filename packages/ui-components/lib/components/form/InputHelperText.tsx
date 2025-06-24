import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, FormHelperText, Typography } from '@mui/material';
import { FC } from 'react';
import { FieldErrors } from 'react-hook-form';

type InputHelperTextProps = {
  name: string;
  errors: FieldErrors;
  helperText?: string;
  showHelperTextIcon?: boolean;
  textColor?: string;
};

// this is a somewhat hacky way of bubbling up errors from deeply nested fields to be displayed on the root field's error label
const recursiveFindError = (errorObj: any): string => {
  let error = errorObj?.message;
  // console.log('error recurs', error);

  if (!error && errorObj && Object.keys(errorObj).length > 0) {
    // one of the valueType fields has an error
    Object.values(errorObj).forEach((obj) => {
      const newError = recursiveFindError(obj);
      if (newError) {
        error = newError;
      }
    });
  }
  return typeof error === 'string' ? error : '';
};

export const InputHelperText: FC<InputHelperTextProps> = ({
  name,
  errors,
  helperText,
  showHelperTextIcon = true,
  textColor,
}) => {
  const errorMessage: string = (() => {
    const errorObject = errors[name] as any;
    if (errorObject) {
      return recursiveFindError(errorObject);
    } else {
      return '';
    }
  })();

  return (
    <Box>
      <FormHelperText id={`${name}-helper-text`} sx={{ color: textColor, gap: 0, mt: 1 }}>
        {errorMessage ?? ''}
      </FormHelperText>
      {helperText && (
        <Box display="flex">
          {showHelperTextIcon && (
            <InfoOutlinedIcon
              sx={{ fontSize: '18px', color: 'info.main', verticalAlign: 'bottom', paddingRight: '4px' }}
            />
          )}
          <Typography variant="caption" color="text.primary">
            {helperText}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
