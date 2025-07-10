import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { Box, IconButton, Link } from '@mui/material';
import { FC, useContext } from 'react';
import { IntakeThemeContext } from '../../../../contexts';

interface NonImageCardComponentProps {
  fileName?: string;
  fileUrl?: string;
  onClear: () => void;
}

const NonImageCardComponent: FC<NonImageCardComponentProps> = ({ fileName, fileUrl, onClear }): JSX.Element => {
  // const { setValue } = useFormContext();
  const { otherColors } = useContext(IntakeThemeContext);

  return (
    <Box
      sx={{
        px: 2,
        py: 0.25,
        backgroundColor: otherColors.toolTipGrey,
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
          color: otherColors.clearImage,
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
