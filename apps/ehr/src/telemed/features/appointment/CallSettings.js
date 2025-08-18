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
exports.CallSettings = void 0;
var material_1 = require("@mui/material");
var amazon_chime_sdk_component_library_react_1 = require("amazon-chime-sdk-component-library-react");
var amazon_chime_sdk_js_1 = require("amazon-chime-sdk-js");
var react_1 = require("react");
var CallSettings = function (_a) {
    var onClose = _a.onClose;
    // const meetingManager = useMeetingManager();
    var audioVideo = (0, amazon_chime_sdk_component_library_react_1.useAudioVideo)();
    var _b = (0, amazon_chime_sdk_component_library_react_1.useAudioInputs)(), audioDevices = _b.devices, initialAudioDevice = _b.selectedDevice;
    var _c = (0, amazon_chime_sdk_component_library_react_1.useVideoInputs)(), videoDevices = _c.devices, initialVideoDevice = _c.selectedDevice;
    var _d = (0, react_1.useState)(initialAudioDevice), selectedAudioDevice = _d[0], setSelectedAudioDevice = _d[1];
    var _e = (0, react_1.useState)(initialVideoDevice), selectedVideoPreviewDeviceId = _e[0], setSelectedVideoPreviewDeviceId = _e[1];
    var videoPreviewRef = (0, react_1.useRef)(null);
    var previewDeviceController = (0, react_1.useMemo)(function () {
        var logger = new amazon_chime_sdk_js_1.ConsoleLogger('preview');
        return new amazon_chime_sdk_js_1.DefaultDeviceController(logger);
    }, []);
    var handleSave = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, stopAudioVideoPreviewAndUsage()];
                case 1:
                    _a.sent();
                    if (!(selectedVideoPreviewDeviceId !== initialVideoDevice)) return [3 /*break*/, 3];
                    return [4 /*yield*/, (audioVideo === null || audioVideo === void 0 ? void 0 : audioVideo.startVideoInput(selectedVideoPreviewDeviceId || initialVideoDevice || videoDevices[0].deviceId))];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    onClose();
                    return [2 /*return*/];
            }
        });
    }); };
    var handleClose = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, stopAudioVideoPreviewAndUsage()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (audioVideo === null || audioVideo === void 0 ? void 0 : audioVideo.startAudioInput(initialAudioDevice || audioDevices[0].deviceId))];
                case 2:
                    _a.sent();
                    onClose();
                    return [2 /*return*/];
            }
        });
    }); };
    var stopAudioVideoPreviewAndUsage = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(previewDeviceController && videoPreviewRef.current)) return [3 /*break*/, 2];
                    return [4 /*yield*/, (previewDeviceController === null || previewDeviceController === void 0 ? void 0 : previewDeviceController.stopVideoPreviewForVideoInput(videoPreviewRef.current))];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [4 /*yield*/, (previewDeviceController === null || previewDeviceController === void 0 ? void 0 : previewDeviceController.stopVideoInput())];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (previewDeviceController === null || previewDeviceController === void 0 ? void 0 : previewDeviceController.stopAudioInput())];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [previewDeviceController]);
    (0, react_1.useEffect)(function () {
        return function () { return void stopAudioVideoPreviewAndUsage(); };
    }, [stopAudioVideoPreviewAndUsage]);
    var startVideoPreview = (0, react_1.useCallback)(function (deviceId) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(previewDeviceController && videoPreviewRef.current)) return [3 /*break*/, 3];
                    return [4 /*yield*/, previewDeviceController.stopVideoInput()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, previewDeviceController.startVideoInput(deviceId)];
                case 2:
                    _a.sent();
                    previewDeviceController.startVideoPreviewForVideoInput(videoPreviewRef.current);
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    }); }, [previewDeviceController]);
    var handleVideoDeviceChange = function (event) { return __awaiter(void 0, void 0, void 0, function () {
        var deviceId;
        return __generator(this, function (_a) {
            deviceId = event.target.value;
            setSelectedVideoPreviewDeviceId(deviceId);
            return [2 /*return*/];
        });
    }); };
    var handleAudioDeviceChange = function (event) { return __awaiter(void 0, void 0, void 0, function () {
        var deviceId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    deviceId = event.target.value;
                    setSelectedAudioDevice(deviceId);
                    return [4 /*yield*/, (audioVideo === null || audioVideo === void 0 ? void 0 : audioVideo.startAudioInput(deviceId))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () {
        var isDisposed = false;
        if (selectedVideoPreviewDeviceId) {
            setTimeout(function () {
                if (!isDisposed) {
                    void startVideoPreview(selectedVideoPreviewDeviceId.toString());
                }
            }, 200);
        }
        return function () {
            isDisposed = true;
        };
    }, [selectedVideoPreviewDeviceId, startVideoPreview]);
    return (<material_1.Dialog open onClose={onClose}>
      <material_1.DialogTitle>Call Settings</material_1.DialogTitle>
      <material_1.DialogContent>
        <video ref={videoPreviewRef} autoPlay muted playsInline style={{
            height: '100%',
            width: '100%',
        }}></video>
        <material_1.FormControl fullWidth margin="normal">
          <material_1.InputLabel>Camera</material_1.InputLabel>
          <material_1.Select value={selectedVideoPreviewDeviceId === null || selectedVideoPreviewDeviceId === void 0 ? void 0 : selectedVideoPreviewDeviceId.toString()} onChange={handleVideoDeviceChange} label="Camera">
            {videoDevices.map(function (device) { return (<material_1.MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </material_1.MenuItem>); })}
          </material_1.Select>
        </material_1.FormControl>

        <material_1.FormControl fullWidth margin="normal">
          <material_1.InputLabel>Microphone</material_1.InputLabel>
          <material_1.Select value={selectedAudioDevice === null || selectedAudioDevice === void 0 ? void 0 : selectedAudioDevice.toString()} onChange={handleAudioDeviceChange} label="Microphone">
            {audioDevices.map(function (device) { return (<material_1.MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </material_1.MenuItem>); })}
          </material_1.Select>
        </material_1.FormControl>
      </material_1.DialogContent>
      <material_1.DialogActions sx={{ alignItems: 'center', justifyContent: 'flex-end', padding: '16px 24px' }}>
        <material_1.Button onClick={handleClose} sx={{ marginRight: 1 }} variant="text">
          Cancel
        </material_1.Button>
        <material_1.Button onClick={handleSave} variant="contained">
          Save Changes
        </material_1.Button>
      </material_1.DialogActions>
    </material_1.Dialog>);
};
exports.CallSettings = CallSettings;
//# sourceMappingURL=CallSettings.js.map