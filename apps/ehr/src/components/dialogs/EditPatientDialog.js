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
var CloseOutlined_1 = require("@mui/icons-material/CloseOutlined");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var react_number_format_1 = require("react-number-format");
var utils_1 = require("utils");
var constants_1 = require("../../constants");
var getSelectors_1 = require("../../shared/store/getSelectors");
var state_1 = require("../../telemed/state");
var DateSearch_1 = require("../DateSearch");
var RoundedButton_1 = require("../RoundedButton");
var createPatientResourcePatchData = function (patient, data) {
    var _a, _b, _c, _d, _e;
    var patientData = __assign(__assign({}, patient), { resourceType: 'Patient', id: patient.id, name: [
            {
                use: 'official',
                family: data.lastName,
                given: [data.firstName],
                // suffix: [],
            },
        ], telecom: [], birthDate: data.dateOfBirth.toISODate() });
    if (data.middleName) {
        (_a = patientData.name[0].given) === null || _a === void 0 ? void 0 : _a.push(data.middleName);
    }
    if (data.preferredName) {
        (_b = patientData.name) === null || _b === void 0 ? void 0 : _b.push({
            use: 'nickname',
            given: [data.preferredName],
        });
    }
    // if (data.suffix && data.suffix.length > 0) {
    //   patientData.name![0].suffix?.push(data.suffix);
    // }
    // patient's Phones
    if (data.primaryPhoneNumber) {
        patientData.telecom.push({
            system: 'phone',
            use: 'mobile',
            rank: 1,
            value: data.primaryPhoneNumber,
        });
    }
    if (data.secondaryPhoneNumber) {
        patientData.telecom.push({
            system: 'phone',
            use: 'mobile',
            rank: 2,
            value: data.secondaryPhoneNumber,
        });
    }
    // patient's Emails
    if (data.primaryEmail) {
        patientData.telecom.push({
            system: 'email',
            rank: 1,
            value: data.primaryEmail,
        });
    }
    if (data.secondaryEmail) {
        patientData.telecom.push({
            system: 'email',
            rank: 2,
            value: data.secondaryEmail,
        });
    }
    // patient's Address
    var addressEntry = __assign({}, ((_d = (_c = patient === null || patient === void 0 ? void 0 : patient.address) === null || _c === void 0 ? void 0 : _c[0]) !== null && _d !== void 0 ? _d : {}));
    if (data.addressLineOne) {
        var addressLines = [];
        addressLines.push(data.addressLineOne);
        addressEntry.line = addressLines;
    }
    if (data.addressLineTwo) {
        var addressLines = __spreadArray([], ((_e = addressEntry.line) !== null && _e !== void 0 ? _e : []), true);
        addressLines.push(data.addressLineTwo);
        addressEntry.line = addressLines;
    }
    if (data.city) {
        addressEntry.city = data.city;
    }
    if (data.state) {
        addressEntry.state = data.state;
    }
    if (data.zipCode) {
        addressEntry.postalCode = data.zipCode;
    }
    if (Object.keys(addressEntry).length !== 0) {
        patientData.address = [addressEntry];
    }
    return patientData;
};
var isValidPhoneNumber = function (phoneNumber) {
    return phoneNumber.length === 10;
};
var isValidEmail = function (email) {
    return constants_1.EMAIL_REGEX.test(email);
};
var isValidZipCode = function (zipCode) {
    return constants_1.ZIP_REGEX.test(zipCode);
};
var EditPatientDialog = function (_a) {
    var modalOpen = _a.modalOpen, onClose = _a.onClose;
    var _b = (0, react_hook_form_1.useForm)(), register = _b.register, handleSubmit = _b.handleSubmit, formState = _b.formState, control = _b.control, setFormError = _b.setError, resetField = _b.resetField, setValue = _b.setValue, getValues = _b.getValues;
    var _c = (0, react_1.useState)(false), error = _c[0], setError = _c[1];
    var patient = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['patient']).patient;
    var _d = (0, react_1.useState)(false), isSavingData = _d[0], setSavingData = _d[1];
    var possibleUsStates = Object.keys(utils_1.AllStatesToVirtualLocationsData);
    var statesDropdownOptions = __spreadArray([], possibleUsStates.map(function (usState) { return usState; }), true);
    var phoneNumberErrorMessage = 'Phone number must be 10 digits in the format (xxx) xxx-xxxx';
    var emailErrorMessage = 'Email is not valid';
    var zipCodeErrorMessage = 'ZIP Code must be 5 numbers';
    (0, react_1.useEffect)(function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        setValue('dateOfBirth', (patient === null || patient === void 0 ? void 0 : patient.birthDate) ? luxon_1.DateTime.fromISO(patient === null || patient === void 0 ? void 0 : patient.birthDate) : null);
        var nameEntryOfficial = (_a = patient === null || patient === void 0 ? void 0 : patient.name) === null || _a === void 0 ? void 0 : _a.find(function (nameEntry) { return nameEntry.use === 'official'; });
        var nameEntryNickname = (_b = patient === null || patient === void 0 ? void 0 : patient.name) === null || _b === void 0 ? void 0 : _b.find(function (nameEntry) { return nameEntry.use === 'nickname'; });
        setValue('firstName', (_c = nameEntryOfficial === null || nameEntryOfficial === void 0 ? void 0 : nameEntryOfficial.given) === null || _c === void 0 ? void 0 : _c[0]);
        setValue('middleName', (_d = nameEntryOfficial === null || nameEntryOfficial === void 0 ? void 0 : nameEntryOfficial.given) === null || _d === void 0 ? void 0 : _d[1]);
        setValue('lastName', nameEntryOfficial === null || nameEntryOfficial === void 0 ? void 0 : nameEntryOfficial.family);
        setValue('preferredName', (_e = nameEntryNickname === null || nameEntryNickname === void 0 ? void 0 : nameEntryNickname.given) === null || _e === void 0 ? void 0 : _e[0]);
        // setValue('suffix', nameEntry?.suffix?.[0]);
        var telecomEntry = (patient === null || patient === void 0 ? void 0 : patient.telecom) || [];
        var phoneNumbers = telecomEntry.filter(function (element) { var _a; return ((_a = element === null || element === void 0 ? void 0 : element.system) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'phone'; });
        var masterPrimaryPhone = (_g = (_f = phoneNumbers.find(function (element) { return element.rank === 1; })) === null || _f === void 0 ? void 0 : _f.value) !== null && _g !== void 0 ? _g : (_h = phoneNumbers === null || phoneNumbers === void 0 ? void 0 : phoneNumbers[0]) === null || _h === void 0 ? void 0 : _h.value;
        var masterSecondaryPhone = (_j = phoneNumbers.find(function (element) { return element.rank === 2; })) === null || _j === void 0 ? void 0 : _j.value;
        setValue('primaryPhoneNumber', masterPrimaryPhone);
        setValue('secondaryPhoneNumber', masterSecondaryPhone);
        var emails = telecomEntry.filter(function (element) { var _a; return ((_a = element === null || element === void 0 ? void 0 : element.system) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'email'; });
        var masterPrimaryEmail = (_l = (_k = emails.find(function (element) { return element.rank === 1; })) === null || _k === void 0 ? void 0 : _k.value) !== null && _l !== void 0 ? _l : (_m = emails === null || emails === void 0 ? void 0 : emails[0]) === null || _m === void 0 ? void 0 : _m.value;
        var masterSecondaryEmail = (_o = emails.find(function (element) { return element.rank === 2; })) === null || _o === void 0 ? void 0 : _o.value;
        setValue('primaryEmail', masterPrimaryEmail);
        setValue('secondaryEmail', masterSecondaryEmail);
        var addressEntry = (_p = patient === null || patient === void 0 ? void 0 : patient.address) === null || _p === void 0 ? void 0 : _p[0];
        var masterAddressLineOne = (_q = addressEntry === null || addressEntry === void 0 ? void 0 : addressEntry.line) === null || _q === void 0 ? void 0 : _q[0];
        var masterAddressLineTwo = (_r = addressEntry === null || addressEntry === void 0 ? void 0 : addressEntry.line) === null || _r === void 0 ? void 0 : _r[1];
        setValue('addressLineOne', masterAddressLineOne);
        setValue('addressLineTwo', masterAddressLineTwo);
        var city = addressEntry === null || addressEntry === void 0 ? void 0 : addressEntry.city;
        var state = addressEntry === null || addressEntry === void 0 ? void 0 : addressEntry.state;
        var zipCode = addressEntry === null || addressEntry === void 0 ? void 0 : addressEntry.postalCode;
        setValue('city', city);
        setValue('state', state);
        setValue('zipCode', zipCode);
    }, [patient, setValue]);
    // const suffixOptions = ['II', 'III', 'IV', 'Jr', 'Sr'];
    var editPatient = (0, state_1.useEditPatientInformationMutation)();
    var onSubmit = (0, react_1.useCallback)(function (data) { return __awaiter(void 0, void 0, void 0, function () {
        var patchedPatientData, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, 3, 4]);
                    if (!(patient === null || patient === void 0 ? void 0 : patient.id)) {
                        throw new Error('Patient reference not provided');
                    }
                    setSavingData(true);
                    patchedPatientData = createPatientResourcePatchData(patient, data);
                    // Updates Patient's master record
                    return [4 /*yield*/, editPatient.mutateAsync({ originalPatientData: patient, updatedPatientData: patchedPatientData })];
                case 1:
                    // Updates Patient's master record
                    _a.sent();
                    state_1.useAppointmentStore.setState({
                        patient: __assign({}, patchedPatientData),
                    });
                    onClose();
                    return [3 /*break*/, 4];
                case 2:
                    error_1 = _a.sent();
                    setError(true);
                    console.error('Error while editing patient information: ', error_1);
                    return [3 /*break*/, 4];
                case 3:
                    setSavingData(false);
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [patient, editPatient, onClose]);
    return (<material_1.Dialog open={modalOpen} onClose={onClose} fullWidth disableScrollLock sx={{ '.MuiPaper-root': { padding: 1, width: '512px', height: '800px', maxWidth: 'initial' } }}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <material_1.DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%', py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          Edit Patient Information
          <material_1.IconButton onClick={onClose} aria-label="close" sx={{ mr: -3, mt: -3 }}>
            <CloseOutlined_1.default />
          </material_1.IconButton>
        </material_1.DialogTitle>
        <material_1.DialogContent sx={{ overflow: 'auto' }}>
          <material_1.FormControl fullWidth required sx={{ mt: 1 }}>
            <material_1.TextField {...register('firstName', { required: true })} id="first-name" label="First Name" variant="outlined" fullWidth error={!!formState.errors.firstName} required/>
          </material_1.FormControl>
          <material_1.FormControl fullWidth sx={{ mt: 2 }}>
            <material_1.TextField {...register('middleName')} id="middle-name" label="Middle Name" variant="outlined" fullWidth error={!!formState.errors.middleName}/>
          </material_1.FormControl>
          <material_1.FormControl fullWidth required sx={{ mt: 2 }}>
            <material_1.TextField {...register('lastName', { required: true })} id="last-name" label="Last Name" variant="outlined" fullWidth error={!!formState.errors.lastName} required/>
          </material_1.FormControl>
          <material_1.FormControl fullWidth sx={{ mt: 2 }}>
            <material_1.TextField {...register('preferredName')} id="preferred-name" label="Preferred name" variant="outlined" fullWidth error={!!formState.errors.preferredName}/>
          </material_1.FormControl>
          {/* <FormControl fullWidth sx={{ mt: 2 }}>
          <Controller
            name={'suffix'}
            control={control}
            render={({ field: { value } }) => (
              <>
                <InputLabel>Suffix</InputLabel>
                <Select
                  value={value}
                  label="Suffix"
                  variant="outlined"
                  fullWidth
                  error={!!formState.errors.suffix}
                  defaultValue=""
                  onChange={(event) => {
                    const selectedSuffix = event.target.value;
                    const valueToSet = selectedSuffix && selectedSuffix.length > 0 ? selectedSuffix : '';
                    resetField('suffix');
                    setValue('suffix', valueToSet);
                  }}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {suffixOptions.map((suffix, index) => (
                    <MenuItem key={index} value={suffix}>
                      {suffix}
                    </MenuItem>
                  ))}
                </Select>
              </>
            )}
          />
        </FormControl> */}
          <material_1.FormControl fullWidth required sx={{ mt: 2 }}>
            <react_hook_form_1.Controller name={'dateOfBirth'} control={control} render={function (_a) {
            var value = _a.field.value;
            return (<DateSearch_1.default date={value || null} setDate={function (date) { return setValue('dateOfBirth', date); }} setIsValidDate={function (valid) {
                    if (valid) {
                        var val = getValues('dateOfBirth');
                        resetField('dateOfBirth');
                        setValue('dateOfBirth', val);
                    }
                    else {
                        setFormError('dateOfBirth', { message: 'Date of birth is not valid' });
                    }
                }} defaultValue={null} label="Date of birth" required></DateSearch_1.default>);
        }}/>
          </material_1.FormControl>
          <material_1.FormControl fullWidth sx={{ mt: 2 }} required>
            <react_hook_form_1.Controller name={'primaryPhoneNumber'} control={control} render={function (_a) {
            var value = _a.field.value;
            return (<react_number_format_1.PatternFormat customInput={material_1.TextField} value={value} format="(###) ###-####" mask=" " label="Primary phone" variant="outlined" placeholder="(XXX) XXX-XXXX" required fullWidth error={!!formState.errors.primaryPhoneNumber} helperText={formState.errors.primaryPhoneNumber ? phoneNumberErrorMessage : ''} onValueChange={function (values, sourceInfo) {
                    if (sourceInfo.source === 'event') {
                        var enteredPhoneNumber = values.value;
                        var isNoValueSet = !enteredPhoneNumber || enteredPhoneNumber.length === 0;
                        if (isNoValueSet || isValidPhoneNumber(enteredPhoneNumber)) {
                            resetField('primaryPhoneNumber');
                            setValue('primaryPhoneNumber', enteredPhoneNumber);
                        }
                        else {
                            setFormError('primaryPhoneNumber', { message: phoneNumberErrorMessage });
                        }
                    }
                }}/>);
        }}/>
          </material_1.FormControl>
          <material_1.FormControl fullWidth sx={{ mt: 2 }}>
            <react_hook_form_1.Controller name={'secondaryPhoneNumber'} control={control} render={function (_a) {
            var value = _a.field.value;
            return (<react_number_format_1.PatternFormat customInput={material_1.TextField} value={value} format="(###) ###-####" mask=" " label="Secondary phone" variant="outlined" placeholder="(XXX) XXX-XXXX" fullWidth error={!!formState.errors.secondaryPhoneNumber} helperText={formState.errors.secondaryPhoneNumber ? phoneNumberErrorMessage : ''} onValueChange={function (values, sourceInfo) {
                    if (sourceInfo.source === 'event') {
                        var enteredPhoneNumber = values.value;
                        var isNoValueSet = !enteredPhoneNumber || enteredPhoneNumber.length === 0;
                        if (isNoValueSet || isValidPhoneNumber(enteredPhoneNumber)) {
                            resetField('secondaryPhoneNumber');
                            setValue('secondaryPhoneNumber', enteredPhoneNumber);
                        }
                        else {
                            setFormError('secondaryPhoneNumber', { message: phoneNumberErrorMessage });
                        }
                    }
                }}/>);
        }}/>
          </material_1.FormControl>
          <material_1.FormControl fullWidth sx={{ mt: 2 }} required>
            <react_hook_form_1.Controller name={'primaryEmail'} control={control} render={function (_a) {
            var value = _a.field.value;
            return (<material_1.TextField label="Primary email" value={value} variant="outlined" error={!!formState.errors.primaryEmail} helperText={formState.errors.primaryEmail ? emailErrorMessage : ''} type="email" fullWidth required onChange={function (event) {
                    var enteredEmail = event.target.value;
                    var isValueEntered = enteredEmail && enteredEmail.length !== 0;
                    resetField('primaryEmail');
                    setValue('primaryEmail', enteredEmail);
                    if (isValueEntered && !isValidEmail(enteredEmail)) {
                        setFormError('primaryEmail', { message: emailErrorMessage });
                    }
                }}/>);
        }}/>
          </material_1.FormControl>
          <material_1.FormControl fullWidth sx={{ mt: 2 }}>
            <react_hook_form_1.Controller name={'secondaryEmail'} control={control} render={function (_a) {
            var value = _a.field.value;
            return (<material_1.TextField label="Secondary email" value={value} variant="outlined" error={!!formState.errors.secondaryEmail} helperText={formState.errors.secondaryEmail ? emailErrorMessage : ''} type="email" fullWidth onChange={function (event) {
                    var enteredEmail = event.target.value;
                    var isValueEntered = enteredEmail && enteredEmail.length !== 0;
                    resetField('secondaryEmail');
                    setValue('secondaryEmail', enteredEmail);
                    if (isValueEntered && !isValidEmail(enteredEmail)) {
                        setFormError('secondaryEmail', { message: emailErrorMessage });
                    }
                }}/>);
        }}/>
          </material_1.FormControl>
          <material_1.FormControl fullWidth sx={{ mt: 2 }} required>
            <material_1.TextField {...register('addressLineOne')} id="address-one" label="Address" variant="outlined" fullWidth required error={!!formState.errors.addressLineOne}/>
          </material_1.FormControl>
          <material_1.FormControl fullWidth sx={{ mt: 2 }}>
            <material_1.TextField {...register('addressLineTwo')} id="address-two" label="Address 2" variant="outlined" fullWidth error={!!formState.errors.addressLineTwo}/>
          </material_1.FormControl>
          <material_1.Grid container spacing={2} sx={{ mt: 1 }}>
            <material_1.Grid item xs={12} sm={4} md={4}>
              <material_1.FormControl fullWidth required>
                <material_1.TextField {...register('city')} id="city" label="City" variant="outlined" fullWidth required error={!!formState.errors.city}/>
              </material_1.FormControl>
            </material_1.Grid>
            <material_1.Grid item xs={12} sm={4} md={4}>
              <material_1.FormControl fullWidth required>
                <react_hook_form_1.Controller name={'state'} control={control} render={function (_a) {
            var value = _a.field.value;
            return (<material_1.Autocomplete value={value} onChange={function (event, selectedState) {
                    setValue('state', selectedState ? selectedState : undefined);
                }} getOptionLabel={function (state) { return state || 'Unknown'; }} isOptionEqualToValue={function (option, tempValue) { return option === tempValue; }} options={statesDropdownOptions} renderOption={function (props, option) {
                    return (<li {...props} key={option}>
                            {option}
                          </li>);
                }} fullWidth disableClearable={true} renderInput={function (params) { return <material_1.TextField name="state" {...params} label="State" required/>; }}/>);
        }}/>
              </material_1.FormControl>
            </material_1.Grid>
            <material_1.Grid item xs={12} sm={4} md={4}>
              <material_1.FormControl fullWidth required>
                <react_hook_form_1.Controller name={'zipCode'} control={control} render={function (_a) {
            var value = _a.field.value;
            return (<material_1.TextField sx={{
                    '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                        display: 'none',
                    },
                    '& input[type=number]': {
                        MozAppearance: 'textfield',
                    },
                }} label="ZIP" type="number" value={value} variant="outlined" error={!!formState.errors.zipCode} helperText={formState.errors.zipCode ? zipCodeErrorMessage : ''} fullWidth required onChange={function (event) {
                    var enteredZipCode = event.target.value;
                    resetField('zipCode');
                    setValue('zipCode', enteredZipCode);
                    if (!isValidZipCode(enteredZipCode)) {
                        setFormError('zipCode', { message: zipCodeErrorMessage });
                    }
                }}/>);
        }}/>
              </material_1.FormControl>
            </material_1.Grid>
          </material_1.Grid>
        </material_1.DialogContent>
        <material_1.DialogActions sx={{ justifyContent: 'space-between', marginLeft: 1 }}>
          <RoundedButton_1.RoundedButton sx={{ fontWeight: 500, textTransform: 'none', borderRadius: 6, ml: 1, mb: 1 }} onClick={onClose} color="primary">
            Cancel
          </RoundedButton_1.RoundedButton>
          <lab_1.LoadingButton loading={isSavingData} type="submit" variant="contained" color="primary" size="medium" sx={{ fontWeight: 500, textTransform: 'none', borderRadius: 6, mr: 2, mb: 1, px: 4 }} disabled={!formState.isValid}>
            Save
          </lab_1.LoadingButton>
        </material_1.DialogActions>
        {error && (<material_1.Typography color="error" variant="body2" my={1} mx={2}>
            There was an error editing this patient, please try again.
          </material_1.Typography>)}
      </form>
    </material_1.Dialog>);
};
exports.default = EditPatientDialog;
//# sourceMappingURL=EditPatientDialog.js.map