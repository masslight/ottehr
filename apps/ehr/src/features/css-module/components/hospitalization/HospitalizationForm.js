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
exports.HospitalizationForm = void 0;
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var RoundedButton_1 = require("src/components/RoundedButton");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var telemed_1 = require("../../../../telemed");
var appointment_1 = require("../../../../telemed/features/appointment");
var HospitalizationOptions = [
    {
        display: 'Anaphylaxis',
        code: '39579001',
    },
    {
        display: 'Appendicitis',
        code: '74400008',
    },
    {
        display: 'Exacerbation of asthma',
        code: '281239006',
    },
    {
        display: 'Burn injury',
        code: '48333001',
    },
    {
        display: 'Cellulitis',
        code: '385627004',
    },
    {
        display: 'Human parturition, function',
        code: '386216000',
    },
    {
        display: 'Dehydration',
        code: '34095006',
    },
    {
        display: 'Diabetes type',
        code: '405751000',
    },
    {
        display: 'Disorder of digestive system',
        code: '53619000',
    },
    {
        display: 'Overdose',
        code: '1149222004',
    },
    {
        display: 'Febrile convulsion',
        code: '41497008',
    },
    {
        display: 'Fever',
        code: '386661006',
    },
    {
        display: 'Injury of head',
        code: '82271004',
    },
    {
        display: 'Influenza',
        code: '6142004',
    },
    {
        display: 'Jaundice',
        code: '18165001',
    },
    {
        display: 'Meningitis',
        code: '7180009',
    },
    {
        display: 'Problem behavior',
        code: '277843001',
    },
    {
        display: 'Injury due to motor vehicle accident',
        code: '407153006',
    },
    {
        display: 'Injury of musculoskeletal system',
        code: '105606008',
    },
    {
        display: 'Dysmorphism',
        code: '276720006',
    },
    {
        display: 'Pneumonia',
        code: '233604007',
    },
    {
        display: 'Poisoning',
        code: '75478009',
    },
    {
        display: 'Post-trauma response',
        code: '39093002',
    },
    {
        display: 'Prematurity of infant',
        code: '771299009',
    },
    {
        display: 'Mental disorder',
        code: '74732009',
    },
    {
        display: 'Disorder of respiratory system',
        code: '50043002',
    },
    {
        display: 'Respiratory syncytial virus infection',
        code: '55735004',
    },
    {
        display: 'Seizure',
        code: '91175000',
    },
    {
        display: 'Urinary tract infectious disease',
        code: '68566005',
    },
];
var HospitalizationForm = function () {
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: {
            selectedHospitalization: null,
            otherHospitalizationName: '',
        },
    });
    var isChartDataLoading = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['isChartDataLoading']).isChartDataLoading;
    var isReadOnly = (0, telemed_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var control = methods.control, reset = methods.reset, handleSubmit = methods.handleSubmit;
    var _a = (0, telemed_1.useChartDataArrayValue)('episodeOfCare', reset, {}), isLoading = _a.isLoading, onSubmit = _a.onSubmit, onRemove = _a.onRemove, hospitalization = _a.values;
    var _b = (0, react_1.useState)(false), isOtherOptionSelected = _b[0], setIsOtherOptionSelected = _b[1];
    var handleSelectOption = (0, react_1.useCallback)(function (data) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!data) return [3 /*break*/, 2];
                    return [4 /*yield*/, onSubmit(data)];
                case 1:
                    _a.sent();
                    reset({ selectedHospitalization: null, otherHospitalizationName: '' });
                    setIsOtherOptionSelected(false);
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); }, [onSubmit, reset]);
    var sortedHospitalizationOptions = (0, react_1.useMemo)(function () {
        return __spreadArray(__spreadArray([], HospitalizationOptions.sort(function (a, b) { return a.display.toLowerCase().localeCompare(b.display.toLowerCase()); }), true), [
            {
                display: 'Other',
                code: 'other',
            },
        ], false);
    }, []);
    var onSubmitForm = function (data) {
        if (data.selectedHospitalization) {
            void handleSelectOption(__assign(__assign({}, data.selectedHospitalization), { display: 'Other' + (data.otherHospitalizationName ? " (".concat(data.otherHospitalizationName, ")") : '') }));
        }
    };
    return (<form onSubmit={handleSubmit(onSubmitForm)}>
      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {isReadOnly ? (<telemed_1.ActionsList data={hospitalization} getKey={function (value) { return value.resourceId; }} renderItem={function (value) { return <material_1.Typography>{value.display}</material_1.Typography>; }} divider/>) : (<material_1.Box>
            <material_1.Box sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                mb: hospitalization.length || isChartDataLoading ? 2 : 0,
            }}>
              {isChartDataLoading ? (<appointment_1.ProviderSideListSkeleton />) : (<telemed_1.ActionsList data={hospitalization} getKey={function (value) { return value.resourceId; }} renderItem={function (value) { return <material_1.Typography>{value.display}</material_1.Typography>; }} renderActions={function (value) { return (<telemed_1.DeleteIconButton disabled={isLoading} onClick={function () { return onRemove(value.resourceId); }}/>); }} divider/>)}
            </material_1.Box>
            <material_1.Card elevation={0} sx={{
                p: 3,
                backgroundColor: colors_1.otherColors.formCardBg,
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
            }}>
              <react_hook_form_1.Controller name="selectedHospitalization" control={control} rules={{ required: true }} render={function (_a) {
                var _b = _a.field, value = _b.value, onChange = _b.onChange;
                return (<material_1.Autocomplete value={value || null} onChange={function (_e, data) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    onChange(data);
                                    if (!((data === null || data === void 0 ? void 0 : data.display) === 'Other')) return [3 /*break*/, 1];
                                    setIsOtherOptionSelected(true);
                                    return [3 /*break*/, 3];
                                case 1:
                                    setIsOtherOptionSelected(false);
                                    return [4 /*yield*/, handleSelectOption(data)];
                                case 2:
                                    _a.sent();
                                    _a.label = 3;
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); }} fullWidth size="small" disabled={isLoading || isChartDataLoading} options={sortedHospitalizationOptions} noOptionsText="Nothing found for this search criteria" getOptionLabel={function (option) { return "".concat(option.display); }} renderOption={function (props, option) { return (<li {...props}>
                        <material_1.Typography component="span"> {option.display} </material_1.Typography>
                      </li>); }} isOptionEqualToValue={function (option, value) { return option.code === value.code; }} renderInput={function (params) { return (<material_1.TextField {...params} label="Hospitalization" placeholder="Search" InputLabelProps={{ shrink: true }} sx={{
                            '& .MuiInputLabel-root': {
                                fontWeight: 'bold',
                            },
                        }}/>); }}/>);
            }}/>
              {isOtherOptionSelected && (<material_1.Stack direction="row" spacing={2} alignItems="center">
                  <react_hook_form_1.Controller name="otherHospitalizationName" control={control} render={function (_a) {
                    var _b = _a.field, value = _b.value, onChange = _b.onChange;
                    return (<material_1.TextField value={value} onChange={function (e) { return onChange(e.target.value); }} label="Other hospitalization" placeholder="Please specify" fullWidth size="small"/>);
                }}/>
                  <RoundedButton_1.RoundedButton type="submit">Add</RoundedButton_1.RoundedButton>
                </material_1.Stack>)}
            </material_1.Card>
          </material_1.Box>)}
      </material_1.Box>
    </form>);
};
exports.HospitalizationForm = HospitalizationForm;
//# sourceMappingURL=HospitalizationForm.js.map