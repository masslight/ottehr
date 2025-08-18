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
exports.default = AddPatient;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_number_format_1 = require("react-number-format");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var api_1 = require("../api/api");
var CustomBreadcrumbs_1 = require("../components/CustomBreadcrumbs");
var DateSearch_1 = require("../components/DateSearch");
var CustomDialog_1 = require("../components/dialogs/CustomDialog");
var LocationSelect_1 = require("../components/LocationSelect");
var SlotPicker_1 = require("../components/SlotPicker");
var constants_1 = require("../constants");
var data_test_ids_1 = require("../constants/data-test-ids");
var useAppClients_1 = require("../hooks/useAppClients");
var PageContainer_1 = require("../layout/PageContainer");
var types_1 = require("../types/types");
var mapSelectedPatientEmailUser = function (selectedPatientEmailUser) {
    if (!selectedPatientEmailUser) {
        return undefined;
    }
    var EmailUserMapper = {
        'Patient (Self)': 'Patient (Self)',
        Patient: 'Patient (Self)',
        'Parent/Guardian': 'Parent/Guardian',
    };
    if (Object.keys(EmailUserMapper).includes(selectedPatientEmailUser)) {
        var key = selectedPatientEmailUser;
        return EmailUserMapper[key];
    }
    return undefined;
};
function AddPatient() {
    var _this = this;
    var _a, _b, _c, _d;
    var storedLocation = localStorage === null || localStorage === void 0 ? void 0 : localStorage.getItem('selectedLocation');
    var _e = (0, react_1.useState)(storedLocation ? JSON.parse(storedLocation) : undefined), selectedLocation = _e[0], setSelectedLocation = _e[1];
    var _f = (0, react_1.useState)(''), firstName = _f[0], setFirstName = _f[1];
    var _g = (0, react_1.useState)(''), lastName = _g[0], setLastName = _g[1];
    var _h = (0, react_1.useState)(null), birthDate = _h[0], setBirthDate = _h[1];
    var _j = (0, react_1.useState)(''), sex = _j[0], setSex = _j[1];
    var _k = (0, react_1.useState)(''), mobilePhone = _k[0], setMobilePhone = _k[1];
    var _l = (0, react_1.useState)(''), reasonForVisit = _l[0], setReasonForVisit = _l[1];
    var _m = (0, react_1.useState)(''), reasonForVisitAdditional = _m[0], setReasonForVisitAdditional = _m[1];
    var _o = (0, react_1.useState)(), visitType = _o[0], setVisitType = _o[1];
    var _p = (0, react_1.useState)(), slot = _p[0], setSlot = _p[1];
    var _q = (0, react_1.useState)(false), loading = _q[0], setLoading = _q[1];
    var _r = (0, react_1.useState)(false), searching = _r[0], setSearching = _r[1];
    var _s = (0, react_1.useState)({
        submit: false,
        phone: false,
        search: false,
    }), errors = _s[0], setErrors = _s[1];
    var _t = (0, react_1.useState)({ status: 'initial', input: undefined }), loadingSlotState = _t[0], setLoadingSlotState = _t[1];
    var _u = (0, react_1.useState)(undefined), locationWithSlotData = _u[0], setLocationWithSlotData = _u[1];
    var _v = (0, react_1.useState)(true), validDate = _v[0], setValidDate = _v[1];
    var _w = (0, react_1.useState)(false), selectSlotDialogOpen = _w[0], setSelectSlotDialogOpen = _w[1];
    var _x = (0, react_1.useState)(true), validReasonForVisit = _x[0], setValidReasonForVisit = _x[1];
    var _y = (0, react_1.useState)(false), openSearchResults = _y[0], setOpenSearchResults = _y[1];
    var _z = (0, react_1.useState)(undefined), patients = _z[0], setPatients = _z[1];
    var _0 = (0, react_1.useState)(undefined), selectedPatient = _0[0], setSelectedPatient = _0[1];
    var _1 = (0, react_1.useState)({
        prefillForSelected: false,
        forcePatientSearch: true,
    }), showFields = _1[0], setShowFields = _1[1];
    // console.log('slot', slot);
    // general variables
    var theme = (0, material_1.useTheme)();
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _2 = (0, useAppClients_1.useApiClients)(), oystehr = _2.oystehr, oystehrZambda = _2.oystehrZambda;
    var reasonForVisitErrorMessage = "Input cannot be more than ".concat(constants_1.MAXIMUM_CHARACTER_LIMIT, " characters");
    var phoneNumberErrorMessage = 'Phone number must be 10 digits in the format (xxx) xxx-xxxx';
    var handleAdditionalReasonForVisitChange = function (newValue) {
        setValidReasonForVisit(newValue.length <= constants_1.MAXIMUM_CHARACTER_LIMIT);
        setReasonForVisitAdditional(newValue);
    };
    (0, react_1.useEffect)(function () {
        var _a, _b;
        var fetchLocationWithSlotData = function (params, client) { return __awaiter(_this, void 0, void 0, function () {
            var locationResponse, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setLoadingSlotState({ status: 'loading', input: undefined });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, (0, api_1.getLocations)(client, params)];
                    case 2:
                        locationResponse = _a.sent();
                        setLocationWithSlotData(locationResponse);
                        return [3 /*break*/, 5];
                    case 3:
                        e_1 = _a.sent();
                        console.error('error loading location with slot data', e_1);
                        return [3 /*break*/, 5];
                    case 4:
                        setLoadingSlotState({ status: 'loaded', input: "".concat(params.slug) });
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        var locationSlug = (_b = (_a = selectedLocation === null || selectedLocation === void 0 ? void 0 : selectedLocation.identifier) === null || _a === void 0 ? void 0 : _a.find(function (identifierTemp) { return identifierTemp.system === utils_1.SLUG_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.value;
        if (!locationSlug) {
            // console.log('show some toast: location is missing slug', selectedLocation, locationSlug);
            return;
        }
        if (!oystehrZambda ||
            loadingSlotState.status === 'loading' ||
            (loadingSlotState.status === 'loaded' && loadingSlotState.input === locationSlug)) {
            return;
        }
        void fetchLocationWithSlotData({ slug: locationSlug, scheduleType: utils_1.ScheduleType.location }, oystehrZambda);
    }, [selectedLocation, loadingSlotState, oystehrZambda]);
    // handle functions
    var handleFormSubmit = function (event) { return __awaiter(_this, void 0, void 0, function () {
        var selectedPatientEmail, selectedPatientEmailUser, guardianContact, emailToUse, emailUser, createSlotInput, timezone, scheduleId, persistedSlot, zambdaParams, response, apiErr, error_1;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
        return __generator(this, function (_x) {
            switch (_x.label) {
                case 0:
                    event.preventDefault();
                    if (mobilePhone.length !== 10) {
                        setErrors({ phone: true });
                        return [2 /*return*/];
                    }
                    else {
                        setErrors({});
                    }
                    if ((visitType === types_1.VisitType.PreBook || visitType === types_1.VisitType.PostTelemed) && slot === undefined) {
                        setSelectSlotDialogOpen(true);
                        return [2 /*return*/];
                    }
                    if (showFields.forcePatientSearch) {
                        setErrors({ search: true });
                        return [2 /*return*/];
                    }
                    else {
                        setErrors(__assign(__assign({}, errors), { search: false }));
                    }
                    if (!(validDate && validReasonForVisit)) return [3 /*break*/, 6];
                    setLoading(true);
                    selectedPatientEmail = void 0, selectedPatientEmailUser = void 0;
                    if (selectedPatient) {
                        selectedPatientEmailUser = mapSelectedPatientEmailUser((_b = (_a = selectedPatient.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/form-user"); })) === null || _b === void 0 ? void 0 : _b.valueString);
                        if (selectedPatientEmailUser) {
                            if (selectedPatientEmailUser !== 'Parent/Guardian') {
                                selectedPatientEmail = (_d = (_c = selectedPatient.telecom) === null || _c === void 0 ? void 0 : _c.find(function (telecom) { return telecom.system === 'email'; })) === null || _d === void 0 ? void 0 : _d.value;
                            }
                            else if (selectedPatientEmailUser === 'Parent/Guardian') {
                                guardianContact = (_e = selectedPatient.contact) === null || _e === void 0 ? void 0 : _e.find(function (contact) { var _a; return (_a = contact.relationship) === null || _a === void 0 ? void 0 : _a.find(function (relationship) { var _a; return ((_a = relationship === null || relationship === void 0 ? void 0 : relationship.coding) === null || _a === void 0 ? void 0 : _a[0].code) === 'Parent/Guardian'; }); });
                                selectedPatientEmail = (_g = (_f = guardianContact === null || guardianContact === void 0 ? void 0 : guardianContact.telecom) === null || _f === void 0 ? void 0 : _f.find(function (telecom) { return telecom.system === 'email'; })) === null || _g === void 0 ? void 0 : _g.value;
                            }
                        }
                    }
                    emailToUse = selectedPatientEmail;
                    emailUser = selectedPatientEmailUser;
                    if (emailUser == undefined && emailToUse) {
                        emailUser = 'Parent/Guardian';
                    }
                    console.log('slot', slot);
                    if (!oystehrZambda)
                        throw new Error('Zambda client not found');
                    createSlotInput = void 0;
                    if (visitType === types_1.VisitType.WalkIn) {
                        if (!selectedLocation) {
                            (0, notistack_1.enqueueSnackbar)('Please select a location', { variant: 'error' });
                            setLoading(false);
                            return [2 /*return*/];
                        }
                        timezone = (0, utils_1.getTimezone)((_h = selectedLocation === null || selectedLocation === void 0 ? void 0 : selectedLocation.walkinSchedule) !== null && _h !== void 0 ? _h : selectedLocation);
                        createSlotInput = {
                            scheduleId: (_k = (_j = selectedLocation === null || selectedLocation === void 0 ? void 0 : selectedLocation.walkinSchedule) === null || _j === void 0 ? void 0 : _j.id) !== null && _k !== void 0 ? _k : '',
                            startISO: (_l = luxon_1.DateTime.now().setZone(timezone).toISO()) !== null && _l !== void 0 ? _l : '',
                            lengthInMinutes: 15,
                            serviceModality: utils_1.ServiceMode['in-person'],
                            walkin: true,
                        };
                    }
                    else {
                        if (!slot) {
                            (0, notistack_1.enqueueSnackbar)('Please select a time slot', { variant: 'error' });
                            setLoading(false);
                            return [2 /*return*/];
                        }
                        scheduleId = (_q = (_p = (_o = (_m = slot === null || slot === void 0 ? void 0 : slot.schedule) === null || _m === void 0 ? void 0 : _m.reference) === null || _o === void 0 ? void 0 : _o.split('/')) === null || _p === void 0 ? void 0 : _p[1]) !== null && _q !== void 0 ? _q : '';
                        createSlotInput = {
                            scheduleId: scheduleId,
                            startISO: (_r = slot === null || slot === void 0 ? void 0 : slot.start) !== null && _r !== void 0 ? _r : '',
                            lengthInMinutes: (0, utils_1.getAppointmentDurationFromSlot)(slot),
                            serviceModality: utils_1.ServiceMode['in-person'],
                            walkin: false,
                            postTelemedLabOnly: visitType === types_1.VisitType.PostTelemed,
                        };
                    }
                    console.log('slot input: ', createSlotInput);
                    return [4 /*yield*/, (0, api_1.createSlot)(createSlotInput, oystehrZambda)];
                case 1:
                    persistedSlot = _x.sent();
                    zambdaParams = {
                        patient: {
                            id: selectedPatient === null || selectedPatient === void 0 ? void 0 : selectedPatient.id,
                            newPatient: !selectedPatient,
                            firstName: (_u = (((_t = (_s = selectedPatient === null || selectedPatient === void 0 ? void 0 : selectedPatient.name) === null || _s === void 0 ? void 0 : _s[0].given) === null || _t === void 0 ? void 0 : _t.join(' ')) || firstName)) === null || _u === void 0 ? void 0 : _u.trim(),
                            lastName: (_w = (((_v = selectedPatient === null || selectedPatient === void 0 ? void 0 : selectedPatient.name) === null || _v === void 0 ? void 0 : _v[0].family) || lastName)) === null || _w === void 0 ? void 0 : _w.trim(),
                            dateOfBirth: (selectedPatient === null || selectedPatient === void 0 ? void 0 : selectedPatient.birthDate) || (birthDate === null || birthDate === void 0 ? void 0 : birthDate.toISODate()) || undefined,
                            sex: (selectedPatient === null || selectedPatient === void 0 ? void 0 : selectedPatient.gender) || sex || undefined,
                            phoneNumber: mobilePhone,
                            email: emailToUse,
                            reasonForVisit: reasonForVisit,
                            reasonAdditional: reasonForVisitAdditional !== '' ? reasonForVisitAdditional : undefined,
                        },
                        slotId: persistedSlot.id,
                    };
                    response = void 0;
                    apiErr = false;
                    _x.label = 2;
                case 2:
                    _x.trys.push([2, 4, 5, 6]);
                    return [4 /*yield*/, (0, api_1.createAppointment)(oystehrZambda, zambdaParams)];
                case 3:
                    response = _x.sent();
                    return [3 /*break*/, 6];
                case 4:
                    error_1 = _x.sent();
                    console.error("Failed to add patient: ".concat(error_1));
                    apiErr = true;
                    return [3 /*break*/, 6];
                case 5:
                    setLoading(false);
                    if (response && !apiErr) {
                        navigate('/visits');
                    }
                    else {
                        setErrors({ submit: true });
                    }
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    // console.log(slot);
    var handlePatientSearch = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var resources, patients;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    if (mobilePhone.length !== 10) {
                        setErrors(__assign(__assign({}, errors), { phone: true }));
                        return [2 /*return*/];
                    }
                    setSearching(true);
                    setErrors(__assign(__assign({}, errors), { search: false }));
                    setShowFields(__assign(__assign({}, showFields), { forcePatientSearch: false }));
                    if (!oystehr) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Person',
                            params: [
                                {
                                    name: 'telecom',
                                    value: "+1".concat(mobilePhone),
                                },
                                {
                                    name: '_include',
                                    value: 'Person:relatedperson',
                                },
                                {
                                    name: '_include:iterate',
                                    value: 'RelatedPerson:patient',
                                },
                            ],
                        })];
                case 1:
                    resources = (_a.sent()).unbundle();
                    patients = resources.filter(function (resourceTemp) { return resourceTemp.resourceType === 'Patient'; });
                    patients.sort(sortPatientsByName);
                    setPatients(patients);
                    setOpenSearchResults(true);
                    setSearching(false);
                    return [2 /*return*/];
            }
        });
    }); };
    var sortPatientsByName = function (a, b) {
        var _a, _b, _c, _d, _e, _f;
        var lastNameA = (_a = a === null || a === void 0 ? void 0 : a.name) === null || _a === void 0 ? void 0 : _a[0].family;
        var lastNameB = (_b = b === null || b === void 0 ? void 0 : b.name) === null || _b === void 0 ? void 0 : _b[0].family;
        var firstNameA = (_d = (_c = a === null || a === void 0 ? void 0 : a.name) === null || _c === void 0 ? void 0 : _c[0].given) === null || _d === void 0 ? void 0 : _d.join(' ');
        var firstNameB = (_f = (_e = b === null || b === void 0 ? void 0 : b.name) === null || _e === void 0 ? void 0 : _e[0].given) === null || _f === void 0 ? void 0 : _f.join(' ');
        if (lastNameA && lastNameB && firstNameA && firstNameB) {
            // sort by last name
            if (lastNameA < lastNameB) {
                return -1;
            }
            else if (lastNameA > lastNameB) {
                return 1;
            }
            else {
                // if same last name, sort by first name
                return firstNameA.localeCompare(firstNameB);
            }
        }
        else {
            return 0;
        }
    };
    var handleSelectPatient = function (event) {
        var selected = patients === null || patients === void 0 ? void 0 : patients.find(function (patient) { return patient.id === event.target.value; });
        setSelectedPatient(selected);
    };
    return (<PageContainer_1.default>
      <material_1.Grid container direction="row">
        <material_1.Grid item xs={3.5}/>
        <material_1.Grid item xs={5}>
          <CustomBreadcrumbs_1.default chain={[
            { link: '/visits', children: 'In Person' },
            { link: '#', children: 'Add Patient' },
        ]}/>

          {/* page title */}

          <material_1.Typography variant="h3" marginTop={1} color={'primary.dark'}>
            Add Patient
          </material_1.Typography>

          {/* form content */}
          <material_1.Paper>
            <form onSubmit={function (e) { return handleFormSubmit(e); }}>
              <material_1.Box padding={3} marginTop={2}>
                {/* Location Select */}
                <material_1.Typography variant="h4" color="primary.dark" data-testid={data_test_ids_1.dataTestIds.addPatientPage.locationHeader}>
                  Location
                </material_1.Typography>

                {/* location search */}
                <material_1.Box sx={{ marginTop: 2 }}>
                  <LocationSelect_1.default location={selectedLocation} setLocation={setSelectedLocation} updateURL={false} required renderInputProps={{ disabled: false }}/>
                </material_1.Box>

                {/* Patient information */}
                <material_1.Box>
                  <material_1.Typography variant="h4" color="primary.dark" sx={{ marginTop: 4 }}>
                    Patient information
                  </material_1.Typography>
                  <material_1.Box marginTop={2}>
                    <material_1.Grid container>
                      <material_1.Grid item xs={8}>
                        <react_number_format_1.PatternFormat data-testid={data_test_ids_1.dataTestIds.addPatientPage.mobilePhoneInput} customInput={material_1.TextField} value={mobilePhone} format="(###) ###-####" mask=" " label="Mobile Phone" variant="outlined" placeholder="(XXX) XXX-XXXX" fullWidth required error={errors.phone} helperText={(errors === null || errors === void 0 ? void 0 : errors.phone) ? phoneNumberErrorMessage : ''} onValueChange={function (values, sourceInfo) {
            if (sourceInfo.source === 'event') {
                setMobilePhone(values.value);
                if (errors.phone && values.value.length === 10) {
                    setErrors(__assign(__assign({}, errors), { phone: false }));
                }
            }
        }}/>
                      </material_1.Grid>
                      <material_1.Grid item xs={4} sx={{ display: 'flex', justifyContent: 'center', flexDirection: 'column', padding: '0 8px' }}>
                        <lab_1.LoadingButton data-testid={data_test_ids_1.dataTestIds.addPatientPage.searchForPatientsButton} variant="contained" onClick={function (event) { return handlePatientSearch(event); }} loading={searching} sx={{
            borderRadius: 100,
            textTransform: 'none',
            fontWeight: 600,
        }}>
                          Search for Patients
                        </lab_1.LoadingButton>
                      </material_1.Grid>
                    </material_1.Grid>
                  </material_1.Box>
                  <material_1.Dialog open={openSearchResults} onClose={function () {
            setSelectedPatient(undefined);
            setOpenSearchResults(false);
        }}>
                    <material_1.Box sx={{ minWidth: '600px', borderRadius: '4px', p: '35px', maxHeight: '450px', overflow: 'scroll' }}>
                      <material_1.Box>
                        <material_1.Typography variant="h4" sx={{ fontWeight: '600 !important', color: theme.palette.primary.main, marginBottom: '4px' }}>
                          Select an Existing Patient
                        </material_1.Typography>
                      </material_1.Box>
                      <material_1.Box>
                        <material_1.RadioGroup onChange={function (e) { return handleSelectPatient(e); }}>
                          {patients === null || patients === void 0 ? void 0 : patients.map(function (patient) {
            var label = "".concat((0, utils_1.getFullName)(patient), " (DOB: ").concat(luxon_1.DateTime.fromISO((patient === null || patient === void 0 ? void 0 : patient.birthDate) || '').toFormat('MMMM dd, yyyy'), ")");
            return (<material_1.FormControlLabel key={patient.id} value={patient.id} control={<material_1.Radio />} label={label}/>);
        })}
                        </material_1.RadioGroup>
                      </material_1.Box>
                      {selectedPatient && (<material_1.Box sx={{ marginTop: 2 }}>
                          <material_1.Button data-testid={data_test_ids_1.dataTestIds.addPatientPage.prefillForButton} variant="outlined" sx={{
                borderRadius: 100,
                textTransform: 'none',
                fontWeight: 600,
            }} onClick={function () {
                setShowFields(__assign(__assign({}, showFields), { prefillForSelected: true }));
                setOpenSearchResults(false);
            }}>
                            Prefill for {(0, utils_1.getFullName)(selectedPatient)}
                          </material_1.Button>
                        </material_1.Box>)}
                      <material_1.Box sx={{ marginTop: 2 }}>
                        <material_1.Button data-testid={data_test_ids_1.dataTestIds.addPatientPage.patientNotFoundButton} variant="contained" sx={{
            borderRadius: 100,
            textTransform: 'none',
            fontWeight: 600,
        }} onClick={function () {
            setSelectedPatient(undefined);
            setShowFields(__assign(__assign({}, showFields), { prefillForSelected: false }));
            setOpenSearchResults(false);
        }}>
                          Patient Not Found - Add Manually
                        </material_1.Button>
                      </material_1.Box>
                    </material_1.Box>
                  </material_1.Dialog>
                  {searching && (<material_1.Box sx={{ display: 'flex', justifyContent: 'center' }} marginTop={2}>
                      <material_1.CircularProgress />
                    </material_1.Box>)}
                  {showFields.prefillForSelected && selectedPatient && (<material_1.Box marginTop={3}>
                      <material_1.Typography variant="h4" color="primary.dark" data-testid={data_test_ids_1.dataTestIds.addPatientPage.prefilledPatientName}>
                        {(0, utils_1.getFullName)(selectedPatient)}
                      </material_1.Typography>
                      <material_1.Typography data-testid={data_test_ids_1.dataTestIds.addPatientPage.prefilledPatientBirthday}>
                        Birthday: {luxon_1.DateTime.fromISO((selectedPatient === null || selectedPatient === void 0 ? void 0 : selectedPatient.birthDate) || '').toFormat('MMMM dd, yyyy')}
                      </material_1.Typography>
                      <material_1.Typography data-testid={data_test_ids_1.dataTestIds.addPatientPage.prefilledPatientBirthSex}>
                        Birth Sex: {selectedPatient.gender}
                      </material_1.Typography>
                      <material_1.Typography data-testid={data_test_ids_1.dataTestIds.addPatientPage.prefilledPatientEmail}>
                        Email: {(_a = (0, utils_1.getContactEmailForPatientAccount)(selectedPatient)) !== null && _a !== void 0 ? _a : 'not found'}
                      </material_1.Typography>
                    </material_1.Box>)}
                  {!showFields.forcePatientSearch && !showFields.prefillForSelected && !searching && (<material_1.Box marginTop={2}>
                      <material_1.Box>
                        <material_1.Grid container direction="row" justifyContent="space-between">
                          <material_1.Grid item xs={5.85}>
                            <material_1.TextField data-testid={data_test_ids_1.dataTestIds.addPatientPage.firstNameInput} label="First Name" variant="outlined" required fullWidth value={firstName.trimStart()} onChange={function (event) {
                setFirstName(event.target.value);
            }}></material_1.TextField>
                          </material_1.Grid>
                          <material_1.Grid item xs={5.85}>
                            <material_1.TextField data-testid={data_test_ids_1.dataTestIds.addPatientPage.lastNameInput} label="Last Name" variant="outlined" required fullWidth value={lastName.trimStart()} onChange={function (event) {
                setLastName(event.target.value);
            }}></material_1.TextField>
                          </material_1.Grid>
                        </material_1.Grid>
                      </material_1.Box>

                      <material_1.Box marginTop={2}>
                        <material_1.Grid container direction="row" justifyContent="space-between">
                          <material_1.Grid item xs={5.85}>
                            <DateSearch_1.default date={birthDate} setDate={setBirthDate} defaultValue={null} label="Date of birth" required setIsValidDate={setValidDate}></DateSearch_1.default>
                          </material_1.Grid>
                          <material_1.Grid item xs={5.85}>
                            <material_1.FormControl fullWidth>
                              <material_1.InputLabel id="sex-at-birth-label">Sex at birth *</material_1.InputLabel>
                              <material_1.Select data-testid={data_test_ids_1.dataTestIds.addPatientPage.sexAtBirthDropdown} labelId="sex-at-birth-label" id="sex-at-birth-select" value={sex} label="Sex at birth *" required onChange={function (event) {
                setSex(event.target.value);
            }}>
                                <material_1.MenuItem value={types_1.PersonSex.Male}>Male</material_1.MenuItem>
                                <material_1.MenuItem value={types_1.PersonSex.Female}>Female</material_1.MenuItem>
                                <material_1.MenuItem value={types_1.PersonSex.Intersex}>Intersex</material_1.MenuItem>
                              </material_1.Select>
                            </material_1.FormControl>
                          </material_1.Grid>
                        </material_1.Grid>
                      </material_1.Box>
                    </material_1.Box>)}
                </material_1.Box>

                {/* Visit Information */}
                {!showFields.forcePatientSearch && !searching && (<material_1.Box marginTop={4}>
                    <material_1.Typography variant="h4" color="primary.dark">
                      Visit information
                    </material_1.Typography>
                    <material_1.Box marginTop={2}>
                      <material_1.FormControl fullWidth>
                        <material_1.InputLabel id="reason-for-visit-label">Reason for visit *</material_1.InputLabel>
                        <material_1.Select data-testid={data_test_ids_1.dataTestIds.addPatientPage.reasonForVisitDropdown} labelId="reason-for-visit-label" id="reason-for-visit-select" value={reasonForVisit || ''} label="Reason for visit *" required onChange={function (event) { return setReasonForVisit(event.target.value); }}>
                          {constants_1.REASON_FOR_VISIT_OPTIONS.map(function (reason) { return (<material_1.MenuItem key={reason} value={reason}>
                              {reason}
                            </material_1.MenuItem>); })}
                        </material_1.Select>
                      </material_1.FormControl>
                    </material_1.Box>
                    <material_1.Box marginTop={2}>
                      <material_1.FormControl fullWidth>
                        <material_1.TextField label="Tell us more (optional)" id="reason-additional-text" value={reasonForVisitAdditional} aria-describedby="reason-additional-helper-text" onChange={function (e) { return handleAdditionalReasonForVisitChange(e.target.value.trimStart()); }} maxRows={2} multiline={true} error={!validReasonForVisit}/>
                        {reasonForVisitAdditional.length > 100 && (<material_1.Typography variant="caption" color={validReasonForVisit ? 'text.secondary' : 'error'} sx={{ marginTop: 1 }}>
                            {"".concat(reasonForVisitAdditional.length, " / ").concat(constants_1.MAXIMUM_CHARACTER_LIMIT).concat(!validReasonForVisit ? " - ".concat(reasonForVisitErrorMessage) : '')}
                          </material_1.Typography>)}
                      </material_1.FormControl>
                    </material_1.Box>
                    <material_1.Box marginTop={2}>
                      <material_1.FormControl fullWidth>
                        <material_1.InputLabel id="visit-type-label">Visit type *</material_1.InputLabel>
                        <material_1.Select data-testid={data_test_ids_1.dataTestIds.addPatientPage.visitTypeDropdown} labelId="visit-type-label" id="visit-type-select" value={visitType || ''} label="Visit type *" required onChange={function (event) {
                setSlot(undefined);
                setVisitType(event.target.value);
            }}>
                          <material_1.MenuItem value={types_1.VisitType.WalkIn}>Walk-in In Person Visit</material_1.MenuItem>
                          <material_1.MenuItem value={types_1.VisitType.PreBook}>Pre-booked In Person Visit</material_1.MenuItem>
                          <material_1.MenuItem value={types_1.VisitType.PostTelemed}>Post Telemed Lab Only</material_1.MenuItem>
                        </material_1.Select>
                      </material_1.FormControl>
                    </material_1.Box>
                    {(visitType === types_1.VisitType.PreBook || visitType === types_1.VisitType.PostTelemed) && (<SlotPicker_1.default slotData={visitType === types_1.VisitType.PostTelemed
                    ? (_b = locationWithSlotData === null || locationWithSlotData === void 0 ? void 0 : locationWithSlotData.telemedAvailable) === null || _b === void 0 ? void 0 : _b.map(function (si) { return si.slot; })
                    : (_c = locationWithSlotData === null || locationWithSlotData === void 0 ? void 0 : locationWithSlotData.available) === null || _c === void 0 ? void 0 : _c.map(function (si) { return si.slot; })} slotsLoading={loadingSlotState.status === 'loading'} timezone={((_d = locationWithSlotData === null || locationWithSlotData === void 0 ? void 0 : locationWithSlotData.location) === null || _d === void 0 ? void 0 : _d.timezone) || 'Undefined'} selectedSlot={slot} setSelectedSlot={setSlot}/>)}
                  </material_1.Box>)}

                {showFields.forcePatientSearch && (<material_1.Box marginTop={4}>
                    <material_1.Typography variant="body1" color="primary.dark">
                      Please enter the mobile number and search for existing patients before proceeding.
                    </material_1.Typography>
                  </material_1.Box>)}

                {/* form buttons */}
                <material_1.Box marginTop={4}>
                  {errors.submit && (<material_1.Typography color="error" variant="body2" mb={2}>
                      Failed to add patient. Please try again.
                    </material_1.Typography>)}
                  {errors.search && (<material_1.Typography color="error" variant="body2" mb={2}>
                      Please search for patients before adding
                    </material_1.Typography>)}
                  <lab_1.LoadingButton data-testid={data_test_ids_1.dataTestIds.addPatientPage.addButton} variant="contained" type="submit" loading={loading || searching} sx={{
            borderRadius: 100,
            textTransform: 'none',
            fontWeight: 600,
            marginRight: 1,
        }}>
                    Add {visitType}
                  </lab_1.LoadingButton>
                  <material_1.Button data-testid={data_test_ids_1.dataTestIds.addPatientPage.cancelButton} sx={{
            borderRadius: 100,
            textTransform: 'none',
            fontWeight: 600,
        }} onClick={function () {
            navigate('/visits');
        }}>
                    Cancel
                  </material_1.Button>
                </material_1.Box>
              </material_1.Box>
            </form>
            <CustomDialog_1.CustomDialog open={selectSlotDialogOpen} title="Please select a date and time" description="To continue, please select an available appointment." closeButtonText="Close" handleClose={function () { return setSelectSlotDialogOpen(false); }}/>
          </material_1.Paper>
        </material_1.Grid>

        <material_1.Grid item xs={3.5}/>
      </material_1.Grid>
    </PageContainer_1.default>);
}
//# sourceMappingURL=AddPatient.js.map