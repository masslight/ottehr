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
var EditNote_1 = require("@mui/icons-material/EditNote");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var helpers_1 = require("../helpers");
var GenericToolTip_1 = require("./GenericToolTip");
var AppointmentNote = function (_a) {
    var appointment = _a.appointment, oystehr = _a.oystehr, user = _a.user, updateAppointments = _a.updateAppointments, setEditingComment = _a.setEditingComment;
    var theme = (0, material_1.useTheme)();
    var _b = (0, react_1.useState)(appointment.comment || ''), apptComment = _b[0], setApptComment = _b[1];
    var _c = (0, react_1.useState)(false), noteSaving = _c[0], setNoteSaving = _c[1];
    var _d = (0, react_1.useState)(false), editingRow = _d[0], setEditingRow = _d[1];
    var _e = (0, react_1.useState)(false), isOverflowing = _e[0], setIsOverflowing = _e[1];
    var inputRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(function () {
        if (inputRef.current && !editingRow) {
            var isOverflow = inputRef.current.scrollHeight > inputRef.current.clientHeight;
            setIsOverflowing(isOverflow);
        }
    }, [apptComment, editingRow]);
    var saveNote = (0, react_1.useCallback)(function (_event) { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr) {
                        throw new Error('error getting oystehr client');
                    }
                    if (!appointment.id) {
                        throw new Error('error getting appointment id');
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    setNoteSaving(true);
                    return [4 /*yield*/, (0, helpers_1.patchAppointmentComment)(appointment, apptComment, user, oystehr)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    // todo tell the user there was an error
                    console.log('error adding comment: ', error_1);
                    setApptComment(appointment.comment || '');
                    return [3 /*break*/, 4];
                case 4:
                    setNoteSaving(false);
                    setEditingRow(false);
                    setEditingComment(false);
                    return [4 /*yield*/, updateAppointments()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [oystehr, appointment, setEditingComment, updateAppointments, apptComment, user]);
    var inputComponent = (0, react_1.useMemo)(function () { return (<>
        <material_1.Input inputRef={inputRef} placeholder={'Add internal note...'} value={apptComment} onChange={function (e) { return setApptComment(e.target.value); }} multiline disableUnderline={!editingRow} inputProps={{
            maxLength: 160,
            style: editingRow
                ? {}
                : {
                    display: '-webkit-box',
                    overflow: 'hidden',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    height: '3em', // Approximate height for 2 lines of text
                },
        }} onClick={function (_event) {
            setEditingRow(true);
        }} fullWidth sx={{ alignItems: 'baseline' }} startAdornment={<material_1.InputAdornment position="start">
              <EditNote_1.default sx={{ fill: theme.palette.text.disabled }}/>
            </material_1.InputAdornment>}/>
        {editingRow && (<lab_1.LoadingButton loading={noteSaving} sx={{ marginTop: '8px', padding: '5px' }} onClick={saveNote}>
            Save
          </lab_1.LoadingButton>)}
      </>); }, [apptComment, editingRow, noteSaving, saveNote, theme.palette.text.disabled]);
    return isOverflowing && !editingRow ? (<GenericToolTip_1.GenericToolTip title={apptComment}>
      <span style={{ display: 'inline-block', width: '100%' }}>{inputComponent}</span>
    </GenericToolTip_1.GenericToolTip>) : (inputComponent);
};
exports.default = AppointmentNote;
//# sourceMappingURL=AppointmentNote.js.map