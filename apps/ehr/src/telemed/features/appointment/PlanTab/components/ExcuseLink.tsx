import { otherColors } from '@ehrTheme/colors';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { Card, Typography, useTheme } from '@mui/material';
import React, { FC } from 'react';
import { Link } from 'react-router-dom';
import { DeleteIconButton } from '../../../../components';

type ExcuseCardProps = {
  label: string;
  to: string;
  onDelete?: () => void;
  disabled?: boolean;
};

export const ExcuseLink: FC<ExcuseCardProps> = (props) => {
  const { label, to, onDelete, disabled } = props;
  const theme = useTheme();

  return (
    <Card
      elevation={0}
      sx={{
        py: 1,
        px: 2,
        backgroundColor: otherColors.apptHover,
        display: 'flex',
        gap: 1,
        alignItems: 'center',
        color: theme.palette.primary.main,
        width: '100%',
        textDecoration: 'none',
      }}
      component={Link}
      to={to}
      target="_blank"
    >
      <InsertDriveFileOutlinedIcon fontSize="small" />
      <Typography sx={{ flexGrow: 1 }} fontWeight={500}>
        {label}
      </Typography>
      {onDelete && (
        <DeleteIconButton
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }}
          disabled={disabled}
        />
      )}
    </Card>
  );
};
