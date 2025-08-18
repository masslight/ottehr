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
exports.default = LocationSelect;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var data_test_ids_1 = require("../constants/data-test-ids");
var helpers_1 = require("../helpers");
var useAppClients_1 = require("../hooks/useAppClients");
var LoadingState;
(function (LoadingState) {
    LoadingState[LoadingState["initial"] = 0] = "initial";
    LoadingState[LoadingState["loading"] = 1] = "loading";
    LoadingState[LoadingState["loaded"] = 2] = "loaded";
})(LoadingState || (LoadingState = {}));
function LocationSelect(_a) {
    var queryParams = _a.queryParams, location = _a.location, handleSubmit = _a.handleSubmit, setLocation = _a.setLocation, updateURL = _a.updateURL, storeLocationInLocalStorage = _a.storeLocationInLocalStorage, required = _a.required, renderInputProps = _a.renderInputProps;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var _b = (0, react_1.useState)([]), locations = _b[0], setLocations = _b[1];
    var _c = (0, react_1.useState)(LoadingState.initial), loadingState = _c[0], setLoadingState = _c[1];
    var navigate = (0, react_router_dom_1.useNavigate)();
    (0, react_1.useEffect)(function () {
        var _a, _b, _c;
        if (updateURL && localStorage.getItem('selectedLocation')) {
            queryParams === null || queryParams === void 0 ? void 0 : queryParams.set('locationID', (_c = (_b = JSON.parse((_a = localStorage.getItem('selectedLocation')) !== null && _a !== void 0 ? _a : '')) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : '');
            navigate("?".concat(queryParams === null || queryParams === void 0 ? void 0 : queryParams.toString()));
        }
    }, [navigate, queryParams, updateURL]);
    (0, react_1.useEffect)(function () {
        function getLocationsResults(oystehr) {
            return __awaiter(this, void 0, void 0, function () {
                var searchResults_1, locationsResults, mappedLocations, e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!oystehr) {
                                return [2 /*return*/];
                            }
                            setLoadingState(LoadingState.loading);
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, 4, 5]);
                            return [4 /*yield*/, oystehr.fhir.search({
                                    resourceType: 'Location',
                                    params: [
                                        { name: '_count', value: '1000' },
                                        { name: '_revinclude', value: 'Schedule:actor:Location' },
                                    ],
                                })];
                        case 2:
                            searchResults_1 = (_a.sent()).unbundle();
                            locationsResults = searchResults_1.filter(function (loc) { return loc.resourceType === 'Location' && !(0, utils_1.isLocationVirtual)(loc); });
                            mappedLocations = locationsResults.map(function (locationTemp) {
                                var location = locationTemp;
                                var schedule = searchResults_1.find(function (scheduleTemp) {
                                    var _a;
                                    return (scheduleTemp.resourceType === 'Schedule' &&
                                        ((_a = scheduleTemp.actor) === null || _a === void 0 ? void 0 : _a.some(function (actor) { return actor.reference === "Location/".concat(location.id); })));
                                });
                                return __assign(__assign({}, location), { walkinSchedule: schedule });
                            });
                            setLocations(mappedLocations);
                            return [3 /*break*/, 5];
                        case 3:
                            e_1 = _a.sent();
                            console.error('error loading locations', e_1);
                            return [3 /*break*/, 5];
                        case 4:
                            setLoadingState(LoadingState.loaded);
                            return [7 /*endfinally*/];
                        case 5: return [2 /*return*/];
                    }
                });
            });
        }
        if (oystehr && loadingState === LoadingState.initial) {
            void getLocationsResults(oystehr);
        }
    }, [oystehr, loadingState]);
    var getLocationLabel = function (location) {
        var _a;
        if (!location.name) {
            console.log('Location name is undefined', location);
            return 'Unknown Location';
        }
        return ((_a = location.address) === null || _a === void 0 ? void 0 : _a.state) ? "".concat(location.address.state.toUpperCase(), " - ").concat(location.name) : location.name;
    };
    var options = (0, react_1.useMemo)(function () {
        var allLocations = locations.map(function (location) {
            return {
                label: getLocationLabel(location),
                value: location.id,
            };
        });
        return (0, helpers_1.sortLocationsByLabel)(allLocations);
    }, [locations]);
    var handleLocationChange = function (event, newValue) {
        var selectedLocation = newValue
            ? locations.find(function (locationTemp) { return locationTemp.id === newValue.value; })
            : undefined;
        console.log('selected location in handle location change', selectedLocation);
        setLocation(selectedLocation);
        if (storeLocationInLocalStorage) {
            if (newValue) {
                localStorage.setItem('selectedLocation', JSON.stringify(selectedLocation));
            }
            else {
                localStorage.removeItem('selectedLocation');
            }
        }
        if (handleSubmit) {
            handleSubmit(event, selectedLocation, 'location');
        }
    };
    return (<material_1.Autocomplete data-testid={data_test_ids_1.dataTestIds.dashboard.locationSelect} disabled={renderInputProps === null || renderInputProps === void 0 ? void 0 : renderInputProps.disabled} value={location
            ? {
                label: getLocationLabel(location),
                value: location === null || location === void 0 ? void 0 : location.id,
            }
            : null} onChange={handleLocationChange} isOptionEqualToValue={function (option, tempValue) { return option.value === tempValue.value; }} options={options} renderOption={function (props, option) {
            return (<li {...props} key={option.value}>
            {option.label}
          </li>);
        }} fullWidth renderInput={function (params) { return (<material_1.TextField placeholder="Search location" name="location" {...params} label="Location" required={required}/>); }}/>);
}
//# sourceMappingURL=LocationSelect.js.map