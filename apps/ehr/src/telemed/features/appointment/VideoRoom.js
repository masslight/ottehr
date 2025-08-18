"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoRoom = void 0;
var material_1 = require("@mui/material");
var amazon_chime_sdk_component_library_react_1 = require("amazon-chime-sdk-component-library-react");
var react_1 = require("react");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var state_1 = require("../../state");
var VideoControls_1 = require("./VideoControls");
var VideoTimer_1 = require("./VideoTimer");
var VideoRoom = function () {
    var _a;
    var theme = (0, material_1.useTheme)();
    var attendeeIdToTileId = (0, amazon_chime_sdk_component_library_react_1.useRemoteVideoTileState)().attendeeIdToTileId;
    var isVideoEnabled = (0, amazon_chime_sdk_component_library_react_1.useLocalVideo)().isVideoEnabled;
    var roster = (0, amazon_chime_sdk_component_library_react_1.useRosterState)().roster;
    var videoCallState = (0, getSelectors_1.getSelectors)(state_1.useVideoCallStore, ['meetingData']);
    var _b = (0, react_1.useState)(null), activeParticipant = _b[0], setActiveParticipant = _b[1];
    var participants = (0, react_1.useMemo)(function () {
        return Object.keys(roster)
            .filter(function (participantId) { var _a; return ((_a = videoCallState.meetingData) === null || _a === void 0 ? void 0 : _a.Attendee).AttendeeId !== participantId; })
            .map(function (participantId) { return (__assign(__assign({}, roster[participantId]), { tileId: attendeeIdToTileId[participantId] })); });
    }, [roster, (_a = videoCallState.meetingData) === null || _a === void 0 ? void 0 : _a.Attendee, attendeeIdToTileId]);
    (0, react_1.useEffect)(function () {
        if (participants.length) {
            setActiveParticipant(participants[0]);
        }
        else {
            setActiveParticipant(null);
        }
    }, [participants]);
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            height: '100%',
        }}>
      <material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
        }}>
        <material_1.Box sx={{ display: 'flex', padding: 1, gap: 1, height: '100%' }}>
          <material_1.Box sx={{
            color: 'white',
            width: '100%',
            overflow: 'hidden',
            display: 'flex',
            gap: 1,
        }}>
            {activeParticipant && (<material_1.Box sx={{
                height: '100%',
                overflow: 'hidden',
                position: 'relative',
                width: '100%',
                backgroundColor: theme.palette.primary.dark,
                borderRadius: 2,
            }}>
                {activeParticipant.tileId && <amazon_chime_sdk_component_library_react_1.RemoteVideo tileId={activeParticipant.tileId}/>}
              </material_1.Box>)}
          </material_1.Box>
          <material_1.Box sx={{
            color: 'white',
            minWidth: '20%',
            display: 'grid',
            gridAutoColumns: '1fr',
            rowGap: 1,
            alignContent: 'start',
        }}>
            <material_1.Box sx={{
            aspectRatio: '1/1',
            backgroundColor: theme.palette.primary.dark,
            borderRadius: '8px',
            overflow: 'hidden',
            position: 'relative',
        }}>
              {isVideoEnabled && <amazon_chime_sdk_component_library_react_1.LocalVideo />}
              <material_1.Box sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: 34,
            width: '100%',
            backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0))',
            pt: '10px',
            pl: '10px',
        }}>
                <material_1.Typography sx={{ fontWeight: 500, fontSize: '14px' }}>You</material_1.Typography>
              </material_1.Box>
            </material_1.Box>
            {participants
            .filter(function (participant) { return participant.chimeAttendeeId !== (activeParticipant === null || activeParticipant === void 0 ? void 0 : activeParticipant.chimeAttendeeId); })
            .map(function (participant) { return (<material_1.Box key={participant.chimeAttendeeId} sx={{
                aspectRatio: '1/1',
                backgroundColor: theme.palette.primary.dark,
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
                cursor: participant.tileId ? 'pointer' : 'auto',
            }}>
                  {participant.tileId && (<amazon_chime_sdk_component_library_react_1.RemoteVideo onClick={function () {
                    setActiveParticipant(participant);
                }} tileId={participant.tileId}/>)}
                </material_1.Box>); })}
          </material_1.Box>
        </material_1.Box>
        <material_1.Box sx={{
            backgroundColor: theme.palette.primary.dark,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 2,
            py: 1,
        }}>
          <VideoTimer_1.VideoTimer />
          <VideoControls_1.VideoControls />
        </material_1.Box>
      </material_1.Box>
    </material_1.Box>);
};
exports.VideoRoom = VideoRoom;
//# sourceMappingURL=VideoRoom.js.map