import { ChangeEvent, FC, ReactNode } from 'react';
import { Box, Button, useTheme } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import { otherColors } from '../IntakeThemeProvider';

interface UploadComponentProps {
  name: string;
  defaultValue?: string;
  uploadDescription: ReactNode;
  handleFileUpload: (event: ChangeEvent<HTMLInputElement>) => string | null;
}

const UploadComponent: FC<UploadComponentProps> = ({
  name,
  defaultValue,
  uploadDescription,
  handleFileUpload,
}): JSX.Element => {
  const theme = useTheme();
  const { control } = useFormContext();

  return (
    <Box
      sx={{
        height: 260,
        border: `1px dashed ${theme.palette.primary.main}`,
        borderRadius: 2,
        display: 'flex',
        background: otherColors.cardBackground,
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        justifyContent: 'center',
        gap: 1,
        px: 4,
        mb: 2,
      }}
    >
      {uploadDescription}
      <Button component="label" variant="contained" sx={{ textTransform: 'none', mt: 2 }}>
        Upload
        <Controller
          name={name}
          control={control}
          defaultValue={defaultValue}
          render={({ field: { value, onChange, ...field } }) => {
            return (
              <input
                {...field}
                value={value?.filename}
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                hidden
                disabled={false}
                onChange={(e) => onChange(handleFileUpload(e))}
              />
            );
          }}
        />
      </Button>
    </Box>
  );
};

export default UploadComponent;
