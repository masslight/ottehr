import React, { FC, useState } from 'react';
import { Box, Popover, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { DateTime } from 'luxon';
import { SchoolWorkNoteExcuseDocFileDTO } from 'ehr-utils';
import { RoundedButton, UppercaseCaptionTypography } from '../../../../components';
import { ExcuseLink } from './ExcuseLink';

type ExcuseCardProps = {
  label: string;
  excuse?: SchoolWorkNoteExcuseDocFileDTO & { presignedUrl?: string };
  isLoading: boolean;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
  generateTemplateOpen: (value: boolean) => void;
  generateFreeOpen: (value: boolean) => void;
  disabled?: boolean;
};

export const ExcuseCard: FC<ExcuseCardProps> = (props) => {
  const { label, excuse, isLoading, onDelete, onPublish, generateTemplateOpen, generateFreeOpen, disabled } = props;

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handlePopoverClose = (): void => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <UppercaseCaptionTypography>{label}</UppercaseCaptionTypography>

      {excuse && (
        <>
          <ExcuseLink
            label={excuse.name!}
            to={excuse.presignedUrl!}
            onDelete={disabled ? undefined : () => onDelete(excuse.id)}
            disabled={isLoading}
          />
          <Typography>
            Generated: {DateTime.fromISO(excuse.date!).toLocaleString(DateTime.DATETIME_SHORT, { locale: 'en-us' })}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'end' }}>
            <Box
              onMouseEnter={handlePopoverOpen}
              onMouseLeave={handlePopoverClose}
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <InfoOutlinedIcon color="primary" />
            </Box>
            <RoundedButton
              variant="contained"
              disabled={excuse.published || isLoading || disabled}
              onClick={() => onPublish(excuse.id)}
            >
              {excuse.published ? 'Published' : 'Publish now'}
            </RoundedButton>
          </Box>
          <Popover
            sx={{
              pointerEvents: 'none',
            }}
            open={open}
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'center',
            }}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
            onClose={handlePopoverClose}
            disableRestoreFocus
          >
            <Typography sx={{ p: 2, width: '300px' }}>
              Optional - you can publish note now or it will publish automatically after you review and sign visit note
            </Typography>
          </Popover>
        </>
      )}

      {!excuse && (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <RoundedButton onClick={() => generateTemplateOpen(true)} disabled={isLoading || disabled}>
            Generate to the template
          </RoundedButton>
          <RoundedButton onClick={() => generateFreeOpen(true)} disabled={isLoading || disabled}>
            Free format note
          </RoundedButton>
        </Box>
      )}
    </Box>
  );
};
