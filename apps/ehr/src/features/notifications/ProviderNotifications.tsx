import { notificationSound } from '@ehrTheme/index';
import { NotificationsOutlined } from '@mui/icons-material';
import { alpha, Badge, Box, Button, Menu, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { EventHandler, FC, memo, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getProviderNotificationSettingsForPractitioner,
  ProviderNotificationMethod,
  ProviderNotificationSettings,
} from 'utils';
import useEvolveUser from '../../hooks/useEvolveUser';
import { IconButtonContained } from '../../telemed/components/IconButtonContained';
import { useGetProviderNotifications, useUpdateProviderNotificationsMutation } from './notifications.queries';
import { useProviderNotificationsStore } from './notifications.store';

type ProviderNotificationDisplay = {
  id: string;
  message: string;
  isUnread: boolean;
  link?: string;
  sent: string;
};

export const ProviderNotifications: FC = memo(() => {
  const audioRef = useRef(new Audio(notificationSound));
  const theme = useTheme();
  const user = useEvolveUser();
  const navigate = useNavigate();
  const { data: notificationsData } = useGetProviderNotifications();
  const updateNotifications = useUpdateProviderNotificationsMutation();
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [notificationsElement, setNotificationsElement] = useState<undefined | HTMLElement>(undefined);

  const { enabled: notificationsEnabled, method: notificationMethod }: ProviderNotificationSettings = useMemo(
    () =>
      getProviderNotificationSettingsForPractitioner(user?.profileResource) || {
        method: ProviderNotificationMethod['phone and computer'],
        enabled: false,
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
          link: notification.appointmentID ? `/telemed/appointments/${notification.appointmentID}` : undefined,
        };
      }) || []
    ).sort((a, b) => (a.sent && b.sent && DateTime.fromISO(a.sent) > DateTime.fromISO(b.sent) ? -1 : 0));
  }, [notificationsData]);

  const hasUnread = notifications.some((notification) => notification.isUnread);

  useEffect(() => {
    useProviderNotificationsStore.setState({ notificationsEnabled, notificationMethod: notificationMethod });
  }, [notificationsEnabled, notificationMethod]);

  const notify =
    notificationsEnabled &&
    hasUnread &&
    (notificationMethod === ProviderNotificationMethod.computer ||
      notificationMethod === ProviderNotificationMethod['phone and computer']);

  useEffect(() => {
    const audio = audioRef.current;

    if (notify) {
      // Check if the audio is not already playing
      if (audio.paused) {
        void audio.play();
      }
    }

    // Cleanup function to pause the audio if the component unmounts
    return () => {
      audio.pause();
    };
  }, [notify]);

  const handleIconButtonClick: EventHandler<MouseEvent<HTMLElement>> = (event) => {
    setNotificationsOpen(true);
    setNotificationsElement(event.currentTarget);
    if (hasUnread) {
      void updateNotifications.mutateAsync({
        ids: notifications.filter((notification) => notification.isUnread).map((notification) => notification.id),
        status: 'completed',
      });
    }
  };

  const IconButton = (
    <IconButtonContained
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
      {hasUnread ? (
        <Badge
          variant="dot"
          color="warning"
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
      ) : (
        IconButton
      )}
      <Menu
        id="notifications-menu"
        anchorEl={notificationsElement}
        open={notificationsOpen}
        onClose={() => {
          setNotificationsOpen(false);
          setNotificationsElement(undefined);
        }}
        MenuListProps={{
          'aria-labelledby': 'notifications-button',
        }}
      >
        <Box sx={{ p: 3 }}>
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
                    notification.link ? navigate(notification.link) : undefined;
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
          {title}
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
