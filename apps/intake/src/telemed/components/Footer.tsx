import { Box } from '@mui/material';
import { FC } from 'react';
import { useIntakeCommonStore } from 'src/telemed/features/common/intake-common.store';
import { ContactSupportDialog } from '../../components/ContactSupportDialog';
import { ContactSupportButton } from './ContactSupportButton';

const Footer: FC = () => {
  const supportDialogOpen = useIntakeCommonStore((state) => state.supportDialogOpen);
  return (
    <Box sx={{ position: 'sticky', bottom: 0, pointerEvents: 'none' }}>
      {supportDialogOpen && (
        <ContactSupportDialog onClose={() => useIntakeCommonStore.setState({ supportDialogOpen: false })} />
      )}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '16px',
          pointerEvents: 'all',
          marginLeft: 'auto',
          width: 'fit-content',
        }}
      >
        <ContactSupportButton onClick={() => useIntakeCommonStore.setState({ supportDialogOpen: true })} />
      </Box>
    </Box>
  );
};
export default Footer;
