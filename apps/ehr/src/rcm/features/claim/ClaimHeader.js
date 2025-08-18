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
exports.ClaimHeader = void 0;
var auth0_react_1 = require("@auth0/auth0-react");
var colors_1 = require("@ehrTheme/colors");
var FileDownloadOutlined_1 = require("@mui/icons-material/FileDownloadOutlined");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var files_helper_1 = require("../../../helpers/files.helper");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var state_1 = require("../../state");
var claims_queue_1 = require("../claims-queue");
var formatDate = function (date) {
    var dt = luxon_1.DateTime.fromISO(date);
    return "Last updated on ".concat(dt.toFormat('MM/dd/yyyy'), " at ").concat(dt.toFormat('h:mm a'));
};
var ClaimHeader = function () {
    var _a, _b, _c, _d;
    var _e = (0, getSelectors_1.getSelectors)(state_1.useClaimStore, [
        'patientData',
        'claim',
        'appointment',
        'visitNoteDocument',
    ]), patientData = _e.patientData, claim = _e.claim, appointment = _e.appointment, visitNoteDocument = _e.visitNoteDocument;
    var getAccessTokenSilently = (0, auth0_react_1.useAuth0)().getAccessTokenSilently;
    var _f = (0, react_1.useState)(), visitNotePresignedURL = _f[0], setVisitNotePresignedURL = _f[1];
    (0, react_1.useEffect)(function () {
        function getPresignedTemplateUrls() {
            return __awaiter(this, void 0, void 0, function () {
                var authToken, z3Url, presignedUrl, _a;
                var _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _d.trys.push([0, 4, , 5]);
                            return [4 /*yield*/, getAccessTokenSilently()];
                        case 1:
                            authToken = _d.sent();
                            z3Url = (_c = (_b = visitNoteDocument === null || visitNoteDocument === void 0 ? void 0 : visitNoteDocument.content) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.attachment.url;
                            if (!z3Url) return [3 /*break*/, 3];
                            return [4 /*yield*/, (0, files_helper_1.getPresignedFileUrl)(z3Url, authToken)];
                        case 2:
                            presignedUrl = _d.sent();
                            setVisitNotePresignedURL(presignedUrl);
                            _d.label = 3;
                        case 3: return [3 /*break*/, 5];
                        case 4:
                            _a = _d.sent();
                            console.error('Error while trying to get presigned url');
                            return [3 /*break*/, 5];
                        case 5: return [2 /*return*/];
                    }
                });
            });
        }
        if (visitNoteDocument) {
            void getPresignedTemplateUrls();
        }
    }, [getAccessTokenSilently, visitNoteDocument]);
    var status = (_c = (_b = (_a = claim === null || claim === void 0 ? void 0 : claim.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.system === 'current-status'; })) === null || _c === void 0 ? void 0 : _c.code;
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
        }}>
      <material_1.Box sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
        }}>
        <material_1.Typography variant="h3" color="primary.dark">
          Claim for {patientData === null || patientData === void 0 ? void 0 : patientData.firstLastName}
        </material_1.Typography>

        {status && <claims_queue_1.ClaimStatusChip status={status}/>}

        {((_d = claim === null || claim === void 0 ? void 0 : claim.meta) === null || _d === void 0 ? void 0 : _d.lastUpdated) && (<material_1.Typography variant="body2" color="text.secondary">
            {formatDate(claim.meta.lastUpdated)}
          </material_1.Typography>)}
      </material_1.Box>

      <material_1.Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
        }}>
        <material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
        }}>
          <material_1.Typography variant="body2" color="text.secondary">
            CID: {claim === null || claim === void 0 ? void 0 : claim.id}
          </material_1.Typography>
          <material_1.Typography variant="body2" color="text.secondary">
            VID: {appointment === null || appointment === void 0 ? void 0 : appointment.id}
          </material_1.Typography>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', gap: 2 }}>
          <material_1.Card elevation={0} sx={{
            backgroundColor: colors_1.otherColors.lightIconButton,
            display: 'flex',
            alignItems: 'center',
            px: 2,
            gap: 1,
        }}>
            <material_1.Typography variant="subtitle1" fontSize={16} color="primary.dark">
              Full visit note
            </material_1.Typography>

            <material_1.Button sx={{
            textTransform: 'none',
            fontWeight: 500,
            fontSize: 16,
        }} startIcon={<FileDownloadOutlined_1.default />} disabled={!visitNotePresignedURL} onClick={function () { return window.open(visitNotePresignedURL, '_blank'); }}>
              Download PDF
            </material_1.Button>
          </material_1.Card>

          {/*<RoundedButton startIcon={<RestartAltIcon />}>Refresh Demographics</RoundedButton>*/}
          {/*<RoundedButton startIcon={<OpenInNewIcon />}>Export</RoundedButton>*/}
        </material_1.Box>
      </material_1.Box>
    </material_1.Box>);
};
exports.ClaimHeader = ClaimHeader;
//# sourceMappingURL=ClaimHeader.js.map