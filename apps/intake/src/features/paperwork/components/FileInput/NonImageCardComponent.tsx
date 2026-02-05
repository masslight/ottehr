import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { Box, IconButton, Link } from '@mui/material';
import { palette } from '@theme/colors';
import { FC } from 'react';

interface NonImageCardComponentProps {
  fileName?: string;
  fileUrl?: string;
  onClear: () => void;
}

const NonImageCardComponent: FC<NonImageCardComponentProps> = ({ fileName, fileUrl, onClear }): JSX.Element => {
  // const { setValue } = useFormContext();

  return (
    <Box
      sx={{
        px: 2,
        py: 0.25,
        backgroundColor: palette.tertiary.contrast,
        borderRadius: 2,
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}
    >
      <Link href={fileUrl} target="_blank">
        {fileName}
      </Link>
      <IconButton
        aria-label="remove-attachment"
        onClick={() => {
          onClear();
        }}
        sx={{
          color: palette.destructive.main,
          px: 0,
          '&:hover': { backgroundColor: 'transparent' },
        }}
      >
        <DeleteForeverIcon />
      </IconButton>
    </Box>
  );
};

export default NonImageCardComponent;
