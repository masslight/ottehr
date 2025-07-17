import { ButtonBase, CircularProgress } from '@mui/material';
import { FC, useCallback, useState } from 'react';
import { getOrCreateVisitLabel } from 'src/api/api';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { useApiClients } from 'src/hooks/useAppClients';

const PrintDisabledOutlined: FC = () => {
  return (
    <svg width="23" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M1.41 1.6 0 3.01 5 8c-1.66 0-3 1.34-3 3v6h4v4h12l2.95 2.96 1.41-1.41zM6 15H4v-4c0-.55.45-1 1-1h2l3 3H6zm2 4v-4h4l4 4zM8 5h8v3h-5.34l2 2H19c.55 0 1 .45 1 1v4l-2 .01V13h-2.34l4 4H22v-6c0-1.66-1.34-3-3-3h-1V3H6v.36l2 2z"
        fill="currentColor"
      />
      <circle cx="18" cy="11.51" r="1" fill="currentColor" />
    </svg>
  );
};

const PrintOutlined: FC = () => {
  return (
    <svg width="22" height="21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3M8 5h8v3H8zm8 12v2H8v-4h8zm2-2v-2H6v2H4v-4c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v4z"
        fill="currentColor"
      />
      <circle cx="18" cy="11.51" r="1" fill="currentColor" />
    </svg>
  );
};

type Props = {
  encounterId?: string;
};

export const PrintVisitLabelButton: FC<Props> = ({ encounterId }) => {
  const { oystehrZambda } = useApiClients();

  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleClick = useCallback(async (): Promise<void> => {
    if (!encounterId) {
      console.warn('cannot print label because encounterId is undefined');
      return;
    }

    setLoading(true);

    if (oystehrZambda === undefined) {
      console.error('oystehr client undefined. cannot fetch label');
      setIsError(true);
      return;
    }

    const labelPdfs = await getOrCreateVisitLabel(oystehrZambda, { encounterId });

    if (labelPdfs.length !== 1) {
      console.error('Expected 1 label pdf, received unexpected number', JSON.stringify(labelPdfs));
      setIsError(true);
    }

    const labelPdf = labelPdfs[0];
    window.open(labelPdf.presignedURL, '_blank');

    setLoading(false);
  }, [encounterId, oystehrZambda]);

  const tooltipText = isError ? 'An error occurred' : 'Print label';
  const icon = loading ? <CircularProgress size="15px" /> : isError ? <PrintDisabledOutlined /> : <PrintOutlined />;

  return (
    <GenericToolTip
      title={tooltipText}
      customWidth="none"
      placement="top"
      leaveDelay={100}
      slotProps={{
        tooltip: {
          sx: {
            maxWidth: 150,
            backgroundColor: '#F9FAFB',
            color: '#000000',
            border: '1px solid #dadde9',
          },
        },
        popper: {
          modifiers: [{ name: 'offset', options: { offset: [0, -14] } }],
        },
      }}
    >
      <ButtonBase
        onClick={handleClick}
        disabled={isError}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#0F347C',
        }}
      >
        {icon}
      </ButtonBase>
    </GenericToolTip>
  );
};
