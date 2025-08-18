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
exports.default = PaperworkFlagIndicator;
var Clear_1 = require("@mui/icons-material/Clear");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
function PaperworkFlagIndicator(_a) {
    var title = _a.title, color = _a.color, backgroundColor = _a.backgroundColor, icon = _a.icon, onDismiss = _a.onDismiss, dateTime = _a.dateTime, timezone = _a.timezone;
    var _b = (0, react_1.useState)(false), loading = _b[0], setLoading = _b[1];
    var adjustedDateTime = dateTime && luxon_1.DateTime.fromISO(dateTime).setZone(timezone);
    var formattedDate = adjustedDateTime
        ? adjustedDateTime.toLocaleString({
            month: 'long',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
        })
        : 'Unknown';
    function dismissAlert() {
        return __awaiter(this, void 0, void 0, function () {
            var e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, 4, 5]);
                        setLoading(true);
                        if (!onDismiss) return [3 /*break*/, 2];
                        return [4 /*yield*/, onDismiss()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [3 /*break*/, 5];
                    case 3:
                        e_1 = _a.sent();
                        console.log('error dismissing alert: ', JSON.stringify(e_1));
                        return [3 /*break*/, 5];
                    case 4:
                        setLoading(false);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    return (<material_1.Box sx={{
            width: '100%',
            background: backgroundColor,
            padding: '16px',
            borderRadius: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
        }}>
      <material_1.Box sx={{ display: 'flex', alignItems: 'center' }}>
        <material_1.Box sx={{ display: 'flex', alignItems: 'center', padding: '7px 12px 7px 0px' }}>{icon}</material_1.Box>
        <material_1.Typography variant="body1" sx={{
            fontWeight: 500,
            background: color,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
        }}>
          {"".concat(title, " ").concat(dateTime ? formattedDate : '')}
        </material_1.Typography>
      </material_1.Box>
      {onDismiss && (<lab_1.LoadingButton loading={loading} onClick={dismissAlert}>
          {/* svg icon doesn't support layered linear gradients. need to provide hex color here */}
          {!loading && <Clear_1.default sx={{ color: color }}></Clear_1.default>}
        </lab_1.LoadingButton>)}
    </material_1.Box>);
}
//# sourceMappingURL=PaperworkFlagIndicator.js.map