"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderNotifications = void 0;
var icons_material_1 = require("@mui/icons-material");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var useEvolveUser_1 = require("../../hooks/useEvolveUser");
var IconButtonContained_1 = require("../../telemed/components/IconButtonContained");
var notifications_queries_1 = require("./notifications.queries");
var notifications_store_1 = require("./notifications.store");
exports.ProviderNotifications = (0, react_1.memo)(function () {
    var theme = (0, material_1.useTheme)();
    var user = (0, useEvolveUser_1.default)();
    var navigate = (0, react_router_dom_1.useNavigate)();
    var notificationsData = (0, notifications_queries_1.useGetProviderNotifications)().data;
    var updateNotifications = (0, notifications_queries_1.useUpdateProviderNotificationsMutation)();
    var _a = (0, react_1.useState)(false), notificationsOpen = _a[0], setNotificationsOpen = _a[1];
    var _b = (0, react_1.useState)(undefined), notificationsElement = _b[0], setNotificationsElement = _b[1];
    var _c = (0, react_1.useMemo)(function () {
        return (0, utils_1.getProviderNotificationSettingsForPractitioner)(user === null || user === void 0 ? void 0 : user.profileResource) || {
            method: utils_1.ProviderNotificationMethod['phone and computer'],
            enabled: false,
        };
    }, [user === null || user === void 0 ? void 0 : user.profileResource]), notificationsEnabled = _c.enabled, notificationMethod = _c.method;
    var notifications = (0, react_1.useMemo)(function () {
        return ((notificationsData === null || notificationsData === void 0 ? void 0 : notificationsData.map(function (notification) {
            var _a, _b;
            // if isUnread play sound
            // notificationAudio.play().catch((error) => console.log(error));
            return {
                id: notification.communication.id,
                isUnread: notification.communication.status === 'in-progress',
                message: ((_b = (_a = notification.communication.payload) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.contentString) || '',
                sent: notification.communication.sent
                    ? luxon_1.DateTime.fromISO(notification.communication.sent).toRelative()
                    : 'N/A',
                link: notification.appointmentID ? "/telemed/appointments/".concat(notification.appointmentID) : undefined,
            };
        })) || []).sort(function (a, b) { return (a.sent && b.sent && luxon_1.DateTime.fromISO(a.sent) > luxon_1.DateTime.fromISO(b.sent) ? -1 : 0); });
    }, [notificationsData]);
    var hasUnread = notifications.some(function (notification) { return notification.isUnread; });
    (0, react_1.useEffect)(function () {
        notifications_store_1.useProviderNotificationsStore.setState({ notificationsEnabled: notificationsEnabled, notificationMethod: notificationMethod });
    }, [notificationsEnabled, notificationMethod]);
    var handleIconButtonClick = function (event) {
        setNotificationsOpen(true);
        setNotificationsElement(event.currentTarget);
        if (hasUnread) {
            void updateNotifications.mutateAsync({
                ids: notifications.filter(function (notification) { return notification.isUnread; }).map(function (notification) { return notification.id; }),
                status: 'completed',
            });
        }
    };
    var IconButton = (<IconButtonContained_1.IconButtonContained id="notifications-button" sx={{ marginRight: { sm: 0, md: 2 } }} aria-controls="notifications-menu" aria-haspopup="true" variant="primary.lightest" aria-expanded={notificationsOpen ? 'true' : undefined} onClick={handleIconButtonClick}>
      <icons_material_1.NotificationsOutlined sx={{ color: theme.palette.primary.main }}/>
    </IconButtonContained_1.IconButtonContained>);
    return (<>
      {hasUnread ? (<material_1.Badge variant="dot" color="warning" sx={{
                '& .MuiBadge-badge': {
                    width: '10px',
                    height: '10px',
                    borderRadius: '10px',
                    top: '6px',
                    right: '21px',
                },
            }}>
          {IconButton}
        </material_1.Badge>) : (IconButton)}
      <material_1.Menu id="notifications-menu" anchorEl={notificationsElement} open={notificationsOpen} onClose={function () {
            setNotificationsOpen(false);
            setNotificationsElement(undefined);
        }} MenuListProps={{
            'aria-labelledby': 'notifications-button',
        }}>
        <material_1.Box sx={{ p: 3 }}>
          <material_1.Typography sx={{ fontWeight: 'bold' }} variant="h5" color="primary.dark">
            Notifications
          </material_1.Typography>
          {notifications
            ? notifications.map(function (notification) { return (<MenuItem cursor={notification.link ? 'pointer' : 'default'} title={notification.message} subtitle={notification.sent} key={"notification-link-".concat(notification.id)} onClick={function () {
                    if (notification.link) {
                        navigate(notification.link);
                    }
                }}/>); })
            : 'Loading...'}
        </material_1.Box>
      </material_1.Menu>
    </>);
});
var MenuItem = function (_a) {
    var onClick = _a.onClick, title = _a.title, subtitle = _a.subtitle;
    var theme = (0, material_1.useTheme)();
    var titleColor = theme.palette.getContrastText(theme.palette.background.default);
    return (<material_1.Button sx={{
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
            '&:hover': { backgroundColor: (0, material_1.alpha)(theme.palette.primary.main, 0.1) },
        }} onClick={onClick}>
      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'start', textTransform: 'none' }}>
        <material_1.Typography variant="body1" color={titleColor}>
          {title}
        </material_1.Typography>
        {subtitle && (<material_1.Typography variant="caption" sx={{ mt: 1 }} color={(0, material_1.alpha)(titleColor, 0.5)}>
            {subtitle}
          </material_1.Typography>)}
      </material_1.Box>
    </material_1.Button>);
};
//# sourceMappingURL=ProviderNotifications.js.map