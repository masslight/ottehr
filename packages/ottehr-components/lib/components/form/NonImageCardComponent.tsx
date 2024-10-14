import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { Box, IconButton, Link } from '@mui/material';
import React, { FC, useContext } from 'react';
import { useFormContext } from 'react-hook-form';
import { IntakeThemeContext } from '../../contexts';

interface NonImageCardComponentProps {
  name: string;
  fileName?: string;
  fileUrl?: string;
  setPreviewUrl: (previewUrl: string | null) => void;
  setFileUrl: (fileUrl: string | undefined) => void;
  onClear: () => void;
}

const NonImageCardComponent: FC<NonImageCardComponentProps> = ({
  name,
  fileName,
  fileUrl,
  setPreviewUrl,
  setFileUrl,
  onClear,
}): JSX.Element => {
  const { setValue } = useFormContext();
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
          setValue(name, '');
          setPreviewUrl(null);
          setFileUrl(undefined);
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
