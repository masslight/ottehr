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
var VitalsVisionCard = function (_a) {
    var handleSaveVital = _a.handleSaveVital, handleDeleteVital = _a.handleDeleteVital, currentObs = _a.currentObs, historicalObs = _a.historicalObs, historyElementSkeletonText = _a.historyElementSkeletonText;
    var theme = (0, material_1.useTheme)();
    var _b = (0, react_1.useState)(''), leftEyeSelection = _b[0], setLeftEyeSelection = _b[1];
    var _c = (0, react_1.useState)(''), rightEyeSelection = _c[0], setRightEyeSelection = _c[1];
    var _d = (0, react_1.useState)(''), bothEyesSelection = _d[0], setBothEyesSelection = _d[1];
    var _e = (0, react_1.useState)(false), isChildTooYoungOptionSelected = _e[0], setChildTooYoungOptionSelected = _e[1];
    var _f = (0, react_1.useState)(false), isWithGlassesOptionSelected = _f[0], setWithGlassesOptionSelected = _f[1];
    var _g = (0, react_1.useState)(false), isWithoutGlassesOptionSelected = _g[0], setWithoutGlassesOptionSelected = _g[1];
    var _h = (0, react_1.useState)(false), isSaving = _h[0], setIsSaving = _h[1];
    var _j = (0, react_1.useState)(false), isCollapsed = _j[0], setIsCollapsed = _j[1];
    var handleSectionCollapse = (0, react_1.useCallback)(function () {
        setIsCollapsed(function (prevCollapseState) { return !prevCollapseState; });
    }, [setIsCollapsed]);
    var isAddButtonDisabled = !leftEyeSelection || !rightEyeSelection;
    var isCheckboxesDisabled = isSaving;
    var isLargeScreen = (0, useScreenDimensions_1.useScreenDimensions)().isLargeScreen;
    var latestVisionValueLabel = (function () {
        var latestHistoryEntry = currentObs[0];
        if (!latestHistoryEntry)
            return;
        var visionOptionsLine = (0, utils_1.getVisionExtraOptionsFormattedString)(latestHistoryEntry.extraVisionOptions);
        return "Left eye: ".concat(latestHistoryEntry.leftEyeVisionText, "; Right eye: ").concat(latestHistoryEntry.rightEyeVisionText, "; ").concat(visionOptionsLine !== null && visionOptionsLine !== void 0 ? visionOptionsLine : '');
    })();
    var handleSaveVisionObservation = function (leftEyeVisionText, rightEyeVisionText) { return __awaiter(void 0, void 0, void 0, function () {
        var extraOptions, vitalObs, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!leftEyeVisionText)
                        return [2 /*return*/];
                    if (!rightEyeVisionText)
                        return [2 /*return*/];
                    extraOptions = [];
                    if (isChildTooYoungOptionSelected) {
                        extraOptions.push('child_too_young');
                    }
                    if (isWithGlassesOptionSelected) {
                        extraOptions.push('with_glasses');
                    }
                    if (isWithoutGlassesOptionSelected) {
                        extraOptions.push('without_glasses');
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    setIsSaving(true);
                    vitalObs = {
                        field: utils_1.VitalFieldNames.VitalVision,
                        leftEyeVisionText: leftEyeVisionText,
                        rightEyeVisionText: rightEyeVisionText,
                        extraVisionOptions: extraOptions,
                    };
                    return [4 /*yield*/, handleSaveVital(vitalObs)];
                case 2:
                    _b.sent();
                    setLeftEyeSelection('');
                    setRightEyeSelection('');
                    setBothEyesSelection('');
                    setChildTooYoungOptionSelected(false);
                    setWithGlassesOptionSelected(false);
                    setWithoutGlassesOptionSelected(false);
                    return [3 /*break*/, 5];
                case 3:
                    _a = _b.sent();
                    (0, notistack_1.enqueueSnackbar)('Error saving Vision vital data', { variant: 'error' });
                    return [3 /*break*/, 5];
                case 4:
                    setIsSaving(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleLeftEyeSelectionChange = (0, react_1.useCallback)(function (event) {
        var eventValue = event.target.value;
        var selectedLeftEye = eventValue !== null && eventValue !== void 0 ? eventValue : '';
        setLeftEyeSelection(selectedLeftEye);
        if (selectedLeftEye !== rightEyeSelection) {
            setBothEyesSelection('');
        }
    }, [rightEyeSelection]);
    var handleRightEyeSelectionChange = (0, react_1.useCallback)(function (event) {
        var eventValue = event.target.value;
        var selectedRightEye = eventValue !== null && eventValue !== void 0 ? eventValue : '';
        setRightEyeSelection(selectedRightEye);
        if (selectedRightEye !== leftEyeSelection) {
            setBothEyesSelection('');
        }
    }, [leftEyeSelection]);
    var handleBothEyesSelectionChange = (0, react_1.useCallback)(function (event) {
        var eventValue = event.target.value;
        var selectedBothEyes = eventValue !== null && eventValue !== void 0 ? eventValue : '';
        setBothEyesSelection(selectedBothEyes);
        setLeftEyeSelection(selectedBothEyes);
        setRightEyeSelection(selectedBothEyes);
    }, []);
    var handleVisionOptionChanged = (0, react_1.useCallback)(function (isChecked, visionOption) {
        if (visionOption === 'child_too_young') {
            setChildTooYoungOptionSelected(isChecked);
        }
        if (visionOption === 'with_glasses') {
            setWithGlassesOptionSelected(isChecked);
            setWithoutGlassesOptionSelected(false);
        }
        if (visionOption === 'without_glasses') {
            setWithoutGlassesOptionSelected(isChecked);
            setWithGlassesOptionSelected(false);
        }
    }, []);
    return (<material_1.Box sx={{ mt: 3 }}>
      <components_1.AccordionCard label={"Vision ".concat(latestVisionValueLabel !== null && latestVisionValueLabel !== void 0 ? latestVisionValueLabel : '')} collapsed={isCollapsed} onSwitch={handleSectionCollapse}>
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
              {/* Left eye vision selector */}
              <material_1.Grid item xs={12} sm={3} md={3} lg={3} order={{ xs: 1, sm: 1, md: 1 }}>
                <material_1.Box sx={{
                display: 'flex',
                flexDirection: 'row',
                ml: 0,
            }}>
                  <VitalsTextInputFiled_1.VitalsTextFreeInputField label="Left eye" value={leftEyeSelection} disabled={isSaving} isInputError={false} onChange={handleLeftEyeSelectionChange}/>
                </material_1.Box>
              </material_1.Grid>

              {/* Right eye vision selector */}
              <material_1.Grid item xs={12} sm={3} md={3} lg={3} order={{ xs: 2, sm: 2, md: 2, lg: 2 }}>
                <material_1.Box sx={{
                display: 'flex',
                flexDirection: 'row',
                ml: 1,
            }}>
                  <VitalsTextInputFiled_1.VitalsTextFreeInputField label="Right eye" value={rightEyeSelection} disabled={isSaving} isInputError={false} onChange={handleRightEyeSelectionChange}/>
                </material_1.Box>
              </material_1.Grid>

              {/* Both eye vision selector */}
              <material_1.Grid item xs={12} sm={3} md={3} lg={3} order={{ xs: 3, sm: 3, md: 3, lg: 3 }} sx={{ mt: isLargeScreen ? 0 : 0 }}>
                <material_1.Box sx={{
                display: 'flex',
                flexDirection: 'row',
                ml: 1,
            }}>
                  <VitalsTextInputFiled_1.VitalsTextFreeInputField label="Both eyes" value={bothEyesSelection} disabled={isSaving} isInputError={false} onChange={handleBothEyesSelectionChange}/>
                </material_1.Box>
              </material_1.Grid>

              {/* Add Button column */}
              <material_1.Grid item xs={12} sm={3} md={3} lg={3} order={{ xs: 4, sm: 4, md: 4, lg: 4 }} sx={{ mt: 0 }}>
                <RoundedButton_1.RoundedButton disabled={isAddButtonDisabled} loading={isSaving} onClick={function () { return handleSaveVisionObservation(leftEyeSelection, rightEyeSelection); }} color="primary" sx={{
                height: '40px',
                px: 2,
                ml: 1,
            }}>
                  Add
                </RoundedButton_1.RoundedButton>
              </material_1.Grid>

              <material_1.Grid item xs={12} sm={12} md={12} lg={12} order={{ xs: 5, sm: 5, md: 5, lg: 5 }} sx={{ mt: isLargeScreen ? 1 : 1, ml: 1 }}>
                <material_1.Box sx={{ display: 'flex', flexDirection: 'row' }}>
                  {/* Child too young checkbox option */}
                  <material_1.FormControlLabel sx={{
                backgroundColor: 'transparent',
                pr: 0,
            }} control={<material_1.Checkbox size="small" sx={{
                    color: theme.palette.primary.main,
                    '&.Mui-checked': {
                        color: theme.palette.primary.main,
                    },
                    '&.Mui-disabled': {
                        color: (0, material_1.lighten)(theme.palette.primary.main, 0.4),
                    },
                }} disabled={isCheckboxesDisabled} checked={isChildTooYoungOptionSelected} onChange={function (e) { return handleVisionOptionChanged(e.target.checked, 'child_too_young'); }}/>} label={<material_1.Typography sx={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: isCheckboxesDisabled
                        ? (0, material_1.lighten)(theme.palette.text.primary, 0.4)
                        : theme.palette.text.primary,
                }}>
                        Child too young
                      </material_1.Typography>}/>

                  {/* With glasses checkbox option */}
                  <material_1.FormControlLabel sx={{
                backgroundColor: 'transparent',
                pr: 0,
            }} control={<material_1.Checkbox size="small" sx={{
                    color: theme.palette.primary.main,
                    '&.Mui-checked': {
                        color: theme.palette.primary.main,
                    },
                    '&.Mui-disabled': {
                        color: (0, material_1.lighten)(theme.palette.primary.main, 0.4),
                    },
                }} disabled={isCheckboxesDisabled} checked={isWithGlassesOptionSelected} onChange={function (e) { return handleVisionOptionChanged(e.target.checked, 'with_glasses'); }}/>} label={<material_1.Typography sx={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: isCheckboxesDisabled
                        ? (0, material_1.lighten)(theme.palette.text.primary, 0.4)
                        : theme.palette.text.primary,
                }}>
                        With glasses
                      </material_1.Typography>}/>

                  {/* Without glasses checkbox option */}
                  <material_1.FormControlLabel sx={{
                backgroundColor: 'transparent',
                pr: 0,
            }} control={<material_1.Checkbox size="small" sx={{
                    color: theme.palette.primary.main,
                    '&.Mui-checked': {
                        color: theme.palette.primary.main,
                    },
                    '&.Mui-disabled': {
                        color: (0, material_1.lighten)(theme.palette.primary.main, 0.4),
                    },
                }} disabled={isCheckboxesDisabled} checked={isWithoutGlassesOptionSelected} onChange={function (e) { return handleVisionOptionChanged(e.target.checked, 'without_glasses'); }}/>} label={<material_1.Typography sx={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: isCheckboxesDisabled
                        ? (0, material_1.lighten)(theme.palette.text.primary, 0.4)
                        : theme.palette.text.primary,
                }}>
                        Without glasses
                      </material_1.Typography>}/>
                </material_1.Box>
              </material_1.Grid>
            </material_1.Grid>} rightColumn={<VitalsHistoryContainer_1.default historicalObs={historicalObs} currentEncounterObs={currentObs} isLoading={false} historyElementSkeletonText={historyElementSkeletonText} historyElementCreator={function (historyEntry) {
                var isCurrent = currentObs.some(function (obs) { return obs.resourceId === historyEntry.resourceId; });
                return (<VitalsHistoryEntry_1.default historyEntry={historyEntry} onDelete={isCurrent ? handleDeleteVital : undefined}/>);
            }}/>}/>
      </components_1.AccordionCard>
    </material_1.Box>);
};
exports.default = VitalsVisionCard;
//# sourceMappingURL=VitalsVisionCard.js.map