import { NotificationsOutlined } from '@mui/icons-material';
import { alpha, Badge, Box, Button, Menu, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { EventHandler, FC, memo, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButtonContained } from 'src/features/visits/shared/components/IconButtonContained';
import {
  getProviderNotificationSettingsForPractitioner,
  ProviderNotificationMethod,
  ProviderNotificationSettings,
} from 'utils';
import useEvolveUser from '../../hooks/useEvolveUser';
import { useGetProviderNotifications, useUpdateProviderNotificationsMutation } from './notifications.queries';
import { useProviderNotificationsStore } from './notifications.store';

const MAX_NOTIFICATION_MESSAGE_LENGTH = 140;

type ProviderNotificationDisplay = {
  id: string;
  message: string;
  isUnread: boolean;
  link?: string;
  sent: string;
  timestamp?: string;
};

export const ProviderNotifications: FC = memo(() => {
  const theme = useTheme();
  const user = useEvolveUser();
  const navigate = useNavigate();
  const { data: notificationsData } = useGetProviderNotifications();
  const updateNotifications = useUpdateProviderNotificationsMutation();
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const {
    method: notificationMethod,
    taskNotificationsEnabled,
    telemedNotificationsEnabled,
  }: ProviderNotificationSettings = useMemo(
    () =>
      getProviderNotificationSettingsForPractitioner(user?.profileResource) || {
        method: ProviderNotificationMethod['phone and computer'],
        taskNotificationsEnabled: false,
        telemedNotificationsEnabled: false,
      },
    [user?.profileResource]
  );

  const notifications: ProviderNotificationDisplay[] = useMemo(() => {
    return (
      notificationsData?.map<ProviderNotificationDisplay>((notification) => {
        // if isUnread play sound
        // notificationAudio.play().catch((error) => console.log(error));
        return {
          id: notification.communication.id!,
          isUnread: notification.communication.status === 'in-progress',
          message: notification.communication.payload?.[0]?.contentString || '',
          sent: notification.communication.sent
            ? DateTime.fromISO(notification.communication.sent).toRelative()!
            : 'N/A',
          timestamp: notification.communication.sent,
          link: notification.appointmentID ? `/visit/${notification.appointmentID}` : undefined,
        };
      }) || []
    ).sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return b.timestamp.localeCompare(a.timestamp);
    });
  }, [notificationsData]);

  const hasUnread = notifications.some((notification) => notification.isUnread);

  useEffect(() => {
    useProviderNotificationsStore.setState({
      notificationMethod,
      taskNotificationsEnabled,
      telemedNotificationsEnabled,
    });
  }, [notificationMethod, taskNotificationsEnabled, telemedNotificationsEnabled]);

  const handleIconButtonClick: EventHandler<MouseEvent<HTMLElement>> = useCallback(() => {
    setNotificationsOpen(true);
    if (hasUnread) {
      void updateNotifications.mutateAsync({
        ids: notifications.filter((notification) => notification.isUnread).map((notification) => notification.id),
        status: 'completed',
      });
    }
  }, [hasUnread, notifications, updateNotifications]);

  const IconButton = (
    <IconButtonContained
      ref={anchorRef}
      id="notifications-button"
      sx={{ marginRight: { sm: 0, md: 2 } }}
      aria-controls="notifications-menu"
      aria-haspopup="true"
      variant="primary.lightest"
      aria-expanded={notificationsOpen ? 'true' : undefined}
      onClick={handleIconButtonClick}
    >
      <NotificationsOutlined sx={{ color: theme.palette.primary.main }} />
    </IconButtonContained>
  );

  return (
    <>
      <Badge
        variant="dot"
        color="warning"
        invisible={!hasUnread}
        sx={{
          '& .MuiBadge-badge': {
            width: '10px',
            height: '10px',
            borderRadius: '10px',
            top: '6px',
            right: '21px',
          },
        }}
      >
        {IconButton}
      </Badge>
      <Menu
        id="notifications-menu"
        anchorEl={anchorRef.current}
        open={notificationsOpen}
        onClose={() => {
          setNotificationsOpen(false);
        }}
        MenuListProps={{
          'aria-labelledby': 'notifications-button',
        }}
      >
        <Box sx={{ p: 3, maxWidth: '400px' }}>
          <Typography sx={{ fontWeight: 'bold' }} variant="h5" color="primary.dark">
            Notifications
          </Typography>
          {notifications
            ? notifications.map((notification) => (
                <MenuItem
                  cursor={notification.link ? 'pointer' : 'default'}
                  title={notification.message}
                  subtitle={notification.sent}
                  key={`notification-link-${notification.id}`}
                  onClick={() => {
                    if (notification.link) {
                      navigate(notification.link);
                    }
                  }}
                />
              ))
            : 'Loading...'}
        </Box>
      </Menu>
    </>
  );
});

interface MenuItemProps {
  onClick?: () => void;
  cursor: 'pointer' | 'default';
  title: string;
  subtitle: string;
}

const MenuItem = ({ onClick, title, subtitle }: MenuItemProps): JSX.Element => {
  const theme = useTheme();

  const titleColor = theme.palette.getContrastText(theme.palette.background.default);
  return (
    <Button
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 2,
        backgroundColor: 'background.default',
        py: 1,
        px: 2,
        mt: 1,
        cursor: 'pointer',
        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) },
      }}
      onClick={onClick}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'start', textTransform: 'none' }}>
        <Typography variant="body1" color={titleColor}>
          {title.length > MAX_NOTIFICATION_MESSAGE_LENGTH
            ? title.substring(0, MAX_NOTIFICATION_MESSAGE_LENGTH) + '...'
            : title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" sx={{ mt: 1 }} color={alpha(titleColor, 0.5)}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Button>
  );
};
