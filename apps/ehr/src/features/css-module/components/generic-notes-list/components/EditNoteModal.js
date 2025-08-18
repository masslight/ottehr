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
exports.EditNoteModal = void 0;
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var RoundedButton_1 = require("../../../../../components/RoundedButton");
var TextFieldStyled_1 = require("./ui/TextFieldStyled");
var EditNoteModal = function (_a) {
    var open = _a.open, onClose = _a.onClose, entity = _a.entity, onEdit = _a.onEdit, locales = _a.locales;
    var theme = (0, material_1.useTheme)();
    var _b = (0, react_1.useState)(entity.text), editedText = _b[0], setEditedText = _b[1];
    var _c = (0, react_1.useState)(false), isSaving = _c[0], setIsSaving = _c[1];
    var handleChange = function (e) {
        setEditedText(e.target.value);
    };
    var handleSave = function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!editedText)
                        return [2 /*return*/];
                    setIsSaving(true);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, onEdit(entity, editedText)];
                case 2:
                    _b.sent();
                    onClose();
                    return [3 /*break*/, 5];
                case 3:
                    _a = _b.sent();
                    (0, notistack_1.enqueueSnackbar)(locales.getGenericErrorMessage(), { variant: 'error' });
                    return [3 /*break*/, 5];
                case 4:
                    setIsSaving(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (<material_1.Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <material_1.DialogTitle>
        <material_1.Box display="flex" alignItems="center" color={theme.palette.primary.dark}>
          <material_1.Typography variant="h4">{locales.editModalTitle}</material_1.Typography>
        </material_1.Box>
      </material_1.DialogTitle>
      <material_1.DialogContent>
        <TextFieldStyled_1.TextFieldStyled autoFocus margin="dense" id="entity-text" label={locales.editModalPlaceholder} type="text" fullWidth multiline rows={6} variant="outlined" value={editedText} onChange={handleChange} sx={{ mt: 2 }}/>
      </material_1.DialogContent>
      <material_1.DialogActions sx={{ px: 3, py: 1, pb: 3 }}>
        <RoundedButton_1.RoundedButton onClick={onClose} variant="outlined" sx={{ color: 'indigo', borderColor: 'indigo', mr: 1 }}>
          {locales.getLeaveButtonText()}
        </RoundedButton_1.RoundedButton>
        <RoundedButton_1.RoundedButton disabled={!editedText || isSaving} onClick={handleSave} variant="contained" sx={{ bgcolor: 'indigo', '&:hover': { bgcolor: 'indigo' } }} startIcon={isSaving ? <material_1.CircularProgress size={20} color="inherit"/> : null}>
          {locales.getSaveButtonText(isSaving)}
        </RoundedButton_1.RoundedButton>
      </material_1.DialogActions>
    </material_1.Dialog>);
};
exports.EditNoteModal = EditNoteModal;
//# sourceMappingURL=EditNoteModal.js.map