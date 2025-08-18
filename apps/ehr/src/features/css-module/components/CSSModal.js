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
exports.CSSModal = CSSModal;
var Warning_1 = require("@mui/icons-material/Warning");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var CustomDialog_1 = require("../../../components/dialogs/CustomDialog");
var data_test_ids_1 = require("../../../constants/data-test-ids");
function CSSModal(_a) {
    var _this = this;
    var _handleConfirm = _a.handleConfirm, entity = _a.entity, errorMessage = _a.errorMessage, _b = _a.icon, icon = _b === void 0 ? <Warning_1.default sx={{ mr: 1 }}/> : _b, _c = _a.showEntityPreview, showEntityPreview = _c === void 0 ? true : _c, _d = _a.getEntityPreviewText, getEntityPreviewText = _d === void 0 ? function (entity) { return (entity !== undefined ? JSON.stringify(entity) : ''); } : _d, open = _a.open, handleClose = _a.handleClose, title = _a.title, description = _a.description, closeButtonText = _a.closeButtonText, closeButton = _a.closeButton, confirmText = _a.confirmText, error = _a.error, _e = _a.color, color = _e === void 0 ? 'error.main' : _e, _f = _a.ContentComponent, ContentComponent = _f === void 0 ? react_1.default.Fragment : _f, disabled = _a.disabled;
    var _g = (0, react_1.useState)(false), isPerformingAction = _g[0], setIsPerformingAction = _g[1];
    var _h = (0, react_1.useState)(undefined), errorFromAction = _h[0], setError = _h[1];
    var handleConfirm = function () { return __awaiter(_this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    setIsPerformingAction(true);
                    setError(undefined);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, _handleConfirm(entity)];
                case 2:
                    _b.sent();
                    handleClose();
                    return [3 /*break*/, 5];
                case 3:
                    _a = _b.sent();
                    setError(errorMessage);
                    (0, notistack_1.enqueueSnackbar)(errorMessage, { variant: 'error' });
                    return [3 /*break*/, 5];
                case 4:
                    setIsPerformingAction(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var dialogTitle = (<material_1.Box display="flex" alignItems="center" color={color} data-testid={data_test_ids_1.dataTestIds.cssModal.confirmationDialogue}>
      {icon}
      <material_1.Typography variant="h4">{title}</material_1.Typography>
    </material_1.Box>);
    var dialogContent = (<>
      <material_1.Typography>{description}</material_1.Typography>
      {showEntityPreview && entity !== undefined && (<material_1.Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
          <material_1.Typography variant="body1" color="text.main">
            {getEntityPreviewText(entity)}
          </material_1.Typography>
        </material_1.Box>)}
      <ContentComponent />
    </>);
    return (<CustomDialog_1.CustomDialog open={open} handleClose={handleClose} title={dialogTitle} description={dialogContent} closeButton={closeButton} closeButtonText={closeButtonText} handleConfirm={handleConfirm} confirmText={confirmText} confirmLoading={isPerformingAction} error={error || errorFromAction} disabled={disabled}/>);
}
//# sourceMappingURL=CSSModal.js.map