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
exports.default = EmployeeInformationForm;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var api_1 = require("../../api/api");
var data_test_ids_1 = require("../../constants/data-test-ids");
var useAppClients_1 = require("../../hooks/useAppClients");
var useEvolveUser_1 = require("../../hooks/useEvolveUser");
var BasicInformation_1 = require("./BasicInformation");
var ProviderDetails_1 = require("./ProviderDetails");
var ProviderQualifications_1 = require("./ProviderQualifications");
var RoleSelection_1 = require("./RoleSelection");
function EmployeeInformationForm(_a) {
    var _this = this;
    var _b, _c, _d;
    var submitLabel = _a.submitLabel, existingUser = _a.existingUser, isActive = _a.isActive, licenses = _a.licenses, getUserAndUpdatePage = _a.getUserAndUpdatePage;
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var evolveUser = (0, useEvolveUser_1.default)();
    var _e = (0, react_1.useState)(false), loading = _e[0], setLoading = _e[1];
    var _f = (0, react_1.useState)({
        submit: false,
        roles: false,
        qualification: false,
        state: false,
        number: false,
        date: false,
        duplicateLicense: false,
    }), errors = _f[0], setErrors = _f[1];
    var _g = (0, react_1.useState)(licenses), newLicenses = _g[0], setNewLicenses = _g[1];
    var _h = (0, react_1.useState)({
        name: '',
        email: '',
        id: '',
        profile: '',
        accessPolicy: { rule: [] },
        authenticationMethod: 'email',
        roles: [],
        phoneNumber: '',
        faxNumber: '',
        addressLine1: '',
        addressLine2: '',
        addressCity: '',
        addressState: '',
        addressZip: '',
        birthDate: '',
        profileResource: undefined,
    }), user = _h[0], setUser = _h[1];
    var photoSrc = '';
    if ((_b = existingUser === null || existingUser === void 0 ? void 0 : existingUser.profileResource) === null || _b === void 0 ? void 0 : _b.photo) {
        var photo = existingUser.profileResource.photo[0];
        if (photo.url) {
            photoSrc = photo.url;
        }
        else if (photo.data) {
            photoSrc = "data:".concat(photo.contentType, ";base64,").concat(photo.data);
        }
    }
    var _j = (0, react_hook_form_1.useForm)(), control = _j.control, handleSubmit = _j.handleSubmit, setValue = _j.setValue, getValues = _j.getValues, setError = _j.setError, formErrors = _j.formState.errors;
    (0, react_hook_form_1.useWatch)({ control: control, name: 'roles' });
    var scrollToFirstError = function () {
        var firstErrorElement = document.querySelector('.Mui-error');
        if (firstErrorElement) {
            firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };
    (0, react_1.useEffect)(function () {
        if (Object.keys(formErrors).length > 0) {
            scrollToFirstError();
        }
    }, [formErrors]);
    console.log(5, formErrors);
    (0, react_1.useEffect)(function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z;
        if (existingUser) {
            setUser(existingUser);
            setValue('roles', ((_a = existingUser.roles) === null || _a === void 0 ? void 0 : _a.map(function (role) { return role.name; })) || []);
            var firstName = '';
            var middleName = '';
            var lastName = '';
            var nameSuffix = '';
            if (((_b = existingUser.profileResource) === null || _b === void 0 ? void 0 : _b.name) && ((_c = existingUser.profileResource) === null || _c === void 0 ? void 0 : _c.name.length) > 0) {
                var name_1 = (_d = existingUser.profileResource) === null || _d === void 0 ? void 0 : _d.name[0];
                firstName = (_f = (_e = name_1.given) === null || _e === void 0 ? void 0 : _e[0]) !== null && _f !== void 0 ? _f : '';
                middleName = ((_g = name_1.given) === null || _g === void 0 ? void 0 : _g.length) && name_1.given.length > 1 ? name_1.given.slice(1).join(' ') : '';
                lastName = (_h = name_1.family) !== null && _h !== void 0 ? _h : '';
                nameSuffix = (_k = (_j = name_1.suffix) === null || _j === void 0 ? void 0 : _j.join(' ')) !== null && _k !== void 0 ? _k : '';
            }
            setValue('firstName', firstName);
            setValue('middleName', middleName);
            setValue('lastName', lastName);
            setValue('nameSuffix', nameSuffix);
            if ((_l = existingUser === null || existingUser === void 0 ? void 0 : existingUser.profileResource) === null || _l === void 0 ? void 0 : _l.telecom) {
                var phone = (_m = existingUser.profileResource.telecom.find(function (tel) { return tel.system === 'phone'; })) === null || _m === void 0 ? void 0 : _m.value;
                if (phone) {
                    setValue('phoneNumber', phone || '');
                }
            }
            if ((_o = existingUser === null || existingUser === void 0 ? void 0 : existingUser.profileResource) === null || _o === void 0 ? void 0 : _o.telecom) {
                var fax = (_p = existingUser.profileResource.telecom.find(function (tel) { return tel.system === 'fax'; })) === null || _p === void 0 ? void 0 : _p.value;
                if (fax) {
                    setValue('faxNumber', fax || '');
                }
            }
            if ((_q = existingUser === null || existingUser === void 0 ? void 0 : existingUser.profileResource) === null || _q === void 0 ? void 0 : _q.birthDate) {
                setValue('birthDate', luxon_1.DateTime.fromISO(existingUser.profileResource.birthDate) || '');
            }
            if ((_r = existingUser === null || existingUser === void 0 ? void 0 : existingUser.profileResource) === null || _r === void 0 ? void 0 : _r.address) {
                var address = existingUser.profileResource.address[0];
                if (address) {
                    setValue('addressLine1', (_t = (_s = address.line) === null || _s === void 0 ? void 0 : _s[0]) !== null && _t !== void 0 ? _t : '');
                    setValue('addressLine2', (_v = (_u = address.line) === null || _u === void 0 ? void 0 : _u[1]) !== null && _v !== void 0 ? _v : '');
                    setValue('addressCity', (_w = address.city) !== null && _w !== void 0 ? _w : '');
                    setValue('addressState', (_x = address.state) !== null && _x !== void 0 ? _x : '');
                    setValue('addressZip', (_y = address.postalCode) !== null && _y !== void 0 ? _y : '');
                }
            }
            if ((_z = existingUser === null || existingUser === void 0 ? void 0 : existingUser.profileResource) === null || _z === void 0 ? void 0 : _z.identifier) {
                var npi = existingUser.profileResource.identifier.find(function (identifier) { return identifier.system === utils_1.FHIR_IDENTIFIER_NPI; });
                if (npi && npi.value) {
                    setValue('npi', npi.value || 'n/a');
                }
            }
        }
    }, [existingUser, setValue]);
    var isProviderRoleSelected = (_d = (_c = getValues('roles')) === null || _c === void 0 ? void 0 : _c.includes(utils_1.RoleType.Provider)) !== null && _d !== void 0 ? _d : false;
    var updateUserRequest = function (data) { return __awaiter(_this, void 0, void 0, function () {
        var isError, successMessage, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('updateUserRequest');
                    if (!oystehrZambda) {
                        throw new Error('Zambda Client not found');
                    }
                    isError = false;
                    if (data.roles.length < 1) {
                        setError('roles', { message: 'Roles are required' });
                        isError = true;
                    }
                    if (data.addressLine2 && !data.addressLine1) {
                        setError('addressLine2', { message: 'Address line 2 cannot be filled without address line 1' });
                        isError = true;
                    }
                    if (isError) {
                        scrollToFirstError();
                        return [2 /*return*/];
                    }
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, 7, 8]);
                    return [4 /*yield*/, (0, api_1.updateUser)(oystehrZambda, {
                            userId: user.id,
                            firstName: data.firstName,
                            middleName: data.middleName,
                            lastName: data.lastName,
                            nameSuffix: data.nameSuffix,
                            selectedRoles: data.roles,
                            licenses: newLicenses,
                            phoneNumber: data.phoneNumber,
                            npi: data.npi,
                            birthDate: data.birthDate ? data.birthDate.toISODate() || '' : undefined,
                            faxNumber: data.faxNumber,
                            addressLine1: data.addressLine1,
                            addressLine2: data.addressLine2,
                            addressCity: data.addressCity,
                            addressState: data.addressState,
                            addressZip: data.addressZip,
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, getUserAndUpdatePage()];
                case 3:
                    _a.sent();
                    successMessage = "User ".concat(data.firstName, " ").concat(data.lastName, " was updated successfully.");
                    if (!((evolveUser === null || evolveUser === void 0 ? void 0 : evolveUser.id) === user.id)) return [3 /*break*/, 5];
                    (0, notistack_1.enqueueSnackbar)("".concat(successMessage, " The page will be refreshed in 3 seconds."), {
                        variant: 'success',
                    });
                    // wait 3 seconds for the snackbar to be seen before reloading
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 3000); })];
                case 4:
                    // wait 3 seconds for the snackbar to be seen before reloading
                    _a.sent();
                    window.location.reload();
                    _a.label = 5;
                case 5:
                    (0, notistack_1.enqueueSnackbar)(successMessage, { variant: 'success' });
                    return [3 /*break*/, 8];
                case 6:
                    error_1 = _a.sent();
                    console.log("Failed to update user: ".concat(error_1));
                    (0, notistack_1.enqueueSnackbar)('An error has occurred while updating user. Please try again.', {
                        variant: 'error',
                    });
                    setErrors(function (prev) { return (__assign(__assign({}, prev), { submit: true })); });
                    return [3 /*break*/, 8];
                case 7:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    var handleAddLicense = function () { return __awaiter(_this, void 0, void 0, function () {
        var formValues, updatedLicenses;
        return __generator(this, function (_a) {
            setErrors(function (prev) { return (__assign(__assign({}, prev), { state: false, qualification: false, number: false, date: false, duplicateLicense: false })); });
            formValues = getValues();
            if (newLicenses.find(function (license) { return license.state === formValues.newLicenseState && license.code === formValues.newLicenseCode; })) {
                setErrors(function (prev) { return (__assign(__assign({}, prev), { duplicateLicense: true })); });
                return [2 /*return*/];
            }
            if (!formValues.newLicenseCode ||
                !formValues.newLicenseState ||
                !formValues.newLicenseNumber ||
                !formValues.newLicenseExpirationDate) {
                setErrors(function (prev) { return (__assign(__assign({}, prev), { qualification: !formValues.newLicenseCode, state: !formValues.newLicenseState, number: !formValues.newLicenseNumber, date: !formValues.newLicenseExpirationDate })); });
                return [2 /*return*/];
            }
            updatedLicenses = __spreadArray([], newLicenses, true);
            updatedLicenses.push({
                state: formValues.newLicenseState,
                code: formValues.newLicenseCode,
                number: formValues.newLicenseNumber,
                date: formValues.newLicenseExpirationDate.toISODate() || undefined,
                active: true,
            });
            setNewLicenses(updatedLicenses);
            setValue('newLicenseState', undefined);
            setValue('newLicenseCode', undefined);
            setValue('newLicenseNumber', undefined);
            setValue('newLicenseExpirationDate', undefined);
            return [2 /*return*/];
        });
    }); };
    return isActive === undefined ? (<material_1.Skeleton height={300} sx={{ marginY: -5 }}/>) : (<material_1.Paper sx={{ padding: 3 }}>
      <form onSubmit={handleSubmit(updateUserRequest)} data-testid={data_test_ids_1.dataTestIds.employeesPage.informationForm}>
        <BasicInformation_1.BasicInformation control={control} existingUser={existingUser} errors={errors} isActive={isActive}/>

        <RoleSelection_1.RoleSelection control={control} errors={errors} isActive={isActive} getValues={getValues} setValue={setValue}/>

        {isProviderRoleSelected && (<>
            <ProviderDetails_1.ProviderDetails control={control} photoSrc={photoSrc} roles={getValues('roles')}/>

            <ProviderQualifications_1.ProviderQualifications newLicenses={newLicenses} setNewLicenses={setNewLicenses} control={control} errors={errors} handleAddLicense={handleAddLicense}/>
          </>)}

        {errors.submit && (<material_1.Typography color="error" variant="body2" mt={1}>
            Failed to update user. Please try again.
          </material_1.Typography>)}

        <material_1.Grid sx={{ marginTop: 4, marginBottom: 2 }}>
          <lab_1.LoadingButton variant="contained" color="primary" data-testid={data_test_ids_1.dataTestIds.employeesPage.submitButton} sx={{
            textTransform: 'none',
            borderRadius: 28,
            fontWeight: 'bold',
            marginRight: 1,
        }} type="submit" loading={loading} disabled={!isActive}>
            {submitLabel}
          </lab_1.LoadingButton>

          <react_router_dom_1.Link to="/employees">
            <material_1.Button variant="text" type="submit" color="primary" sx={{
            textTransform: 'none',
            borderRadius: 28,
            fontWeight: 'bold',
        }}>
              Cancel
            </material_1.Button>
          </react_router_dom_1.Link>
        </material_1.Grid>
      </form>
    </material_1.Paper>);
}
//# sourceMappingURL=index.js.map