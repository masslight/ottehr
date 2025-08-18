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
exports.default = Appointments;
var Add_1 = require("@mui/icons-material/Add");
var KeyboardArrowDown_1 = require("@mui/icons-material/KeyboardArrowDown");
var KeyboardArrowUp_1 = require("@mui/icons-material/KeyboardArrowUp");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_page_visibility_1 = require("react-page-visibility");
var react_router_dom_1 = require("react-router-dom");
var usePatientLabOrders_1 = require("src/features/external-labs/components/labs-orders/usePatientLabOrders");
var useInHouseLabOrders_1 = require("src/features/in-house-labs/components/orders/useInHouseLabOrders");
var useNursingOrders_1 = require("src/features/nursing-orders/components/orders/useNursingOrders");
var usePatientRadiologyOrders_1 = require("src/features/radiology/components/usePatientRadiologyOrders");
var telemed_1 = require("src/telemed");
var api_1 = require("../api/api");
var AppointmentTabs_1 = require("../components/AppointmentTabs");
var CreateDemoVisits_1 = require("../components/CreateDemoVisits");
var DateSearch_1 = require("../components/DateSearch");
var GroupSelect_1 = require("../components/GroupSelect");
var LocationSelect_1 = require("../components/LocationSelect");
var ProvidersSelect_1 = require("../components/ProvidersSelect");
var data_test_ids_1 = require("../constants/data-test-ids");
var misc_helper_1 = require("../helpers/misc.helper");
var useAppClients_1 = require("../hooks/useAppClients");
var PageContainer_1 = require("../layout/PageContainer");
var hooks_1 = require("../telemed/hooks");
var types_1 = require("../types/types");
function Appointments() {
    var _this = this;
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var _a = (0, react_1.useState)(undefined), locationSelected = _a[0], setLocationSelected = _a[1];
    var _b = (0, react_1.useState)({ status: 'initial' }), loadingState = _b[0], setLoadingState = _b[1];
    var _c = (0, react_1.useState)(undefined), practitioners = _c[0], setPractitioners = _c[1];
    var _d = (0, react_1.useState)(undefined), healthcareServices = _d[0], setHealthcareServices = _d[1];
    var _e = (0, react_1.useState)(luxon_1.DateTime.local()), appointmentDate = _e[0], setAppointmentDate = _e[1];
    var _f = (0, react_1.useState)(false), editingComment = _f[0], setEditingComment = _f[1];
    var _g = (0, react_1.useState)(null), searchResults = _g[0], setSearchResults = _g[1];
    var location = (0, react_router_dom_1.useLocation)();
    var navigate = (0, react_router_dom_1.useNavigate)();
    var pageIsVisible = (0, react_page_visibility_1.usePageVisibility)(); // goes to false if tab loses focus and gives the fhir api a break
    var debounce = (0, hooks_1.useDebounce)(300).debounce;
    var handleSubmit = function (event, value, field) {
        var _a, _b, _c;
        if (field === 'date') {
            queryParams === null || queryParams === void 0 ? void 0 : queryParams.set('searchDate', (_b = (_a = value === null || value === void 0 ? void 0 : value.toISODate()) !== null && _a !== void 0 ? _a : appointmentDate === null || appointmentDate === void 0 ? void 0 : appointmentDate.toISODate()) !== null && _b !== void 0 ? _b : '');
        }
        else if (field === 'location') {
            queryParams === null || queryParams === void 0 ? void 0 : queryParams.set('locationID', (_c = value === null || value === void 0 ? void 0 : value.id) !== null && _c !== void 0 ? _c : '');
        }
        else if (field === 'visitTypes') {
            var appointmentTypesString = value.join(',');
            queryParams.set('visitType', appointmentTypesString);
        }
        else if (field === 'providers') {
            var providersString = value.join(',');
            queryParams.set('providers', providersString);
        }
        else if (field === 'groups') {
            var groupsString = value.join(',');
            queryParams.set('groups', groupsString);
        }
        setEditingComment(false);
        navigate("?".concat(queryParams === null || queryParams === void 0 ? void 0 : queryParams.toString()));
    };
    var queryParams = (0, react_1.useMemo)(function () {
        return new URLSearchParams(location.search);
    }, [location.search]);
    var _h = (function () {
        var _a, _b;
        var locationID = queryParams.get('locationID') || '';
        var searchDate = queryParams.get('searchDate') || '';
        var appointmentTypesString = queryParams.get('visitType') || '';
        var providers = ((_a = queryParams.get('providers')) === null || _a === void 0 ? void 0 : _a.split(',')) || [];
        if (providers.length === 1 && providers[0] === '') {
            providers = [];
        }
        var groups = ((_b = queryParams.get('groups')) === null || _b === void 0 ? void 0 : _b.split(',')) || [];
        if (groups.length === 1 && groups[0] === '') {
            groups = [];
        }
        var queryId = "".concat(locationID, ":").concat(locationSelected === null || locationSelected === void 0 ? void 0 : locationSelected.id, ":").concat(providers, ":").concat(groups, ":").concat(searchDate, ":").concat(appointmentTypesString);
        var visitType = appointmentTypesString ? appointmentTypesString.split(',') : [];
        return { locationID: locationID, searchDate: searchDate, visitType: visitType, providers: providers, groups: groups, queryId: queryId };
    })(), locationID = _h.locationID, searchDate = _h.searchDate, visitType = _h.visitType, providers = _h.providers, groups = _h.groups, queryId = _h.queryId;
    var _j = searchResults || {}, _k = _j.preBooked, preBookedAppointments = _k === void 0 ? [] : _k, _l = _j.completed, completedAppointments = _l === void 0 ? [] : _l, _m = _j.cancelled, cancelledAppointments = _m === void 0 ? [] : _m, _o = _j.inOffice, inOfficeAppointments = _o === void 0 ? [] : _o;
    var inOfficeEncounterIds = inOfficeAppointments.map(function (appointment) { return appointment.encounterId; });
    var completedEncounterIds = completedAppointments.map(function (appointment) { return appointment.encounterId; });
    var encountersIdsEligibleForOrders = __spreadArray(__spreadArray([], inOfficeEncounterIds, true), completedEncounterIds, true);
    var externalLabOrders = (0, usePatientLabOrders_1.usePatientLabOrders)({
        searchBy: { field: 'encounterIds', value: encountersIdsEligibleForOrders },
    });
    var externalLabOrdersByAppointmentId = (0, react_1.useMemo)(function () {
        var _a;
        return (_a = externalLabOrders === null || externalLabOrders === void 0 ? void 0 : externalLabOrders.labOrders) === null || _a === void 0 ? void 0 : _a.reduce(function (acc, order) {
            acc[order.appointmentId] = __spreadArray(__spreadArray([], (acc[order.appointmentId] || []), true), [order], false);
            return acc;
        }, {});
    }, [externalLabOrders === null || externalLabOrders === void 0 ? void 0 : externalLabOrders.labOrders]);
    var inHouseOrders = (0, useInHouseLabOrders_1.useInHouseLabOrders)({
        searchBy: { field: 'encounterIds', value: encountersIdsEligibleForOrders },
    });
    var inHouseLabOrdersByAppointmentId = (0, react_1.useMemo)(function () {
        var _a;
        return (_a = inHouseOrders === null || inHouseOrders === void 0 ? void 0 : inHouseOrders.labOrders) === null || _a === void 0 ? void 0 : _a.reduce(function (acc, order) {
            acc[order.appointmentId] = __spreadArray(__spreadArray([], (acc[order.appointmentId] || []), true), [order], false);
            return acc;
        }, {});
    }, [inHouseOrders === null || inHouseOrders === void 0 ? void 0 : inHouseOrders.labOrders]);
    var nursingOrders = (0, useNursingOrders_1.useGetNursingOrders)({
        searchBy: { field: 'encounterIds', value: encountersIdsEligibleForOrders },
    }).nursingOrders;
    var nursingOrdersByAppointmentId = (0, react_1.useMemo)(function () {
        return nursingOrders === null || nursingOrders === void 0 ? void 0 : nursingOrders.reduce(function (acc, order) {
            acc[order.appointmentId] = __spreadArray(__spreadArray([], (acc[order.appointmentId] || []), true), [order], false);
            return acc;
        }, {});
    }, [nursingOrders]);
    var inHouseMedications = (0, telemed_1.useGetMedicationOrders)({
        field: 'encounterIds',
        value: encountersIdsEligibleForOrders,
    }).data;
    var inHouseMedicationsByEncounterId = (0, react_1.useMemo)(function () {
        var _a;
        if (!(inHouseMedications === null || inHouseMedications === void 0 ? void 0 : inHouseMedications.orders))
            return {};
        return (_a = inHouseMedications === null || inHouseMedications === void 0 ? void 0 : inHouseMedications.orders) === null || _a === void 0 ? void 0 : _a.reduce(function (acc, med) {
            acc[med.encounterId] = __spreadArray(__spreadArray([], (acc[med.encounterId] || []), true), [med], false);
            return acc;
        }, {});
    }, [inHouseMedications === null || inHouseMedications === void 0 ? void 0 : inHouseMedications.orders]);
    var radiologyOrders = (0, usePatientRadiologyOrders_1.usePatientRadiologyOrders)({ encounterIds: encountersIdsEligibleForOrders }).orders;
    var radiologyOrdersByAppointmentId = (0, react_1.useMemo)(function () {
        return radiologyOrders === null || radiologyOrders === void 0 ? void 0 : radiologyOrders.reduce(function (acc, order) {
            acc[order.appointmentId] = __spreadArray(__spreadArray([], (acc[order.appointmentId] || []), true), [order], false);
            return acc;
        }, {});
    }, [radiologyOrders]);
    var orders = {
        externalLabOrdersByAppointmentId: externalLabOrdersByAppointmentId,
        inHouseLabOrdersByAppointmentId: inHouseLabOrdersByAppointmentId,
        nursingOrdersByAppointmentId: nursingOrdersByAppointmentId,
        inHouseMedicationsByEncounterId: inHouseMedicationsByEncounterId,
        radiologyOrdersByAppointmentId: radiologyOrdersByAppointmentId,
    };
    (0, react_1.useEffect)(function () {
        var _a;
        var selectedVisitTypes = localStorage.getItem('selectedVisitTypes');
        if (selectedVisitTypes) {
            queryParams === null || queryParams === void 0 ? void 0 : queryParams.set('visitType', (_a = JSON.parse(selectedVisitTypes)) !== null && _a !== void 0 ? _a : '');
            navigate("?".concat(queryParams === null || queryParams === void 0 ? void 0 : queryParams.toString()));
        }
        else {
            queryParams === null || queryParams === void 0 ? void 0 : queryParams.set('visitType', Object.keys(types_1.VisitTypeToLabel).join(','));
        }
    }, [navigate, queryParams]);
    (0, react_1.useEffect)(function () {
        var _a, _b;
        if (localStorage.getItem('selectedProviders')) {
            queryParams === null || queryParams === void 0 ? void 0 : queryParams.set('providers', (_b = JSON.parse((_a = localStorage.getItem('selectedProviders')) !== null && _a !== void 0 ? _a : '')) !== null && _b !== void 0 ? _b : '');
            navigate("?".concat(queryParams === null || queryParams === void 0 ? void 0 : queryParams.toString()));
        }
    }, [navigate, queryParams]);
    (0, react_1.useEffect)(function () {
        var _a, _b;
        if (localStorage.getItem('selectedGroups')) {
            queryParams === null || queryParams === void 0 ? void 0 : queryParams.set('groups', (_b = JSON.parse((_a = localStorage.getItem('selectedGroups')) !== null && _a !== void 0 ? _a : '')) !== null && _b !== void 0 ? _b : '');
            navigate("?".concat(queryParams === null || queryParams === void 0 ? void 0 : queryParams.toString()));
        }
    }, [navigate, queryParams]);
    (0, react_1.useEffect)(function () {
        var _a, _b;
        var locationStore = localStorage === null || localStorage === void 0 ? void 0 : localStorage.getItem('selectedLocation');
        if (locationStore && !locationSelected) {
            setLocationSelected(JSON.parse(locationStore));
        }
        var dateStore = localStorage === null || localStorage === void 0 ? void 0 : localStorage.getItem('selectedDate');
        if (dateStore && !appointmentDate) {
            setAppointmentDate === null || setAppointmentDate === void 0 ? void 0 : setAppointmentDate((_b = JSON.parse((_a = localStorage.getItem('selectedDate')) !== null && _a !== void 0 ? _a : '')) !== null && _b !== void 0 ? _b : null);
        }
    }, [appointmentDate, locationSelected, queryParams]);
    (0, react_1.useEffect)(function () {
        function getPractitioners(oystehrClient) {
            return __awaiter(this, void 0, void 0, function () {
                var practitionersTemp, e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!oystehrClient) {
                                return [2 /*return*/];
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, oystehrClient.fhir.search({
                                    resourceType: 'Practitioner',
                                    params: [
                                        { name: '_count', value: '1000' },
                                        // { name: 'name:missing', value: 'false' },
                                    ],
                                })];
                        case 2:
                            practitionersTemp = (_a.sent()).unbundle();
                            setPractitioners(practitionersTemp);
                            return [3 /*break*/, 4];
                        case 3:
                            e_1 = _a.sent();
                            console.error('error loading practitioners', e_1);
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        }
        function getHealthcareServices(oystehrClient) {
            return __awaiter(this, void 0, void 0, function () {
                var healthcareServicesTemp, e_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!oystehrZambda) {
                                return [2 /*return*/];
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, oystehrClient.fhir.search({
                                    resourceType: 'HealthcareService',
                                    params: [
                                        { name: '_count', value: '1000' },
                                        // { name: 'name:missing', value: 'false' },
                                    ],
                                })];
                        case 2:
                            healthcareServicesTemp = (_a.sent()).unbundle();
                            setHealthcareServices(healthcareServicesTemp);
                            return [3 /*break*/, 4];
                        case 3:
                            e_2 = _a.sent();
                            console.error('error loading HealthcareServices', e_2);
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        }
        if (oystehrZambda) {
            void getPractitioners(oystehrZambda);
            void getHealthcareServices(oystehrZambda);
        }
    }, [oystehrZambda]);
    (0, react_1.useEffect)(function () {
        var _a;
        var fetchStuff = function (client, searchDate) { return __awaiter(_this, void 0, void 0, function () {
            var searchResults_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setLoadingState({ status: 'loading' });
                        if (!((locationID || (locationSelected === null || locationSelected === void 0 ? void 0 : locationSelected.id) || providers.length > 0 || groups.length > 0) &&
                            searchDate &&
                            Array.isArray(visitType))) return [3 /*break*/, 2];
                        return [4 /*yield*/, (0, api_1.getAppointments)(client, {
                                locationID: locationID || (locationSelected === null || locationSelected === void 0 ? void 0 : locationSelected.id) || undefined,
                                searchDate: searchDate,
                                visitType: visitType,
                                providerIDs: providers,
                                groupIDs: groups,
                            })];
                    case 1:
                        searchResults_1 = _a.sent();
                        debounce(function () {
                            setSearchResults(searchResults_1 || []);
                            setLoadingState({ status: 'loaded', id: queryId });
                        });
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        }); };
        if ((locationSelected || providers.length > 0 || groups.length > 0) &&
            oystehrZambda &&
            !editingComment &&
            loadingState.id !== queryId &&
            loadingState.status !== 'loading' &&
            pageIsVisible) {
            // send searchDate without timezone, in get-appointments zambda we apply appointment timezone to it to find appointments for that day
            // looks like searchDate is always exists, and we can remove rest options
            var searchDateToUse = searchDate || ((_a = appointmentDate === null || appointmentDate === void 0 ? void 0 : appointmentDate.toISO) === null || _a === void 0 ? void 0 : _a.call(appointmentDate)) || '';
            void fetchStuff(oystehrZambda, searchDateToUse);
        }
    }, [
        locationSelected,
        oystehrZambda,
        editingComment,
        loadingState,
        queryId,
        locationID,
        searchDate,
        appointmentDate,
        visitType,
        providers,
        groups,
        queryParams,
        pageIsVisible,
        debounce,
    ]);
    (0, react_1.useEffect)(function () {
        var appointmentInterval = setInterval(function () { return setLoadingState({ status: 'initial' }); }, 30000);
        // Call updateAppointments so we don't need to wait for it to be called
        // getConversations().catch((error) => console.log(error));
        return function () { return clearInterval(appointmentInterval); };
    }, []);
    return (<AppointmentsBody loadingState={loadingState} queryParams={queryParams} handleSubmit={handleSubmit} visitType={visitType} providers={providers} groups={groups} preBookedAppointments={preBookedAppointments} completedAppointments={completedAppointments} cancelledAppointments={cancelledAppointments} inOfficeAppointments={inOfficeAppointments} orders={orders} locationSelected={locationSelected} setLocationSelected={setLocationSelected} practitioners={practitioners} healthcareServices={healthcareServices} appointmentDate={appointmentDate} setAppointmentDate={setAppointmentDate} updateAppointments={function () { return setLoadingState({ status: 'initial' }); }} setEditingComment={setEditingComment}/>);
}
function AppointmentsBody(props) {
    var loadingState = props.loadingState, preBookedAppointments = props.preBookedAppointments, completedAppointments = props.completedAppointments, cancelledAppointments = props.cancelledAppointments, inOfficeAppointments = props.inOfficeAppointments, locationSelected = props.locationSelected, setLocationSelected = props.setLocationSelected, appointmentDate = props.appointmentDate, visitType = props.visitType, providers = props.providers, groups = props.groups, practitioners = props.practitioners, healthcareServices = props.healthcareServices, setAppointmentDate = props.setAppointmentDate, queryParams = props.queryParams, handleSubmit = props.handleSubmit, updateAppointments = props.updateAppointments, setEditingComment = props.setEditingComment, orders = props.orders;
    var _a = (0, react_1.useState)(true), displayFilters = _a[0], setDisplayFilters = _a[1];
    var theme = (0, material_1.useTheme)();
    return (<form>
      <PageContainer_1.default>
        <>
          <material_1.Box sx={{
            position: { xs: 'static', sm: 'sticky' },
            top: (0, misc_helper_1.adjustTopForBannerHeight)(80),
            zIndex: 1,
            backgroundColor: '#F9FAFB',
            alignItems: 'center',
            width: '100%',
        }}>
            <material_1.Paper sx={{ padding: 2 }}>
              <material_1.Grid container sx={{ justifyContent: 'center' }} spacing={2}>
                <material_1.Grid item alignItems="center" sx={{
            display: { xs: 'flex', sm: 'flex', md: 'none' },
            width: '100%',
            color: theme.palette.primary.main,
        }}>
                  <material_1.IconButton onClick={function () { return setDisplayFilters(!displayFilters); }} sx={{ color: theme.palette.primary.main }}>
                    {displayFilters ? (<KeyboardArrowUp_1.default fontSize="small"></KeyboardArrowUp_1.default>) : (<KeyboardArrowDown_1.default fontSize="small"></KeyboardArrowDown_1.default>)}
                  </material_1.IconButton>
                  <material_1.Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Filters
                  </material_1.Typography>
                </material_1.Grid>
                {displayFilters && (<>
                    <material_1.Grid item md={2.8} xs={12}>
                      <LocationSelect_1.default queryParams={queryParams} handleSubmit={handleSubmit} location={locationSelected} updateURL={true} storeLocationInLocalStorage={true} setLocation={setLocationSelected}></LocationSelect_1.default>
                    </material_1.Grid>
                    <material_1.Grid item md={4.7} xs={12}>
                      <material_1.Autocomplete id="visitTypes" sx={{
                '.MuiButtonBase-root.MuiChip-root': {
                    width: { xs: '100%', sm: '120px' },
                    textAlign: 'start',
                },
            }} value={visitType} options={Object.keys(types_1.VisitTypeToLabel)} getOptionLabel={function (option) {
                return types_1.VisitTypeToLabel[option];
            }} onChange={function (event, value) {
                if (value) {
                    localStorage.setItem('selectedVisitTypes', JSON.stringify(value));
                }
                else {
                    localStorage.removeItem('selectedVisitTypes');
                }
                if (handleSubmit) {
                    handleSubmit(event, value, 'visitTypes');
                }
            }} multiple renderInput={function (params) { return (<material_1.TextField name="visitTypes" {...params} label="Visit type" required={false}/>); }}/>
                    </material_1.Grid>
                    <material_1.Grid item md={2.8} xs={12}>
                      <DateSearch_1.default label="Select Date" queryParams={queryParams} handleSubmit={handleSubmit} date={appointmentDate} setDate={setAppointmentDate} updateURL={true} storeDateInLocalStorage={true} defaultValue={luxon_1.DateTime.now()} closeOnSelect={true}></DateSearch_1.default>
                    </material_1.Grid>
                    <material_1.Grid item md={2.8} xs={12}>
                      <ProvidersSelect_1.default providers={providers} practitioners={practitioners} handleSubmit={handleSubmit}></ProvidersSelect_1.default>
                    </material_1.Grid>
                    <material_1.Grid item xs={2}>
                      <GroupSelect_1.default groups={groups} healthcareServices={healthcareServices} handleSubmit={handleSubmit}></GroupSelect_1.default>
                    </material_1.Grid>
                    <material_1.Grid item md={1.4} sm={12} sx={{ alignSelf: 'center', display: { xs: 'none', sm: 'block' } }}>
                      <react_router_dom_1.Link to="/visits/add">
                        <material_1.Button data-testid={data_test_ids_1.dataTestIds.dashboard.addPatientButton} sx={{
                borderRadius: 100,
                textTransform: 'none',
                fontWeight: 600,
                marginBottom: '20px',
            }} color="primary" variant="contained">
                          <Add_1.default />
                          <material_1.Typography fontWeight="bold">Add patient</material_1.Typography>
                        </material_1.Button>
                      </react_router_dom_1.Link>
                    </material_1.Grid>
                  </>)}
              </material_1.Grid>
            </material_1.Paper>
            {/* only displayed on mobile */}
            <material_1.Box sx={{ display: { xs: 'block', sm: 'none' }, mt: 2 }}>
              <react_router_dom_1.Link to="/visits/add">
                <material_1.Button sx={{
            borderRadius: 100,
            textTransform: 'none',
            fontWeight: 600,
            width: '100%',
        }} color="primary" variant="contained">
                  <Add_1.default />
                  <material_1.Typography fontWeight="bold">Add patient</material_1.Typography>
                </material_1.Button>
              </react_router_dom_1.Link>
            </material_1.Box>
          </material_1.Box>
          <material_1.Box sx={{
            marginTop: '24px',
            width: '100%',
        }}>
            <AppointmentTabs_1.default location={locationSelected} providers={providers} groups={groups} preBookedAppointments={preBookedAppointments} cancelledAppointments={cancelledAppointments} completedAppointments={completedAppointments} inOfficeAppointments={inOfficeAppointments} orders={orders} loading={loadingState.status === 'loading'} updateAppointments={updateAppointments} setEditingComment={setEditingComment}/>
          </material_1.Box>
          <CreateDemoVisits_1.default />
        </>
      </PageContainer_1.default>
    </form>);
}
//# sourceMappingURL=Appointments.js.map