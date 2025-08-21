import { otherColors } from '@ehrTheme/colors';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import { Typography, useTheme } from '@mui/material';
import { Stack } from '@mui/system';

type Props = {
  title: string;
  text: string;
};

export const WarningBlock: React.FC<Props> = ({ title, text }) => {
  const theme = useTheme();
  return (
    <Stack
      style={{
        background: otherColors.lightErrorBg,
        padding: '16px',
        borderRadius: '4px',
        width: '100%',
      }}
      alignItems="center"
      direction="row"
    >
      <ErrorOutlineOutlined style={{ width: '20px', height: '20px', color: theme.palette.error.main }} />
      <Typography variant="body2" style={{ color: otherColors.lightErrorText, marginLeft: '12px' }} display="inline">
        <span style={{ fontWeight: '500' }}>{title}: </span>
        {text}
      </Typography>
    </Stack>
  );
};
