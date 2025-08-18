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
exports.EditableNotesList = void 0;
var ArrowDropDown_1 = require("@mui/icons-material/ArrowDropDown");
var ArrowDropUp_1 = require("@mui/icons-material/ArrowDropUp");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var RoundedButton_1 = require("../../../../../components/RoundedButton");
var CSSLoader_1 = require("../../CSSLoader");
var useNoteHandlers_1 = require("../hooks/useNoteHandlers");
var NoteEntity_1 = require("./NoteEntity");
var ButtonStyled_1 = require("./ui/ButtonStyled");
var PaperStyled_1 = require("./ui/PaperStyled");
var TextFieldStyled_1 = require("./ui/TextFieldStyled");
var EditableNotesList = function (_a) {
    var currentEncounterId = _a.currentEncounterId, locales = _a.locales, apiConfig = _a.apiConfig, encounterId = _a.encounterId, patientId = _a.patientId, separateEncounterNotes = _a.separateEncounterNotes;
    var _b = (0, useNoteHandlers_1.useNoteHandlers)({
        encounterId: encounterId,
        patientId: patientId,
        apiConfig: apiConfig,
        locales: locales,
    }), entities = _b.entities, isLoading = _b.isLoading, handleSave = _b.handleSave, handleEdit = _b.handleEdit, handleDelete = _b.handleDelete;
    var theme = (0, material_1.useTheme)();
    var _c = (0, react_1.useState)(false), isSaving = _c[0], setIsSaving = _c[1];
    var _d = (0, react_1.useState)(false), isMoreEntitiesShown = _d[0], setIsMoreEntitiesShown = _d[1];
    var _e = (0, react_1.useState)(''), savingEntityText = _e[0], setSavingEntityText = _e[1];
    var toggleShowMore = function () {
        setIsMoreEntitiesShown(function (state) { return !state; });
    };
    var handleSaveEntity = function (text) { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!text)
                        return [2 /*return*/];
                    setIsSaving(true);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, handleSave(text)];
                case 2:
                    _b.sent();
                    setSavingEntityText('');
                    return [3 /*break*/, 5];
                case 3:
                    _a = _b.sent();
                    (0, notistack_1.enqueueSnackbar)(locales.getErrorMessage('saving', locales.entityLabel), { variant: 'error' });
                    return [3 /*break*/, 5];
                case 4:
                    setIsSaving(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var currentEncounterEntities = entities.filter(function (entity) { return entity.encounterId === currentEncounterId; });
    var otherEncountersEntities = entities.filter(function (entity) { return entity.encounterId !== currentEncounterId; });
    if (!entities.length && isLoading)
        return <CSSLoader_1.CSSLoader height="80px" marginTop="20px" backgroundColor={theme.palette.background.paper}/>;
    return (<PaperStyled_1.PaperStyled>
      <material_1.Grid container spacing={1} alignItems="center" sx={{ p: 3 }}>
        <material_1.Grid item xs>
          <TextFieldStyled_1.TextFieldStyled onKeyDown={function (event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (!savingEntityText)
                    return;
                void handleSaveEntity(savingEntityText);
            }
        }} onChange={function (e) { return setSavingEntityText(e.target.value); }} value={savingEntityText} disabled={isSaving} label={"Enter ".concat(locales.entityLabel, "...")}/>
        </material_1.Grid>
        <material_1.Grid item>
          <RoundedButton_1.RoundedButton disabled={!savingEntityText || isSaving} onClick={function () { return handleSaveEntity(savingEntityText); }} variant="contained" color="primary" sx={{
            height: '46px',
            minWidth: '80px',
            px: 2,
        }} startIcon={isSaving ? <material_1.CircularProgress size={20} color="inherit"/> : null}>
            {locales.getAddButtonText(isSaving)}
          </RoundedButton_1.RoundedButton>
        </material_1.Grid>
      </material_1.Grid>

      {currentEncounterEntities.map(function (entity) { return (<NoteEntity_1.NoteEntity key={entity.resourceId} entity={entity} onEdit={handleEdit} onDelete={handleDelete} locales={locales}/>); })}

      {otherEncountersEntities.length > 0 && separateEncounterNotes && (<ButtonStyled_1.ButtonStyled onClick={toggleShowMore} startIcon={isMoreEntitiesShown ? <ArrowDropUp_1.default /> : <ArrowDropDown_1.default />}>
          {locales.getMoreButtonText(isMoreEntitiesShown)}
        </ButtonStyled_1.ButtonStyled>)}

      {(isMoreEntitiesShown || !separateEncounterNotes) &&
            otherEncountersEntities.map(function (entity) { return (<NoteEntity_1.NoteEntity key={entity.resourceId} entity={entity} onEdit={handleEdit} onDelete={handleDelete} locales={locales}/>); })}
    </PaperStyled_1.PaperStyled>);
};
exports.EditableNotesList = EditableNotesList;
//# sourceMappingURL=EditableNotesList.js.map