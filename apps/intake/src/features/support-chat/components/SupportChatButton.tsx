import LiveHelpOutlinedIcon from '@mui/icons-material/LiveHelpOutlined';
import { Badge, Button, Typography } from '@mui/material';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { dataTestIds } from '../../../helpers/data-test-ids';
import { openSupportChat } from '../support-chat.store';

export const SupportChatButton: FC<{ hasUnread: boolean }> = ({ hasUnread }) => {
  const { t } = useTranslation();
  return (
    <Badge
      variant="dot"
      color="warning"
      invisible={!hasUnread}
      overlap="rectangular"
      sx={{
        '& .MuiBadge-badge': {
          width: 14,
          height: 14,
          borderRadius: '50%',
          border: '2px solid white',
          top: 4,
          right: 4,
        },
      }}
    >
      <Button
        variant="contained"
        color="secondary"
        startIcon={<LiveHelpOutlinedIcon />}
        onClick={openSupportChat}
        data-testid={dataTestIds.supportChatButton}
        sx={{ borderRadius: '100px', px: 2, py: 1, boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)' }}
      >
        <Typography variant="body2" fontWeight={500}>
          {t('supportChat.button')}
        </Typography>
      </Button>
    </Badge>
  );
};
