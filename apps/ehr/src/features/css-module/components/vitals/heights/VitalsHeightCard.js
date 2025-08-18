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
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var utils_1 = require("utils");
var RoundedButton_1 = require("../../../../../components/RoundedButton");
var components_1 = require("../../../../../telemed/components");
var VitalsHistoryContainer_1 = require("../components/VitalsHistoryContainer");
var VitalsHistoryEntry_1 = require("../components/VitalsHistoryEntry");
var VitalsTextInputFiled_1 = require("../components/VitalsTextInputFiled");
var useScreenDimensions_1 = require("../hooks/useScreenDimensions");
var helpers_1 = require("./helpers");
var VitalsHeightCard = function (_a) {
    var _b;
    var handleSaveVital = _a.handleSaveVital, handleDeleteVital = _a.handleDeleteVital, currentObs = _a.currentObs, historicalObs = _a.historicalObs;
    var _c = (0, react_1.useState)(''), heightValueText = _c[0], setHeightValueText = _c[1];
    var _d = (0, react_1.useState)(false), isHeightValidationError = _d[0], setHeightValidationError = _d[1];
    var isLargeScreen = (0, useScreenDimensions_1.useScreenDimensions)().isLargeScreen;
    var _e = (0, react_1.useState)(false), isCollapsed = _e[0], setIsCollapsed = _e[1];
    var handleSectionCollapse = (0, react_1.useCallback)(function () {
        setIsCollapsed(function (prevCollapseState) { return !prevCollapseState; });
    }, [setIsCollapsed]);
    var _f = (0, react_1.useState)(false), isSaving = _f[0], setIsSaving = _f[1];
    var isDisabledAddButton = !heightValueText || isHeightValidationError;
    var latestHeightValue = (_b = currentObs[0]) === null || _b === void 0 ? void 0 : _b.value;
    var enteredHeightInInch = (0, react_1.useMemo)(function () {
        var heightCm = (0, helpers_1.textToHeightNumber)(heightValueText);
        if (!heightCm)
            return;
        return (0, utils_1.cmToInches)(heightCm);
    }, [heightValueText]);
    var handleSaveHeightObservation = function (heightValueText) { return __awaiter(void 0, void 0, void 0, function () {
        var heightValueNumber, vitalObs, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    heightValueNumber = (0, helpers_1.textToHeightNumber)(heightValueText);
                    if (!heightValueNumber)
                        return [2 /*return*/];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    setIsSaving(true);
                    vitalObs = {
                        field: utils_1.VitalFieldNames.VitalHeight,
                        value: heightValueNumber,
                    };
                    return [4 /*yield*/, handleSaveVital(vitalObs)];
                case 2:
                    _b.sent();
                    setHeightValueText('');
                    return [3 /*break*/, 5];
                case 3:
                    _a = _b.sent();
                    (0, notistack_1.enqueueSnackbar)('Error saving Height vital record', { variant: 'error' });
                    return [3 /*break*/, 5];
                case 4:
                    setIsSaving(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleTextInputChange = (0, react_1.useCallback)(function (e) {
        var heightAsText = e.target.value;
        setHeightValueText(heightAsText);
        if (heightAsText.length === 0) {
            setHeightValidationError(false);
        }
    }, [setHeightValidationError, setHeightValueText]);
    return (<material_1.Box sx={{ mt: 3 }}>
      <components_1.AccordionCard label={"Height (cm) ".concat(latestHeightValue !== null && latestHeightValue !== void 0 ? latestHeightValue : '')} collapsed={isCollapsed} onSwitch={handleSectionCollapse}>
        <components_1.DoubleColumnContainer divider leftColumn={<material_1.Grid container sx={{
                height: 'auto',
                width: 'auto',
                backgroundColor: '#F7F8F9',
                borderRadius: 2,
                my: 2,
                mx: 2,
                py: 2,
                px: 2,
            }}>
              {/* Height Input Field column */}
              <material_1.Grid item xs={12} sm={6} md={6} lg={6} order={{ xs: 1, sm: 1, md: 1 }}>
                <material_1.Box sx={{
                display: 'flex',
                flexDirection: 'row',
            }}>
                  <VitalsTextInputFiled_1.VitalsTextInputFiled label="Height (cm)" value={heightValueText} disabled={isSaving} isInputError={isHeightValidationError} onChange={handleTextInputChange}/>
                  <material_1.Typography fontSize={25} sx={{ ml: 1 }}>
                    /
                  </material_1.Typography>
                  <material_1.TextField fullWidth size="small" label="Height (inch)" sx={{
                '& fieldset': { border: 'none' },
                maxWidth: '110px',
            }} disabled InputLabelProps={{ shrink: true }} value={enteredHeightInInch !== null && enteredHeightInInch !== void 0 ? enteredHeightInInch : ''}/>
                </material_1.Box>
              </material_1.Grid>

              {/* Add Button column */}
              <material_1.Grid item xs={12} sm={6} md={6} lg={6} order={{ xs: 2, sm: 2, md: 2, lg: 2 }} sx={{ mt: isLargeScreen ? 0 : 0 }}>
                <RoundedButton_1.RoundedButton size="small" disabled={isDisabledAddButton} onClick={function () { return handleSaveHeightObservation(heightValueText); }} loading={isSaving} color="primary" sx={{
                height: '40px',
                px: 2,
                ml: 1,
            }}>
                  Add
                </RoundedButton_1.RoundedButton>
              </material_1.Grid>
            </material_1.Grid>} rightColumn={<VitalsHistoryContainer_1.default currentEncounterObs={currentObs} historicalObs={historicalObs} isLoading={false} historyElementCreator={function (historyEntry) {
                var isCurrent = currentObs.some(function (obs) { return obs.resourceId === historyEntry.resourceId; });
                return (<VitalsHistoryEntry_1.default historyEntry={historyEntry} onDelete={isCurrent ? handleDeleteVital : undefined}/>);
            }}/>}/>
      </components_1.AccordionCard>
    </material_1.Box>);
};
exports.default = VitalsHeightCard;
//# sourceMappingURL=VitalsHeightCard.js.map