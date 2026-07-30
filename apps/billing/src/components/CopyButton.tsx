import { Check as CheckIcon, ContentCopy as ContentCopyIcon } from '@mui/icons-material';
import { ButtonBase } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, ReactNode, useEffect, useRef, useState } from 'react';

const COPIED_FEEDBACK_MS = 2000;

interface CopyButtonProps {
  value: string;
  label: string;
  children?: ReactNode;
}

export function CopyButton({ value, label, children }: CopyButtonProps): ReactElement {
  const [copied, setCopied] = useState(false);
  const revertTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(revertTimeout.current), []);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(revertTimeout.current);
      revertTimeout.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch (error) {
      console.error('Failed to copy to clipboard', error);
      enqueueSnackbar(`Could not copy ${label} to clipboard`, {
        variant: 'error',
      });
    }
  };

  return (
    <ButtonBase
      disableRipple
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      onClick={() => void handleCopy()}
      sx={{
        display: 'flex',
        justifyContent: 'flex-start',
        width: 'fit-content',
        gap: 0.5,
        borderRadius: 1,
      }}
    >
      {children}
      {copied ? (
        <CheckIcon
          sx={{
            fontSize: 14,
            color: 'success.main',
          }}
        />
      ) : (
        <ContentCopyIcon sx={{ fontSize: 14 }} />
      )}
    </ButtonBase>
  );
}
