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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AppointmentNotesHistory;
var EditOutlined_1 = require("@mui/icons-material/EditOutlined");
var material_1 = require("@mui/material");
var react_1 = require("react");
var helpers_1 = require("../helpers");
var helpers_2 = require("../helpers");
var dialogs_1 = require("./dialogs");
function AppointmentNotesHistory(_a) {
    var _this = this;
    var appointment = _a.appointment, location = _a.location, curNoteAndHistory = _a.curNoteAndHistory, user = _a.user, oystehr = _a.oystehr, setAppointment = _a.setAppointment, getAndSetHistoricResources = _a.getAndSetHistoricResources;
    var theme = (0, material_1.useTheme)();
    // for historical notes (not sure if needed)
    var noteLastModified = (0, helpers_1.formatLastModifiedTag)('comment', appointment, location);
    var _b = (0, react_1.useState)((appointment === null || appointment === void 0 ? void 0 : appointment.comment) || ''), noteEdit = _b[0], setNoteEdit = _b[1];
    var _c = (0, react_1.useState)(false), editNoteDialogOpen = _c[0], setEditNoteDialogOpen = _c[1];
    var _d = (0, react_1.useState)(false), loading = _d[0], setLoading = _d[1];
    var _e = (0, react_1.useState)(false), error = _e[0], setError = _e[1];
    var handleNoteUpdate = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var updatedAppointment, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    setLoading(true);
                    if (!(!appointment || !oystehr)) return [3 /*break*/, 1];
                    setError(true);
                    return [3 /*break*/, 5];
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, (0, helpers_2.patchAppointmentComment)(appointment, noteEdit, user, oystehr)];
                case 2:
                    updatedAppointment = _a.sent();
                    console.log('updatedAppointment', updatedAppointment);
                    setAppointment(updatedAppointment);
                    return [4 /*yield*/, getAndSetHistoricResources({ notes: true })];
                case 3:
                    _a.sent();
                    setEditNoteDialogOpen(false);
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _a.sent();
                    console.log('error updating appointment', e_1);
                    setError(true);
                    return [3 /*break*/, 5];
                case 5:
                    setLoading(false);
                    return [2 /*return*/];
            }
        });
    }); };
    var noteBlock = function (note, dtAdded, showEdit) { return (<>
      <material_1.Box sx={{ display: 'flex', mt: 2, justifyContent: 'space-between' }}>
        {note !== '' && (<>
            <material_1.Typography sx={{
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'center',
                color: theme.palette.primary.dark,
                whiteSpace: 'pre-line',
            }} variant="body1">
              {note}
            </material_1.Typography>
            {showEdit && (<material_1.IconButton sx={{ color: 'primary.main', width: '24px', height: '24px' }} onClick={function () { return setEditNoteDialogOpen(true); }}>
                <EditOutlined_1.default sx={{ width: '24px', height: '24px' }}/>
              </material_1.IconButton>)}
          </>)}
      </material_1.Box>
      <material_1.Box display="flex" justifyContent="space-between">
        <material_1.Typography sx={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            color: theme.palette.secondary.light,
            mt: "".concat(note !== '' ? '13px' : '0'),
        }} variant="body2">
          {note === '' && "note removed "}
          {dtAdded}
        </material_1.Typography>
        {note === '' && showEdit && (<material_1.IconButton sx={{ color: 'primary.main', width: '24px', height: '24px' }} onClick={function () { return setEditNoteDialogOpen(true); }}>
            <EditOutlined_1.default sx={{ width: '24px', height: '24px' }}/>
          </material_1.IconButton>)}
      </material_1.Box>
    </>); };
    var _f = (0, react_1.useMemo)(function () {
        var curNoteAndHistoryCopy = __spreadArray([], (curNoteAndHistory || []), true);
        var curNote = curNoteAndHistoryCopy === null || curNoteAndHistoryCopy === void 0 ? void 0 : curNoteAndHistoryCopy.shift();
        var notesHistory = curNoteAndHistoryCopy;
        return { curNote: curNote, notesHistory: notesHistory };
    }, [curNoteAndHistory]), curNote = _f.curNote, notesHistory = _f.notesHistory;
    // for historical notes (not sure if needed)
    if (noteLastModified && (appointment === null || appointment === void 0 ? void 0 : appointment.comment)) {
        return (<material_1.Paper sx={{
                marginTop: 2,
                padding: 3,
            }}>
        <material_1.Typography variant="h4" color="primary.dark">
          Current tracking board note
        </material_1.Typography>
        {noteBlock(appointment.comment, noteLastModified, true)}
      </material_1.Paper>);
    }
    return (<material_1.Paper sx={{
            marginTop: 2,
            padding: 3,
        }}>
      <material_1.Typography variant="h4" color="primary.dark">
        Current tracking board note
      </material_1.Typography>

      {curNoteAndHistory ? (<>
          {curNote && (<material_1.Table size="small" style={{ tableLayout: 'fixed' }}>
              <material_1.TableBody>
                <material_1.TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <material_1.TableCell sx={{
                    width: '50%',
                    color: theme.palette.primary.dark,
                    padding: '0 8px 16px 0px',
                }}>
                    {noteBlock(curNote.note, curNote.noteAddedByAndWhen, true)}
                  </material_1.TableCell>
                </material_1.TableRow>
              </material_1.TableBody>
            </material_1.Table>)}

          {notesHistory.length > 0 && (<material_1.Typography variant="h4" color="primary.dark" sx={{ mt: 1 }}>
              History
            </material_1.Typography>)}

          <material_1.Table size="small" style={{ tableLayout: 'fixed' }}>
            <material_1.TableBody>
              {notesHistory === null || notesHistory === void 0 ? void 0 : notesHistory.map(function (note, idx) { return (<material_1.TableRow key={idx} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <material_1.TableCell sx={{
                    width: '50%',
                    color: theme.palette.primary.dark,
                    padding: '0 8px 16px 0px',
                }}>
                    {noteBlock(note.note, note.noteAddedByAndWhen, false)}
                  </material_1.TableCell>
                </material_1.TableRow>); })}
            </material_1.TableBody>
          </material_1.Table>
        </>) : (<material_1.CircularProgress size="20px" sx={{ marginTop: 2.8, marginLeft: 1 }}/>)}

      <dialogs_1.EditPatientInfoDialog title="Update current tracking board note" modalOpen={editNoteDialogOpen} onClose={function () {
            setEditNoteDialogOpen(false);
            setNoteEdit((appointment === null || appointment === void 0 ? void 0 : appointment.comment) || '');
        }} input={<>
            <material_1.TextField multiline label="Note" required sx={{ width: '500px' }} value={noteEdit} onChange={function (e) { return setNoteEdit(e.target.value.trimStart()); }} inputProps={{ maxLength: 160 }}/>
          </>} onSubmit={handleNoteUpdate} submitButtonName="Update note" loading={loading} error={error} errorMessage="Failed to update note"/>
    </material_1.Paper>);
}
//# sourceMappingURL=AppointmentNotesHistory.js.map