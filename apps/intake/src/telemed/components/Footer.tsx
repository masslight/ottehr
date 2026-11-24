import { Box } from '@mui/material';
import { FC } from 'react';
import { SupportChatEntry } from 'src/features/support-chat/components/SupportChatEntry';
import { useSupportChatStatus } from 'src/features/support-chat/hooks/useSupportChatStatus';
import {
  closeSupportDialog,
  openSupportDialog,
  useIntakeCommonStore,
} from 'src/telemed/features/common/intake-common.store';
import { ContactSupportDialog } from '../../components/ContactSupportDialog';
import QuestionMarkButton from '../../components/QuestionMarkButton';
import { ContactSupportButton } from './ContactSupportButton';

const Footer: FC = () => {
  const supportDialogOpen = useIntakeCommonStore((state) => state.supportDialogOpen);
  const { isLoading, isEnabled: isSupportChatEnabled } = useSupportChatStatus();

  return (
    <Box sx={{ position: 'sticky', bottom: 0, pointerEvents: 'none' }}>
      {supportDialogOpen && <ContactSupportDialog onClose={closeSupportDialog} />}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          justifyContent: 'flex-end',
          padding: '16px',
          pointerEvents: 'all',
          marginLeft: 'auto',
          width: 'fit-content',
        }}
      >
        {!isLoading &&
          (isSupportChatEnabled ? (
            <>
              <SupportChatEntry />
              <QuestionMarkButton onClick={openSupportDialog} />
            </>
          ) : (
            <ContactSupportButton onClick={openSupportDialog} />
          ))}
      </Box>
    </Box>
  );
};
export default Footer;
