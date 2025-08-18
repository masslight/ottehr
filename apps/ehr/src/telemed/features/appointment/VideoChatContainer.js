"use strict";
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
exports.VideoChatContainer = void 0;
var amazon_chime_sdk_component_library_react_1 = require("amazon-chime-sdk-component-library-react");
var amazon_chime_sdk_js_1 = require("amazon-chime-sdk-js");
var react_1 = require("react");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var state_1 = require("../../state");
var VideoChatLayout_1 = require("./VideoChatLayout");
var VideoRoom_1 = require("./VideoRoom");
var VideoChatContainer = function () {
    var videoCallState = (0, getSelectors_1.getSelectors)(state_1.useVideoCallStore, ['meetingData']);
    var meetingManager = (0, amazon_chime_sdk_component_library_react_1.useMeetingManager)();
    var audioVideo = (0, amazon_chime_sdk_component_library_react_1.useAudioVideo)();
    var _a = (0, amazon_chime_sdk_component_library_react_1.useLocalVideo)(), toggleVideo = _a.toggleVideo, isVideoEnabled = _a.isVideoEnabled;
    var meetingStatus = (0, amazon_chime_sdk_component_library_react_1.useMeetingStatus)();
    var _b = (0, react_1.useState)(false), isCameraTurnedOnForStart = _b[0], setIsCameraTurnedOnForStart = _b[1];
    var stopAudioVideoUsage = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (audioVideo === null || audioVideo === void 0 ? void 0 : audioVideo.stopVideoInput())];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (audioVideo === null || audioVideo === void 0 ? void 0 : audioVideo.stopAudioInput())];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [audioVideo]);
    (0, react_1.useEffect)(function () {
        return function () { return void stopAudioVideoUsage(); };
    }, [stopAudioVideoUsage]);
    (0, react_1.useEffect)(function () {
        var isDisposed = false;
        var startCall = function () { return __awaiter(void 0, void 0, void 0, function () {
            var meetingSessionConfiguration, options;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!videoCallState.meetingData) return [3 /*break*/, 3];
                        meetingSessionConfiguration = new amazon_chime_sdk_js_1.MeetingSessionConfiguration(videoCallState.meetingData.Meeting, videoCallState.meetingData.Attendee);
                        options = {
                            deviceLabels: amazon_chime_sdk_component_library_react_1.DeviceLabels.AudioAndVideo,
                        };
                        return [4 /*yield*/, meetingManager.join(meetingSessionConfiguration, options)];
                    case 1:
                        _a.sent();
                        if (isDisposed) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, meetingManager.start()];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        }); };
        void startCall();
        return function () {
            isDisposed = true;
        };
    }, [meetingManager, videoCallState.meetingData]);
    (0, react_1.useEffect)(function () {
        function toggle() {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!(!isVideoEnabled && meetingStatus === 1 && !isCameraTurnedOnForStart)) return [3 /*break*/, 2];
                            setIsCameraTurnedOnForStart(true);
                            return [4 /*yield*/, toggleVideo()];
                        case 1:
                            _a.sent();
                            _a.label = 2;
                        case 2: return [2 /*return*/];
                    }
                });
            });
        }
        void toggle();
        // ignoring the deps here not to rerender every time, cause for some reason toggleVideo is not memoized
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVideoEnabled, meetingStatus]);
    return (<VideoChatLayout_1.VideoChatLayout>
      <VideoRoom_1.VideoRoom />
    </VideoChatLayout_1.VideoChatLayout>);
};
exports.VideoChatContainer = VideoChatContainer;
//# sourceMappingURL=VideoChatContainer.js.map