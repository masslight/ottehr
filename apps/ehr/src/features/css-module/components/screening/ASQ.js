"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.ASQ = void 0;
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var utils_1 = require("utils");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var telemed_1 = require("../../../../telemed");
var useOystehrAPIClient_1 = require("../../../../telemed/hooks/useOystehrAPIClient");
var CSSModal_1 = require("../CSSModal");
var isASQObservationDTO = function (obs) {
    return obs.field === utils_1.ASQ_FIELD;
};
var ASQ = function () {
    var theme = (0, material_1.useTheme)();
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var _a = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, [
        'chartData',
        'updateObservation',
        'encounter',
        'isChartDataLoading',
    ]), chartData = _a.chartData, updateObservation = _a.updateObservation, encounter = _a.encounter, isChartDataLoading = _a.isChartDataLoading;
    var _b = (0, react_1.useState)(''), asqValue = _b[0], setAsqValue = _b[1];
    var _c = (0, react_1.useState)(false), isUpdating = _c[0], setIsUpdating = _c[1];
    var _d = (0, react_1.useState)(false), isModalOpen = _d[0], setIsModalOpen = _d[1];
    var _e = (0, react_1.useState)(''), tempAsqValue = _e[0], setTempAsqValue = _e[1];
    // used for highlight select in the UI
    var _f = (0, react_1.useState)(''), asqError = _f[0], setAsqError = _f[1];
    // used for scroll on error
    var asqRef = (0, react_1.useRef)(null);
    var currentASQObs = (0, react_1.useMemo)(function () { var _a; return (_a = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _a === void 0 ? void 0 : _a.find(function (obs) { return isASQObservationDTO(obs); }); }, [chartData]);
    (0, react_1.useEffect)(function () {
        if (currentASQObs === null || currentASQObs === void 0 ? void 0 : currentASQObs.value) {
            setAsqValue(currentASQObs.value);
        }
    }, [currentASQObs]);
    var handleSaveObservation = function (observation) { return __awaiter(void 0, void 0, void 0, function () {
        var result, _a;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    setIsUpdating(true);
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, ((_b = apiClient === null || apiClient === void 0 ? void 0 : apiClient.saveChartData) === null || _b === void 0 ? void 0 : _b.call(apiClient, {
                            encounterId: (encounter === null || encounter === void 0 ? void 0 : encounter.id) || '',
                            observations: [observation],
                        }))];
                case 2:
                    result = _e.sent();
                    if ((_d = (_c = result === null || result === void 0 ? void 0 : result.chartData) === null || _c === void 0 ? void 0 : _c.observations) === null || _d === void 0 ? void 0 : _d[0]) {
                        updateObservation(result.chartData.observations[0]);
                    }
                    return [3 /*break*/, 5];
                case 3:
                    _a = _e.sent();
                    (0, notistack_1.enqueueSnackbar)('An error occurred while saving the information. Please try again.', {
                        variant: 'error',
                    });
                    return [3 /*break*/, 5];
                case 4:
                    setIsUpdating(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleASQChange = function (value) {
        if (value === utils_1.ASQKeys.Positive) {
            setTempAsqValue(value);
            setIsModalOpen(true);
        }
        else {
            setAsqValue(value);
            void handleSaveObservation((currentASQObs
                ? __assign(__assign({}, currentASQObs), { value: value }) : {
                field: utils_1.ASQ_FIELD,
                value: value,
            }));
        }
    };
    var handleModalClose = function () {
        setIsModalOpen(false);
        setTempAsqValue('');
    };
    var handleModalConfirm = function () {
        setAsqValue(tempAsqValue);
        void handleSaveObservation(currentASQObs
            ? __assign(__assign({}, currentASQObs), { value: tempAsqValue })
            : { field: utils_1.ASQ_FIELD, value: tempAsqValue });
        setIsModalOpen(false);
    };
    return (<material_1.Paper elevation={3} sx={{ p: 3, mt: 3, boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)' }}>
      <material_1.Grid container>
        <material_1.Grid item xs={6}>
          <material_1.FormControl fullWidth sx={{ mb: 2 }} ref={asqRef}>
            <material_1.Typography sx={{
            color: theme.palette.primary.dark,
            mb: 1,
            fontWeight: 'bold',
        }}>
              ASQ
            </material_1.Typography>
            <material_1.Select value={asqValue} onChange={function (e) {
            handleASQChange(e.target.value);
            setAsqError('');
        }} displayEmpty disabled={isUpdating || isChartDataLoading} renderValue={function (selected) { return (selected ? utils_1.asqLabels[selected] : 'Select an option'); }} error={!!asqError}>
              <material_1.MenuItem value="">
                <em>Select an option</em>
              </material_1.MenuItem>
              {Object.values(utils_1.ASQKeys).map(function (key) { return (<material_1.MenuItem key={key} value={key}>
                  {utils_1.asqLabels[key]}
                </material_1.MenuItem>); })}
            </material_1.Select>
          </material_1.FormControl>

          {asqValue === utils_1.ASQKeys.Positive && (<material_1.Alert severity="error" sx={{ mb: 2 }}>
              Critical alert note about positive ASQ. Please verify and notify provider.
            </material_1.Alert>)}
        </material_1.Grid>
      </material_1.Grid>

      <CSSModal_1.CSSModal open={isModalOpen} handleClose={handleModalClose} handleConfirm={handleModalConfirm} title="Confirm ASQ Positive" description="Are you sure you want to set ASQ as Positive?" closeButtonText="Cancel" confirmText="Confirm" errorMessage="An error occurred"/>
    </material_1.Paper>);
};
exports.ASQ = ASQ;
//# sourceMappingURL=ASQ.js.map