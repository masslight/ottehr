import { Box, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { UppercaseCaptionTypography } from 'src/features/visits/shared/components/UppercaseCaptionTypography';
import { SchoolWorkNoteExcuseDocFileDTO } from 'utils';
import { ExcuseLink } from './ExcuseLink';

type ExcuseCardProps = {
  label: string;
  type: 'school' | 'work';
  excuse?: SchoolWorkNoteExcuseDocFileDTO & { presignedUrl?: string };
  isLoading: boolean;
  onDelete: (id: string) => void;
  generateTemplateOpen: (value: boolean) => void;
  generateFreeOpen: (value: boolean) => void;
  disabled?: boolean;
};

export const ExcuseCard: FC<ExcuseCardProps> = (props) => {
  const { label, type, excuse, isLoading, onDelete, generateTemplateOpen, generateFreeOpen, disabled } = props;

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
            data-testid={type === 'school' ? 'school' : 'work'}
          />
          <Typography>
            Generated: {DateTime.fromISO(excuse.date!).toLocaleString(DateTime.DATETIME_SHORT, { locale: 'en-us' })}
          </Typography>
        </>
      )}

      {!excuse && (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <RoundedButton onClick={() => generateTemplateOpen(true)} disabled={isLoading || disabled}>
            Generate to the template
          </RoundedButton>
          <RoundedButton
            onClick={() => generateFreeOpen(true)}
            disabled={isLoading || disabled}
            data-testid={type === 'school' ? 'generate-school-free-button' : 'generate-work-free-button'}
          >
            Free format note
          </RoundedButton>
        </Box>
      )}
    </Box>
  );
};
