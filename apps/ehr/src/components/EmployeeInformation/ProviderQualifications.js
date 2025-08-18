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
exports.ProviderQualifications = ProviderQualifications;
var colors_1 = require("@ehrTheme/colors");
var Delete_1 = require("@mui/icons-material/Delete");
var material_1 = require("@mui/material");
var material_2 = require("@mui/material");
var x_date_pickers_1 = require("@mui/x-date-pickers");
var AdapterLuxon_1 = require("@mui/x-date-pickers/AdapterLuxon");
var luxon_1 = require("luxon");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../constants/data-test-ids");
var RoundedButton_1 = require("../RoundedButton");
var displayStates = utils_1.AllStates.map(function (state) { return state.value; });
function ProviderQualifications(_a) {
    var _this = this;
    var control = _a.control, errors = _a.errors, handleAddLicense = _a.handleAddLicense, newLicenses = _a.newLicenses, setNewLicenses = _a.setNewLicenses;
    return (<material_1.FormControl sx={{ width: '100%' }}>
      <material_1.FormLabel sx={{ mt: 3, fontWeight: '600 !important' }}>Provider Qualifications</material_1.FormLabel>
      <material_1.Stack mt={1} gap={2}>
        <material_1.TableContainer>
          <material_1.Table data-testid={data_test_ids_1.dataTestIds.employeesPage.qualificationsTable}>
            <material_1.TableHead>
              <material_1.TableRow>
                <material_1.TableCell>State</material_1.TableCell>
                <material_1.TableCell align="left">Qualification</material_1.TableCell>
                <material_1.TableCell align="left">License</material_1.TableCell>
                <material_1.TableCell align="left">Operate in state</material_1.TableCell>
                <material_1.TableCell align="left">Delete License</material_1.TableCell>
              </material_1.TableRow>
            </material_1.TableHead>
            <material_1.TableBody>
              {newLicenses.map(function (license, index) { return (<material_1.TableRow key={index} data-testid={data_test_ids_1.dataTestIds.employeesPage.qualificationRow(license.code)}>
                  <material_1.TableCell>{license.state}</material_1.TableCell>
                  <material_1.TableCell align="left">{license.code}</material_1.TableCell>
                  <material_1.TableCell align="left">
                    {license.number && <material_1.Typography>{license.number}</material_1.Typography>}
                    {license.date && (<material_1.Typography variant="body2" color="secondary.light">
                        till {luxon_1.DateTime.fromISO(license.date).toFormat('MM/dd/yyyy')}
                      </material_1.Typography>)}
                  </material_1.TableCell>
                  <material_1.TableCell align="center">
                    <material_1.Switch checked={license.active} onChange={function () { return __awaiter(_this, void 0, void 0, function () {
                var updatedLicenses;
                return __generator(this, function (_a) {
                    updatedLicenses = __spreadArray([], newLicenses, true);
                    updatedLicenses[index].active = !updatedLicenses[index].active;
                    setNewLicenses(updatedLicenses);
                    return [2 /*return*/];
                });
            }); }}/>
                  </material_1.TableCell>
                  <material_1.TableCell align="center">
                    <material_1.IconButton sx={{
                color: 'error.dark',
                ':hover': {
                    backgroundColor: 'error.light',
                    color: 'error.contrastText',
                },
            }} onClick={function () { return __awaiter(_this, void 0, void 0, function () {
                var updatedLicenses;
                return __generator(this, function (_a) {
                    updatedLicenses = __spreadArray([], newLicenses, true);
                    updatedLicenses.splice(index, 1);
                    setNewLicenses(updatedLicenses);
                    return [2 /*return*/];
                });
            }); }} data-testid={data_test_ids_1.dataTestIds.employeesPage.deleteQualificationButton}>
                      <Delete_1.default />
                    </material_1.IconButton>
                  </material_1.TableCell>
                </material_1.TableRow>); })}
            </material_1.TableBody>
          </material_1.Table>
        </material_1.TableContainer>

        <material_1.Card sx={{ p: 2, backgroundColor: colors_1.otherColors.formCardBg }} elevation={0} component={material_1.Stack} spacing={2} data-testid={data_test_ids_1.dataTestIds.employeesPage.addQualificationCard}>
          <material_1.Typography fontWeight={600} color="primary.dark">
            Add state qualification
          </material_1.Typography>

          <material_1.Stack direction="row" spacing={2}>
            <react_hook_form_1.Controller name="newLicenseState" control={control} render={function (_a) {
            var field = _a.field;
            return (<material_2.Autocomplete {...field} fullWidth size="small" options={displayStates} getOptionLabel={function (option) { return option; }} renderInput={function (params) { return (<material_2.TextField {...params} label="State" data-testid={data_test_ids_1.dataTestIds.employeesPage.newQualificationStateDropdown} error={errors.state} helperText={errors.state ? 'Please select a state' : null}/>); }} onChange={function (_, value) { return field.onChange(value !== null && value !== void 0 ? value : undefined); }} value={field.value || null}/>);
        }}/>

            <react_hook_form_1.Controller name="newLicenseCode" control={control} render={function (_a) {
            var field = _a.field;
            return (<material_2.Autocomplete {...field} fullWidth size="small" options={Object.keys(utils_1.PractitionerQualificationCodesLabels)} getOptionLabel={function (option) { return option; }} renderInput={function (params) { return (<material_2.TextField {...params} label="Qualification" data-testid={data_test_ids_1.dataTestIds.employeesPage.newQualificationTypeDropdown} error={errors.qualification} helperText={errors.qualification ? 'Please select a qualification' : null}/>); }} onChange={function (_, value) { return field.onChange(value !== null && value !== void 0 ? value : undefined); }} value={field.value || null}/>);
        }}/>
          </material_1.Stack>

          <material_1.Stack direction="row" spacing={2}>
            <react_hook_form_1.Controller name="newLicenseNumber" control={control} render={function (_a) {
            var field = _a.field;
            return (<material_2.TextField {...field} fullWidth size="small" label="License number" data-testid={data_test_ids_1.dataTestIds.employeesPage.newQualificationNumberField} error={errors.number} helperText={errors.number ? 'Please enter license number' : null} onChange={function (e) { var _a; return field.onChange((_a = e.target.value) !== null && _a !== void 0 ? _a : undefined); }} value={field.value || ''}/>);
        }}/>

            <react_hook_form_1.Controller name="newLicenseExpirationDate" control={control} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value;
            return (<x_date_pickers_1.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
                  <x_date_pickers_1.DatePicker label="Expiration date" onChange={onChange} slotProps={{
                    textField: {
                        style: { width: '100%' },
                        size: 'small',
                        helperText: errors.date ? 'Please enter expiration date' : null,
                        error: errors.date,
                        inputProps: {
                            'data-testid': data_test_ids_1.dataTestIds.employeesPage.newQualificationExpDatePicker,
                        },
                    },
                }} value={value || null}/>
                </x_date_pickers_1.LocalizationProvider>);
        }}/>

            {/*<Controller*/}
            {/*  name="newLicenseExpirationDate"*/}
            {/*  control={control}*/}
            {/*  render={({ field }) => (*/}
            {/*    <TextField*/}
            {/*      {...field}*/}
            {/*      fullWidth*/}
            {/*      size="small"*/}
            {/*      label="Expiration date"*/}
            {/*      data-testid={dataTestIds.employeesPage.newQualificationTypeDropdown}*/}
            {/*      error={errors.qualification}*/}
            {/*      helperText={errors.qualification ? 'Please select a qualification' : null}*/}
            {/*      onChange={(e) => field.onChange(e.target.value ?? undefined)}*/}
            {/*      value={field.value || null}*/}
            {/*    />*/}
            {/*  )}*/}
            {/*/>*/}
          </material_1.Stack>

          <RoundedButton_1.RoundedButton data-testid={data_test_ids_1.dataTestIds.employeesPage.addQualificationButton} onClick={handleAddLicense}>
            Add
          </RoundedButton_1.RoundedButton>

          {errors.duplicateLicense && (<material_1.Typography color="error" variant="body2" mt={1} mx={1}>{"License already exists."}</material_1.Typography>)}
        </material_1.Card>
      </material_1.Stack>
    </material_1.FormControl>);
}
//# sourceMappingURL=ProviderQualifications.js.map