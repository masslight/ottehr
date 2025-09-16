import { NotificationsOutlined } from '@mui/icons-material';
import { alpha, Badge, Box, Button, Menu, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { EventHandler, FC, memo, MouseEvent, useEffect, useMemo, useState } from 'react';
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
  title: string;
  message: string;
  isUnread: boolean;
  link?: string;
  sent: string;
  type: 'appointment' | 'device-vital-alert';
  patientId?: string;
  deviceId?: string;
  thresholdData?: any;
  deviceName?: string;
};

export const ProviderNotifications: FC = memo(() => {
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
        const deviceVitalAlertCategory = notification.communication.category?.find(
          (category) =>
            category.coding?.find(
              (coding) =>
                coding.system === 'https://fhir.ottehr.com/r4/provider-notifications-type' &&
                coding.code === 'device-vital-alert'
            )
        );

        let type: 'appointment' | 'device-vital-alert' = 'appointment';
        let link: string | undefined;
        let title: string;
        let message: string;
        let patientId: string | undefined;
        let deviceId: string | undefined;
        let thresholdData: any = null;
        let deviceName: string | undefined;

        if (deviceVitalAlertCategory) {
          const deviceVitalAlertCoding = deviceVitalAlertCategory.coding?.find(
            (coding) =>
              coding.system === 'https://fhir.ottehr.com/r4/provider-notifications-type' &&
              coding.code === 'device-vital-alert'
          );
          patientId = deviceVitalAlertCoding?.version;
          deviceId = notification.communication.sender?.reference?.replace('Device/', '');

          const reasonCode = notification.communication.reasonCode?.[0];
          if (reasonCode && reasonCode.coding) {
            deviceName = reasonCode.text;
            const thresholdCoding = reasonCode.coding.find((coding: any) => coding.system === 'threshold-data');
            if (thresholdCoding && thresholdCoding.code) {
              try {
                thresholdData = JSON.parse(thresholdCoding.code);
              } catch (error) {
                console.error('Failed to parse threshold data:', error);
              }
            }
          }

          type = 'device-vital-alert';
          link = patientId ? `/patient/${patientId.replace('Patient/', '')}?deviceId=${deviceId}` : undefined;
          title = notification.communication.topic?.text || 'Device Alert';
          message = notification.communication.payload?.[0]?.contentString || '';
        } else {
          link = notification.appointmentID ? `/telemed/appointments/${notification.appointmentID}` : undefined;
          title = notification.communication.payload?.[0]?.contentString || '';
          message = '';
        }

        return {
          id: notification.communication.id!,
          title,
          message,
          isUnread: notification.communication.status === 'in-progress',
          sent: notification.communication.sent
            ? DateTime.fromISO(notification.communication.sent).toRelative()!
            : 'N/A',
          link,
          type,
          patientId,
          deviceId,
          thresholdData,
          deviceName,
        };
      }) || []
    ).sort((a, b) => (a.sent && b.sent && DateTime.fromISO(a.sent) > DateTime.fromISO(b.sent) ? -1 : 0));
  }, [notificationsData]);

  const hasUnread = notifications.some((notification) => notification.isUnread);

  useEffect(() => {
    useProviderNotificationsStore.setState({ notificationsEnabled, notificationMethod: notificationMethod });
  }, [notificationsEnabled, notificationMethod]);

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

  const handleNotificationClick = (notification: ProviderNotificationDisplay): void => {
    if (notification.link) {
      navigate(notification.link);
      setNotificationsOpen(false);
      setNotificationsElement(undefined);
    }

    if (notification.type === 'device-vital-alert' && notification.patientId && notification.deviceId) {
      navigate(`/patient/${notification.patientId.replace('Patient/', '')}?deviceId=${notification.deviceId}`, {
        state: {
          defaultTab: 'devices',
          openDeviceVitals: true,
          selectedDevice: {
            id: notification.deviceId,
            deviceType: notification.thresholdData?.deviceType || '',
            thresholds: notification.thresholdData?.thresholds || [],
            name: notification.deviceName || '',
          },
        },
      });
    } else if (notification.link) {
      navigate(notification.link);
    }
    setNotificationsOpen(false);
    setNotificationsElement(undefined);
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
          sx: {
            maxHeight: '400px',
            overflow: 'hidden',
          },
        }}
      >
        <Box sx={{ p: 3, width: '100%', maxWidth: '400px', maxHeight: '300px', overflow: 'auto' }}>
          <Typography sx={{ fontWeight: 'bold' }} variant="h5" color="primary.dark">
            Notifications
          </Typography>
          {notifications
            ? notifications.map((notification) => (
                <MenuItem
                  cursor={notification.link ? 'pointer' : 'default'}
                  title={notification.title}
                  subtitle={notification.type === 'device-vital-alert' ? notification.message : notification.sent}
                  key={`notification-link-${notification.id}`}
                  onClick={() => handleNotificationClick(notification)}
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
        <Typography align="left" variant="body1" color={titleColor}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" sx={{ mt: 1, textAlign: 'start' }} color={alpha(titleColor, 0.5)}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Button>
  );
};
