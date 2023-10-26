import { Box, Button, useTheme } from '@mui/material';
import { ChangeEvent, FC, ReactNode } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { otherColors } from '../OttehrThemeProvider';

interface UploadComponentProps {
  defaultValue?: string;
  handleFileUpload: (event: ChangeEvent<HTMLInputElement>) => string | null;
  name: string;
  uploadDescription: ReactNode;
}

export const UploadComponent: FC<UploadComponentProps> = ({
  defaultValue,
  handleFileUpload,
  name,
  uploadDescription,
}): JSX.Element => {
  const theme = useTheme();
  const { control } = useFormContext();

  return (
    <Box
      sx={{
        alignItems: 'center',
        background: otherColors.cardBackground,
        border: `1px dashed ${theme.palette.primary.main}`,
        borderRadius: 2,
        flexDirection: 'column',
        display: 'flex',
        gap: 1,
        height: 260,
        justifyContent: 'center',
        mb: 2,
        px: 4,
        textAlign: 'center',
      }}
    >
      {uploadDescription}
      <Button component="label" variant="contained" sx={{ mt: 2, textTransform: 'none' }}>
        Upload
        <Controller
          control={control}
          defaultValue={defaultValue}
          name={name}
          render={({ field: { onChange, value, ...field } }) => {
            return (
              <input
                {...field}
                accept="image/png, image/jpeg, image/jpg"
                disabled={false}
                hidden
                onChange={(e) => onChange(handleFileUpload(e))}
                type="file"
                value={value?.filename}
              />
            );
          }}
        />
      </Button>
    </Box>
  );
};
