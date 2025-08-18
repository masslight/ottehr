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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoControls = void 0;
var CallEnd_1 = require("@mui/icons-material/CallEnd");
var Mic_1 = require("@mui/icons-material/Mic");
var MicOff_1 = require("@mui/icons-material/MicOff");
var Settings_1 = require("@mui/icons-material/Settings");
var Videocam_1 = require("@mui/icons-material/Videocam");
var VideocamOff_1 = require("@mui/icons-material/VideocamOff");
var material_1 = require("@mui/material");
var amazon_chime_sdk_component_library_react_1 = require("amazon-chime-sdk-component-library-react");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var components_1 = require("../../components");
var useOystehrAPIClient_1 = require("../../hooks/useOystehrAPIClient");
var state_1 = require("../../state");
var utils_2 = require("../../utils");
var CallSettings_1 = require("./CallSettings");
var VideoControls = function () {
    var theme = (0, material_1.useTheme)();
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var _a = (0, state_1.useChangeTelemedAppointmentStatusMutation)(), mutateAsync = _a.mutateAsync, isLoading = _a.isLoading;
    var encounter = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['encounter']).encounter;
    var appointmentId = (0, react_router_dom_1.useParams)().id;
    var _b = (0, amazon_chime_sdk_component_library_react_1.useLocalVideo)(), toggleVideo = _b.toggleVideo, isVideoEnabled = _b.isVideoEnabled;
    var _c = (0, amazon_chime_sdk_component_library_react_1.useToggleLocalMute)(), muted = _c.muted, toggleMute = _c.toggleMute;
    var meetingManager = (0, amazon_chime_sdk_component_library_react_1.useMeetingManager)();
    var _d = (0, react_1.useState)(false), isSettingsOpen = _d[0], setIsSettingsOpen = _d[1];
    var openSettings = function () {
        setIsSettingsOpen(true);
    };
    var closeSettings = function () {
        setIsSettingsOpen(false);
    };
    var cleanup = function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!meetingManager) return [3 /*break*/, 3];
                    return [4 /*yield*/, ((_a = meetingManager.meetingSession) === null || _a === void 0 ? void 0 : _a.deviceController.destroy().catch(function (error) { return console.error(error); }))];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, meetingManager.leave().catch(function (error) { return console.error(error); })];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3:
                    state_1.useVideoCallStore.setState({ meetingData: null });
                    return [2 /*return*/];
            }
        });
    }); };
    var disconnect = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(apiClient && appointmentId)) return [3 /*break*/, 2];
                    return [4 /*yield*/, mutateAsync({ apiClient: apiClient, appointmentId: appointmentId, newStatus: utils_1.TelemedAppointmentStatusEnum.unsigned }, {}).catch(function (error) {
                            console.error(error);
                        })];
                case 1:
                    _a.sent();
                    state_1.useAppointmentStore.setState({
                        encounter: __assign(__assign({}, encounter), { status: 'finished', statusHistory: (0, utils_2.updateEncounterStatusHistory)('finished', encounter.statusHistory) }),
                    });
                    _a.label = 2;
                case 2: return [4 /*yield*/, cleanup()];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    return (<>
      <material_1.Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
        }}>
        <components_1.IconButtonContained onClick={toggleVideo} variant="primary.lighter">
          {isVideoEnabled ? (<Videocam_1.default sx={{ color: theme.palette.primary.contrastText }}/>) : (<VideocamOff_1.default sx={{ color: theme.palette.primary.contrastText }}/>)}
        </components_1.IconButtonContained>
        <components_1.IconButtonContained onClick={toggleMute} variant="primary.lighter">
          {!muted ? (<Mic_1.default sx={{ color: theme.palette.primary.contrastText }}/>) : (<MicOff_1.default sx={{ color: theme.palette.primary.contrastText }}/>)}
        </components_1.IconButtonContained>
        <components_1.IconButtonContained onClick={openSettings} variant="primary.lighter">
          <Settings_1.default sx={{ color: theme.palette.primary.contrastText }}/>
        </components_1.IconButtonContained>
        <components_1.ConfirmationDialog title="Do you want to end video call with the patient?" response={disconnect} actionButtons={{
            proceed: {
                text: 'End video call',
                color: 'error',
            },
            back: { text: 'Cancel' },
        }}>
          {function (showDialog) { return (<components_1.IconButtonContained onClick={showDialog} disabled={isLoading} variant="error">
              {isLoading ? (<material_1.CircularProgress size={24} sx={{ color: theme.palette.primary.contrastText }}/>) : (<CallEnd_1.default sx={{ color: theme.palette.primary.contrastText }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.endVideoCallButton}/>)}
            </components_1.IconButtonContained>); }}
        </components_1.ConfirmationDialog>
      </material_1.Box>
      {isSettingsOpen && <CallSettings_1.CallSettings onClose={closeSettings}/>}
    </>);
};
exports.VideoControls = VideoControls;
//# sourceMappingURL=VideoControls.js.map