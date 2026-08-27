import { NotificationsOutlined } from '@mui/icons-material';
import { alpha, Badge, Box, Button, Menu, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { EventHandler, FC, memo, MouseEvent, useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButtonContained } from 'src/features/visits/shared/components/IconButtonContained';
import { ProviderNotificationTarget } from 'utils/lib/types/api/provider-notifications';
import { inboundFaxMatchPath } from '../inbound-fax/routes';
import { useGetProviderNotifications, useUpdateProviderNotificationsMutation } from './notifications.queries';

const MAX_NOTIFICATION_MESSAGE_LENGTH = 140;

type ProviderNotificationDisplay = {
  id: string;
  message: string;
  isUnread: boolean;
  link?: string;
  sent: string;
};

/**
 * The route for a notification's destination. The endpoint names the destination rather than spelling
 * a path, so these two route shapes stay owned by the app that defines them.
 */
const pathForTarget = (target: ProviderNotificationTarget | undefined): string | undefined => {
  if (!target) return undefined;
  return target.type === 'visit' ? `/visit/${target.appointmentId}` : inboundFaxMatchPath(target.faxCommunicationId);
};

export const ProviderNotifications: FC = memo(() => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { data: notificationsData } = useGetProviderNotifications();
  const updateNotifications = useUpdateProviderNotificationsMutation();
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  // Already newest-first from the endpoint, so this only formats.
  const notifications: ProviderNotificationDisplay[] = useMemo(
    () =>
      notificationsData?.map<ProviderNotificationDisplay>((notification) => ({
        id: notification.id,
        isUnread: notification.isUnread,
        message: notification.message,
        sent: notification.sentAt ? DateTime.fromISO(notification.sentAt).toRelative()! : 'N/A',
        link: pathForTarget(notification.target),
      })) ?? [],
    [notificationsData]
  );

  const hasUnread = notifications.some((notification) => notification.isUnread);

  const handleIconButtonClick: EventHandler<MouseEvent<HTMLElement>> = useCallback(() => {
    setNotificationsOpen(true);
    if (hasUnread) {
      void updateNotifications.mutateAsync({
        notificationIds: notifications
          .filter((notification) => notification.isUnread)
          .map((notification) => notification.id),
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

const MenuItem = ({ onClick, cursor, title, subtitle }: MenuItemProps): JSX.Element => {
  const theme = useTheme();

  // A notification with nowhere to go must not offer a click affordance: no pointer, no hover highlight.
  const isNavigable = cursor === 'pointer';
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
        cursor,
        // Spelled out for both cases: leaving the hover rule off would fall back to MUI's own Button
        // hover, which is the highlight we're trying not to show. The non-navigable case repeats the
        // resting background above, so hovering changes nothing.
        '&:hover': {
          backgroundColor: isNavigable ? alpha(theme.palette.primary.main, 0.1) : theme.palette.background.default,
        },
      }}
      disableRipple={!isNavigable}
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
