import { ReactElement, useState } from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { GenericToolTip } from './GenericToolTip';

interface CopyButtonProps {
  text: string;
}

const CopyButton = ({ text }: CopyButtonProps): ReactElement => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <GenericToolTip
      title={copied ? 'Copied' : 'Copy'}
      sx={{
        width: '65px',
        textAlign: 'center',
      }}
      placement="top"
    >
      <ContentCopyIcon
        color="primary"
        sx={{
          width: '18px',
          height: '18px',
          cursor: 'pointer',
        }}
        onClick={handleCopy}
      />
    </GenericToolTip>
  );
};

export default CopyButton;
