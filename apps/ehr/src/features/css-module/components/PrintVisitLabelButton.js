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
exports.PrintVisitLabelButton = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var api_1 = require("src/api/api");
var GenericToolTip_1 = require("src/components/GenericToolTip");
var useAppClients_1 = require("src/hooks/useAppClients");
var PrintDisabledOutlined = function () {
    return (<svg width="23" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.41 1.6 0 3.01 5 8c-1.66 0-3 1.34-3 3v6h4v4h12l2.95 2.96 1.41-1.41zM6 15H4v-4c0-.55.45-1 1-1h2l3 3H6zm2 4v-4h4l4 4zM8 5h8v3h-5.34l2 2H19c.55 0 1 .45 1 1v4l-2 .01V13h-2.34l4 4H22v-6c0-1.66-1.34-3-3-3h-1V3H6v.36l2 2z" fill="currentColor"/>
      <circle cx="18" cy="11.51" r="1" fill="currentColor"/>
    </svg>);
};
var PrintOutlined = function () {
    return (<svg width="22" height="21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3M8 5h8v3H8zm8 12v2H8v-4h8zm2-2v-2H6v2H4v-4c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v4z" fill="currentColor"/>
      <circle cx="18" cy="11.51" r="1" fill="currentColor"/>
    </svg>);
};
var PrintVisitLabelButton = function (_a) {
    var encounterId = _a.encounterId;
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var _b = (0, react_1.useState)(false), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(false), isError = _c[0], setIsError = _c[1];
    var handleClick = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var labelPdfs, labelPdf;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!encounterId) {
                        console.warn('cannot print label because encounterId is undefined');
                        return [2 /*return*/];
                    }
                    setLoading(true);
                    if (oystehrZambda === undefined) {
                        console.error('oystehr client undefined. cannot fetch label');
                        setIsError(true);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, (0, api_1.getOrCreateVisitLabel)(oystehrZambda, { encounterId: encounterId })];
                case 1:
                    labelPdfs = _a.sent();
                    if (labelPdfs.length !== 1) {
                        console.error('Expected 1 label pdf, received unexpected number', JSON.stringify(labelPdfs));
                        setIsError(true);
                    }
                    labelPdf = labelPdfs[0];
                    window.open(labelPdf.presignedURL, '_blank');
                    setLoading(false);
                    return [2 /*return*/];
            }
        });
    }); }, [encounterId, oystehrZambda]);
    var tooltipText = isError ? 'An error occurred' : 'Print label';
    var icon = loading ? <material_1.CircularProgress size="15px"/> : isError ? <PrintDisabledOutlined /> : <PrintOutlined />;
    return (<GenericToolTip_1.GenericToolTip title={tooltipText} customWidth="none" placement="top" leaveDelay={100} slotProps={{
            tooltip: {
                sx: {
                    maxWidth: 150,
                    backgroundColor: '#F9FAFB',
                    color: '#000000',
                    border: '1px solid #dadde9',
                },
            },
            popper: {
                modifiers: [{ name: 'offset', options: { offset: [0, -14] } }],
            },
        }}>
      <material_1.ButtonBase onClick={handleClick} disabled={isError} sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#0F347C',
        }}>
        {icon}
      </material_1.ButtonBase>
    </GenericToolTip_1.GenericToolTip>);
};
exports.PrintVisitLabelButton = PrintVisitLabelButton;
//# sourceMappingURL=PrintVisitLabelButton.js.map