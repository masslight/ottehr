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
exports.CurrentMedicationsProviderColumn = void 0;
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var x_date_pickers_1 = require("@mui/x-date-pickers");
var AdapterLuxon_1 = require("@mui/x-date-pickers/AdapterLuxon");
var x_date_pickers_pro_1 = require("@mui/x-date-pickers-pro");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var useMedicationHistory_1 = require("src/features/css-module/hooks/useMedicationHistory");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var ProviderSideListSkeleton_1 = require("../ProviderSideListSkeleton");
var CurrentMedicationGroup_1 = require("./CurrentMedicationGroup");
var CurrentMedicationsProviderColumn = function () {
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: { medication: null, dose: null, date: null, type: 'scheduled' },
    });
    var isChartDataLoading = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['isChartDataLoading']).isChartDataLoading;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var control = methods.control, reset = methods.reset, handleSubmit = methods.handleSubmit;
    var refetchHistory = (0, useMedicationHistory_1.useMedicationHistory)().refetchHistory;
    var _a = (0, hooks_1.useChartDataArrayValue)('medications', undefined, {
        _sort: '-_lastUpdated',
        _include: 'MedicationStatement:source',
        status: { type: 'token', value: 'active' },
    }, refetchHistory), isLoading = _a.isLoading, onSubmit = _a.onSubmit, onRemove = _a.onRemove, medications = _a.values;
    var _b = (0, react_1.useState)(''), debouncedSearchTerm = _b[0], setDebouncedSearchTerm = _b[1];
    var _c = (0, state_1.useGetMedicationsSearch)(debouncedSearchTerm), isSearching = _c.isFetching, data = _c.data;
    var medSearchOptions = data || [];
    var medicationsMap = (0, react_1.useMemo)(function () { return ({
        scheduled: medications.filter(function (med) { return med.type === 'scheduled'; }),
        asNeeded: medications.filter(function (med) { return med.type === 'as-needed'; }),
    }); }, [medications]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    var debouncedHandleInputChange = (0, react_1.useCallback)((0, material_1.debounce)(function (data) {
        console.log(data);
        if (data.length > 2) {
            setDebouncedSearchTerm(data);
        }
    }, 800), []);
    var handleFormSubmitted = function (data) { return __awaiter(void 0, void 0, void 0, function () {
        var success;
        var _a, _b, _c, _d, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    if (!data) return [3 /*break*/, 2];
                    return [4 /*yield*/, onSubmit({
                            name: "".concat((_a = data.medication) === null || _a === void 0 ? void 0 : _a.name).concat(((_b = data.medication) === null || _b === void 0 ? void 0 : _b.strength) ? " (".concat((_c = data.medication) === null || _c === void 0 ? void 0 : _c.strength, ")") : ''),
                            id: (_f = (_d = data.medication) === null || _d === void 0 ? void 0 : _d.id) === null || _f === void 0 ? void 0 : _f.toString(),
                            type: data.type,
                            intakeInfo: {
                                date: (_g = data.date) === null || _g === void 0 ? void 0 : _g.toUTC().toString(),
                                dose: (_h = data.dose) !== null && _h !== void 0 ? _h : undefined,
                            },
                            status: 'active',
                        })];
                case 1:
                    success = _j.sent();
                    if (success) {
                        reset({ medication: null, date: null, dose: null, type: 'scheduled' });
                        void refetchHistory();
                    }
                    _j.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); };
    return (<material_1.Box>
      <material_1.Box data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsColumn} sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            mb: (medications.length || isChartDataLoading) && !isReadOnly ? 2 : 0,
        }}>
        {isChartDataLoading ? (<ProviderSideListSkeleton_1.ProviderSideListSkeleton />) : (<>
            {medicationsMap.scheduled.length > 0 ? (<material_1.Box data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsScheduledList}>
                <CurrentMedicationGroup_1.CurrentMedicationGroup label="Scheduled medications" medications={medicationsMap.scheduled} onRemove={onRemove} isLoading={isLoading} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsList('scheduled')}></CurrentMedicationGroup_1.CurrentMedicationGroup>
              </material_1.Box>) : null}
            {medicationsMap.asNeeded.length > 0 ? (<material_1.Box data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededList}>
                <CurrentMedicationGroup_1.CurrentMedicationGroup label="As needed medications" medications={medicationsMap.asNeeded} onRemove={onRemove} isLoading={isLoading} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsList('as-needed')}></CurrentMedicationGroup_1.CurrentMedicationGroup>
              </material_1.Box>) : null}
          </>)}
      </material_1.Box>

      {medications.length === 0 && isReadOnly && !isChartDataLoading && (<material_1.Typography color="secondary.light">Missing. Patient input must be reconciled by provider</material_1.Typography>)}

      {!isReadOnly && (<form onSubmit={function (event) { return handleSubmit(function (data) { return handleFormSubmitted(data); })(event); }}>
          <material_1.Card elevation={0} sx={{
                p: 3,
                backgroundColor: colors_1.otherColors.formCardBg,
                borderRadius: 2,
                display: 'grid',
                gridTemplateColumns: 'repeat(1, 1fr)',
                gap: 2,
            }}>
            <react_hook_form_1.Controller name="type" control={control} rules={{ required: true }} render={function (_a) {
                var _b = _a.field, value = _b.value, onChange = _b.onChange;
                return (<material_1.RadioGroup row value={value} onChange={onChange}>
                  <material_1.FormControlLabel value="scheduled" data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsScheduledRadioButton} control={<material_1.Radio size="small" disabled={isLoading}/>} label={'Scheduled medication'}/>
                  <material_1.FormControlLabel value="as-needed" data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededRadioButton} control={<material_1.Radio size="small" disabled={isLoading}/>} label={'As needed medication'}/>
                </material_1.RadioGroup>);
            }}></react_hook_form_1.Controller>

            <material_1.Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
              <react_hook_form_1.Controller name="medication" control={control} rules={{ required: true }} render={function (_a) {
                var _b = _a.field, value = _b.value, onChange = _b.onChange, error = _a.fieldState.error;
                return (<material_1.Autocomplete value={value} getOptionLabel={function (option) {
                        return typeof option === 'string'
                            ? option
                            : "".concat(option.name, " ").concat(option.strength ? "(".concat(option.strength, ")") : '');
                    }} fullWidth isOptionEqualToValue={function (option, value) { return value.id === option.id; }} loading={isSearching} size="small" disablePortal disabled={isLoading || isChartDataLoading} noOptionsText={debouncedSearchTerm && debouncedSearchTerm.length > 2 && medSearchOptions.length === 0
                        ? 'Nothing found for this search criteria'
                        : 'Start typing to load results'} options={medSearchOptions} onChange={function (_e, data) {
                        onChange(data);
                    }} renderInput={function (params) { return (<material_1.TextField {...params} onChange={function (e) { return debouncedHandleInputChange(e.target.value); }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput} label="Medication" placeholder="Search" required={true} error={!!error} InputLabelProps={{ shrink: true }} sx={{
                            '& .MuiInputLabel-root': {
                                fontWeight: 'bold',
                            },
                        }}/>); }}/>);
            }}/>
              <react_hook_form_1.Controller name="dose" control={control} render={function (_a) {
                var _b = _a.field, value = _b.value, onChange = _b.onChange, error = _a.fieldState.error;
                return (<material_1.TextField value={value || ''} onChange={onChange} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDoseInput} size="small" InputLabelProps={{ shrink: true }} label="Recent dose amount and units" placeholder="Provide amount and units" error={!!error}/>);
            }}></react_hook_form_1.Controller>
              <react_hook_form_1.Controller name="date" control={control} rules={{
                validate: function (val) {
                    var _a;
                    if (val && !val.isValid) {
                        return (_a = val.invalidExplanation) !== null && _a !== void 0 ? _a : 'Provide valid date time';
                    }
                    return true;
                },
            }} render={function (_a) {
                var _b = _a.field, value = _b.value, onChange = _b.onChange, error = _a.fieldState.error;
                return (<material_1.Box sx={{ gridColumn: 'span 2' }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDateTimeInput}>
                    <x_date_pickers_pro_1.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
                      <x_date_pickers_1.DateTimePicker onChange={onChange} value={value || null} label="Last time medication was taken" slotProps={{
                        textField: {
                            sx: { width: '100%' },
                            InputLabelProps: { shrink: true },
                            InputProps: { size: 'small', error: !!error },
                        },
                    }}></x_date_pickers_1.DateTimePicker>
                    </x_date_pickers_pro_1.LocalizationProvider>
                  </material_1.Box>);
            }}></react_hook_form_1.Controller>
            </material_1.Box>
            <material_1.Button variant="outlined" type="submit" disabled={isLoading} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton} sx={{
                borderColor: colors_1.otherColors.consentBorder,
                borderRadius: 100,
                textTransform: 'none',
                fontWeight: 500,
                fontSize: 14,
                maxWidth: '100px',
            }}>
              Add
            </material_1.Button>
          </material_1.Card>
        </form>)}
    </material_1.Box>);
};
exports.CurrentMedicationsProviderColumn = CurrentMedicationsProviderColumn;
//# sourceMappingURL=CurrentMedicationsProviderColumn.js.map