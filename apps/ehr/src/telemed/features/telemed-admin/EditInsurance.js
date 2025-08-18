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
exports.default = EditInsurance;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var App_1 = require("../../../App");
var CustomBreadcrumbs_1 = require("../../../components/CustomBreadcrumbs");
var PageContainer_1 = require("../../../layout/PageContainer");
var telemed_admin_queries_1 = require("./telemed-admin.queries");
function EditInsurance() {
    var _this = this;
    var _a, _b, _c, _d;
    var theme = (0, material_1.useTheme)();
    var navigate = (0, react_router_dom_1.useNavigate)();
    var insuranceIdParam = (0, react_router_dom_1.useParams)().insurance;
    var isNew = insuranceIdParam === 'new';
    var insuranceId = isNew ? undefined : insuranceIdParam;
    var _e = (0, react_1.useState)(''), error = _e[0], setError = _e[1];
    var didSetInsuranceDetailsForm = (0, react_1.useRef)(false);
    var _f = (0, react_hook_form_1.useForm)({
        defaultValues: {
            payor: undefined,
            displayName: '',
            // TODO: uncomment when insurance settings will be applied to patient paperwork step with filling insurance data
            // ...INSURANCE_SETTINGS_DEFAULTS,
        },
    }), control = _f.control, getValues = _f.getValues, reset = _f.reset;
    var _g = (0, telemed_admin_queries_1.useInsuranceOrganizationsQuery)(), insuranceOrgsFetching = _g.isFetching, insuranceOrgsData = _g.data;
    var insurancePayorOrgs = (insuranceOrgsData === null || insuranceOrgsData === void 0 ? void 0 : insuranceOrgsData.map(function (org) { return ({ name: org.name, id: org.id }); })) || [
        { id: '', name: '' },
    ];
    var _h = (0, telemed_admin_queries_1.useInsurancesQuery)(insuranceId, insuranceId !== undefined), insuranceData = _h.data, insuranceDataLoading = _h.isFetching, refetchInsuranceData = _h.refetch;
    var insuranceDetails = isNew ? undefined : insuranceData === null || insuranceData === void 0 ? void 0 : insuranceData[0];
    var isActive = (_a = insuranceDetails === null || insuranceDetails === void 0 ? void 0 : insuranceDetails.active) !== null && _a !== void 0 ? _a : true;
    var _j = (0, react_1.useState)(''), payerNameInputValue = _j[0], setPayerNameInputValue = _j[1];
    var settingsMap = Object.fromEntries(Object.entries(utils_1.INSURANCE_SETTINGS_MAP).map(function (_a) {
        var key = _a[0], _ = _a[1];
        return [key, false];
    }));
    (_d = (_c = (_b = insuranceDetails === null || insuranceDetails === void 0 ? void 0 : insuranceDetails.extension) === null || _b === void 0 ? void 0 : _b.find(function (ext) { return ext.url === utils_1.FHIR_EXTENSION.InsurancePlan.insuranceRequirements.url; })) === null || _c === void 0 ? void 0 : _c.extension) === null || _d === void 0 ? void 0 : _d.forEach(function (settingExt) {
        settingsMap[settingExt.url] = settingExt.valueBoolean || false;
    });
    if (insuranceDetails && !didSetInsuranceDetailsForm.current) {
        reset(__assign({ payor: insuranceDetails, displayName: insuranceDetails.name }, settingsMap));
        didSetInsuranceDetailsForm.current = true;
    }
    var _k = (0, telemed_admin_queries_1.useInsuranceMutation)(insuranceDetails), mutateInsurance = _k.mutateAsync, mutationPending = _k.isLoading;
    var onSubmit = function (event) { return __awaiter(_this, void 0, void 0, function () {
        var formData, data, submitSnackbarText, mutateResp, mutateInsuranceId, _a, submitErrorString;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setError('');
                    event.preventDefault();
                    formData = getValues();
                    data = __assign({ id: insuranceId, active: (_b = insuranceDetails === null || insuranceDetails === void 0 ? void 0 : insuranceDetails.active) !== null && _b !== void 0 ? _b : true }, formData);
                    submitSnackbarText = isNew
                        ? "".concat(data.displayName, " was successfully created")
                        : "".concat(data.displayName, " was updated successfully");
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, mutateInsurance(data)];
                case 2:
                    mutateResp = _c.sent();
                    (0, notistack_1.enqueueSnackbar)("".concat(submitSnackbarText), {
                        variant: 'success',
                    });
                    mutateInsuranceId = mutateResp.id ? mutateResp.id : '';
                    navigate(App_1.INSURANCES_URL + "/".concat(mutateInsuranceId));
                    return [3 /*break*/, 4];
                case 3:
                    _a = _c.sent();
                    submitErrorString = 'Error trying to save insurance configuration. Please, try again';
                    setError("".concat(submitErrorString));
                    (0, notistack_1.enqueueSnackbar)("".concat(submitErrorString), {
                        variant: 'error',
                    });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleStatusChange = function (newStatus) { return __awaiter(_this, void 0, void 0, function () {
        var _a, statusErrorString;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, mutateInsurance(__assign(__assign({ id: insuranceId, payor: insuranceDetails, displayName: insuranceDetails.name || '' }, settingsMap), { active: newStatus }))];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, refetchInsuranceData()];
                case 2:
                    _b.sent();
                    (0, notistack_1.enqueueSnackbar)("".concat(insuranceDetails.name || 'Insurance', " status was updated successfully"), {
                        variant: 'success',
                    });
                    return [3 /*break*/, 4];
                case 3:
                    _a = _b.sent();
                    statusErrorString = 'Error trying to change insurance configuration status. Please, try again';
                    setError("".concat(statusErrorString));
                    (0, notistack_1.enqueueSnackbar)("".concat(statusErrorString), {
                        variant: 'error',
                    });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    return (<PageContainer_1.default tabTitle={'Edit State'}>
      <material_1.Grid container direction="row" alignItems="center" justifyContent="center">
        <material_1.Grid item maxWidth={'584px'} width={'100%'}>
          <CustomBreadcrumbs_1.default chain={[
            { link: App_1.INSURANCES_URL, children: 'Insurance' },
            {
                link: '#',
                children: isNew ? ('New insurance') : insuranceDataLoading ? (<material_1.Skeleton width={150}/>) : ((insuranceDetails === null || insuranceDetails === void 0 ? void 0 : insuranceDetails.name) || ''),
            },
        ]}/>
          <material_1.Typography variant="h3" color="primary.dark" marginTop={2} marginBottom={2} sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontWeight: '600 !important' }}>
            {insuranceDataLoading ? <material_1.Skeleton width={250}/> : (insuranceDetails === null || insuranceDetails === void 0 ? void 0 : insuranceDetails.name) || (isNew ? 'New' : '')}
          </material_1.Typography>
          {insuranceId && insuranceDataLoading ? (<material_1.Skeleton height={550} sx={{ marginY: -5 }}/>) : (<material_1.Paper sx={{ padding: 3 }}>
              {/* Breadcrumbs */}

              <form onSubmit={onSubmit}>
                <material_1.FormLabel sx={__assign(__assign({}, theme.typography.h4), { color: theme.palette.primary.dark, mb: 2, fontWeight: '600 !important', display: 'block' })}>
                  Insurance settings
                </material_1.FormLabel>
                <react_hook_form_1.Controller name="payor" control={control} render={function (_a) {
                var _b = _a.field, onChange = _b.onChange, value = _b.value;
                return (<material_1.Autocomplete value={value || null} disabled={insuranceOrgsFetching} getOptionLabel={function (option) { return option.name || ''; }} loading={insuranceOrgsFetching} isOptionEqualToValue={function (option, value) {
                        return option.id === value.id;
                    }} onChange={function (_, newValue) {
                        onChange(newValue);
                    }} inputValue={payerNameInputValue} onInputChange={function (_, newValue) { return setPayerNameInputValue(newValue); }} options={insurancePayorOrgs} renderOption={function (props, option) {
                        return (<li {...props} key={option.id}>
                              {option.name}
                            </li>);
                    }} fullWidth renderInput={function (params) { return (<material_1.TextField placeholder="Select payer name" {...params} label="Payer name" required/>); }}/>);
            }}/>
                <react_hook_form_1.Controller name="displayName" control={control} render={function (_a) {
                var _b = _a.field, onChange = _b.onChange, value = _b.value;
                return (<material_1.TextField id="outlined-read-only-input" label="Display name" value={value || ''} onChange={onChange} sx={{ marginTop: 2, marginBottom: 1, width: '100%' }} margin="dense"/>);
            }}/>

                {/* TODO: uncomment when insurance settings will be applied to patient paperwork step with filling insurance data */}
                {/* <Controller
              name={ENABLE_ELIGIBILITY_CHECK_KEY}
              control={control}
              render={({ field: { onChange, value } }) => (
                <FormControlLabel
                  sx={{ width: '100%' }}
                  value={value}
                  checked={value}
                  control={<Switch checked={value || false} onChange={onChange} />}
                  label={INSURANCE_SETTINGS_MAP[ENABLE_ELIGIBILITY_CHECK_KEY]}
                />
              )}
            ></Controller> */}
                {/* {INSURANCE_SETTINGS_CHECKBOXES.map((settingName) => {
              const name = settingName as keyof typeof INSURANCE_SETTINGS_MAP;
              return (
                <Controller
                  key={name}
                  name={name}
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <FormControlLabel
                      sx={{ width: '100%' }}
                      value={value}
                      disabled={INSURANCE_SETTINGS_DEFAULTS[name] === true}
                      checked={value}
                      control={<Checkbox onChange={onChange}></Checkbox>}
                      label={INSURANCE_SETTINGS_MAP[name]}
                    />
                  )}
                ></Controller>
              );
            })} */}
                {error && (<material_1.Box color="error.main" width="100%" marginTop={2}>
                    {error}
                  </material_1.Box>)}
                <lab_1.LoadingButton variant="contained" color="primary" loading={mutationPending} sx={{
                textTransform: 'none',
                borderRadius: 28,
                marginTop: 3,
                fontWeight: 'bold',
                marginRight: 1,
            }} type="submit" disabled={false}>
                  Save changes
                </lab_1.LoadingButton>
                <react_router_dom_1.Link to={App_1.INSURANCES_URL}>
                  <material_1.Button variant="text" color="primary" sx={{
                textTransform: 'none',
                borderRadius: 28,
                marginTop: 3,
                fontWeight: 'bold',
            }}>
                    Cancel
                  </material_1.Button>
                </react_router_dom_1.Link>
              </form>
            </material_1.Paper>)}
          {insuranceId !== 'new' &&
            (insuranceDataLoading ? (<material_1.Skeleton height={300} sx={{ marginTop: -8 }}/>) : (<material_1.Paper sx={{ padding: 3, marginTop: 3 }}>
                <material_1.Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
                  {isActive ? 'Deactivate insurance' : 'Activate insurance'}
                </material_1.Typography>
                <material_1.Typography variant="body1" marginTop={1}>
                  {isActive
                    ? 'When you deactivate this insurance, patients will not be able to select it.'
                    : 'Activate this license.'}
                </material_1.Typography>

                <lab_1.LoadingButton variant="contained" color={isActive ? 'error' : 'primary'} sx={{
                    textTransform: 'none',
                    borderRadius: 28,
                    marginTop: 4,
                    fontWeight: 'bold',
                    marginRight: 1,
                }} loading={mutationPending} onClick={function () { return handleStatusChange(!isActive); }}>
                  {isActive ? 'Deactivate' : 'Activate'}
                </lab_1.LoadingButton>
              </material_1.Paper>))}
        </material_1.Grid>
      </material_1.Grid>
    </PageContainer_1.default>);
}
//# sourceMappingURL=EditInsurance.js.map