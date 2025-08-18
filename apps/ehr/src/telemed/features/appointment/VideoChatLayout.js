"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoChatLayout = void 0;
var OpenInFull_1 = require("@mui/icons-material/OpenInFull");
var PictureInPicture_1 = require("@mui/icons-material/PictureInPicture");
var PushPin_1 = require("@mui/icons-material/PushPin");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_draggable_1 = require("react-draggable");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var components_1 = require("../../components");
var AppointmentFooter_1 = require("./AppointmentFooter");
var VideoProviderReminderPopover_1 = require("./VideoProviderReminderPopover");
var PaperComponent = function (props) {
    var nodeRef = (0, react_1.useRef)(null);
    return (<react_draggable_1.default nodeRef={nodeRef} handle=".handle" bounds="parent" defaultPosition={{ x: 350 / 2, y: 260 + 24 - window.innerHeight / 2 }}>
      <material_1.Card ref={nodeRef} {...props} sx={{ borderRadius: 2, height: '400px', width: '550px' }}></material_1.Card>
    </react_draggable_1.default>);
};
var VideoChatLayout = function (_a) {
    var children = _a.children;
    var _b = (0, react_1.useState)('pip'), type = _b[0], setType = _b[1];
    if (type === 'pip') {
        return (<>
        <material_1.Dialog open={true} hideBackdrop disableEnforceFocus disableScrollLock style={{ pointerEvents: 'none' }} PaperProps={{ style: { pointerEvents: 'auto' } }} PaperComponent={PaperComponent}>
          <VideoRoomContainer type={type} setType={setType}>
            {children}
          </VideoRoomContainer>
        </material_1.Dialog>
        <material_1.Box sx={{ height: '424px' }}/>
      </>);
    }
    if (type === 'fullscreen') {
        return (<material_1.Dialog fullScreen open={true}>
        <material_1.Box sx={{
                display: 'flex',
                flex: 1,
            }}>
          <VideoRoomContainer type={type} setType={setType}>
            {children}
          </VideoRoomContainer>
        </material_1.Box>
        <material_1.Divider />
        <AppointmentFooter_1.AppointmentFooter />
      </material_1.Dialog>);
    }
    return (<material_1.Container maxWidth="sm" sx={{ mb: 3 }}>
      <material_1.Card elevation={0} sx={{ borderRadius: 2 }}>
        <VideoRoomContainer type={type} setType={setType}>
          <material_1.Box sx={{ height: '400px' }}>{children}</material_1.Box>
        </VideoRoomContainer>
      </material_1.Card>
    </material_1.Container>);
};
exports.VideoChatLayout = VideoChatLayout;
var VideoRoomContainer = function (props) {
    var type = props.type, setType = props.setType, children = props.children;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Box sx={{
            backgroundColor: theme.palette.primary.dark,
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
        }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.videoRoomContainer}>
      <material_1.Box sx={{
            py: 1,
            px: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: type === 'pip' ? 'move' : 'default',
        }} className="handle">
        <material_1.Box sx={{ display: 'flex', gap: 1 }}>
          <components_1.IconButtonContained size="small" variant={type === 'pip' ? 'disabled' : undefined} onClick={function () { return setType('pip'); }} sx={{
            color: type === 'pip' ? theme.palette.primary.dark : theme.palette.primary.contrastText,
        }}>
            <PictureInPicture_1.default fontSize="small"/>
          </components_1.IconButtonContained>
          <components_1.IconButtonContained size="small" variant={type === 'pinned' ? 'disabled' : undefined} onClick={function () { return setType('pinned'); }} sx={{
            color: type === 'pinned' ? theme.palette.primary.dark : theme.palette.primary.contrastText,
        }}>
            <PushPin_1.default fontSize="small"/>
          </components_1.IconButtonContained>
          <components_1.IconButtonContained size="small" variant={type === 'fullscreen' ? 'disabled' : undefined} onClick={function () { return setType('fullscreen'); }} sx={{
            color: type === 'fullscreen' ? theme.palette.primary.dark : theme.palette.primary.contrastText,
        }}>
            <OpenInFull_1.default fontSize="small"/>
          </components_1.IconButtonContained>
        </material_1.Box>

        <VideoProviderReminderPopover_1.VideoProviderReminderPopover />
      </material_1.Box>

      <material_1.Box sx={{ backgroundColor: '#0A2143', height: '100%' }}>{children}</material_1.Box>
    </material_1.Box>);
};
//# sourceMappingURL=VideoChatLayout.js.map