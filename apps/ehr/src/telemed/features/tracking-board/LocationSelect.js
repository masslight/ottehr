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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationsSelect = LocationsSelect;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var helpers_1 = require("../../../helpers");
var useAppClients_1 = require("../../../hooks/useAppClients");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var state_1 = require("../../state");
var LoadingState;
(function (LoadingState) {
    LoadingState[LoadingState["initial"] = 0] = "initial";
    LoadingState[LoadingState["loading"] = 1] = "loading";
    LoadingState[LoadingState["loaded"] = 2] = "loaded";
})(LoadingState || (LoadingState = {}));
function LocationsSelect() {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var _a = (0, react_1.useState)([]), locations = _a[0], setLocations = _a[1];
    var _b = (0, react_1.useState)(LoadingState.initial), loadingState = _b[0], setLoadingState = _b[1];
    var locationsIds = (0, getSelectors_1.getSelectors)(state_1.useTrackingBoardStore, ['locationsIds']).locationsIds;
    (0, react_1.useEffect)(function () {
        function getLocationsResults(oystehr) {
            return __awaiter(this, void 0, void 0, function () {
                var locationsResults, e_1;
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
                                    params: [{ name: '_count', value: '1000' }],
                                })];
                        case 2:
                            locationsResults = (_a.sent()).unbundle();
                            locationsResults = locationsResults.filter(function (loc) { return !(0, utils_1.isLocationVirtual)(loc); });
                            setLocations(locationsResults);
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
    var options = (0, react_1.useMemo)(function () {
        var allLocations = locations.map(function (location) {
            var _a, _b;
            return { label: "".concat((_b = (_a = location.address) === null || _a === void 0 ? void 0 : _a.state) === null || _b === void 0 ? void 0 : _b.toUpperCase(), " - ").concat(location.name), value: location.id };
        });
        return (0, helpers_1.sortLocationsByLabel)(allLocations);
    }, [locations]);
    var currentDropdownValues = (0, react_1.useMemo)(function () {
        if ((locationsIds === null || locationsIds === void 0 ? void 0 : locationsIds.length) === 0) {
            return [];
        }
        var actualSelectedLocationsOptions = (locationsIds || []).map(function (locationId) {
            var _a;
            return ({
                label: ((_a = locations.find(function (locationTemp) { return locationTemp.id === locationId; })) === null || _a === void 0 ? void 0 : _a.name) || '',
                value: locationId,
            });
        });
        return actualSelectedLocationsOptions;
    }, [locationsIds, locations]);
    var handleLocationsChange = (0, react_1.useCallback)(function (event, selectedOptions) {
        var locationsIds = selectedOptions
            .filter(function (locationOption) { return !!locationOption.value; })
            .map(function (locationOption) { return locationOption.value; });
        var locationsIdsOrNull = locationsIds.length !== 0 ? locationsIds : null;
        state_1.useTrackingBoardStore.setState({ locationsIds: locationsIdsOrNull });
    }, []);
    return (<material_1.Autocomplete data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardLocationsSelect} value={currentDropdownValues} onChange={handleLocationsChange} getOptionLabel={function (state) { return state.label || 'Unknown'; }} isOptionEqualToValue={function (option, tempValue) { return option.value === tempValue.value; }} options={options} renderOption={function (props, option) {
            return (<li {...props} key={option.value} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardLocationsSelectOption(option.value)}>
            {option.label}
          </li>);
        }} fullWidth multiple renderInput={function (params) { return <material_1.TextField name="location" {...params} label="Locations"/>; }} renderTags={function (options, getTagProps) {
            return options.map(function (option, index) {
                var _a = getTagProps({ index: index }), key = _a.key, onDelete = _a.onDelete, tagProps = __rest(_a, ["key", "onDelete"]);
                return <material_1.Chip variant="filled" label={option.label} key={key} onDelete={onDelete} {...tagProps}/>;
            });
        }}/>);
}
//# sourceMappingURL=LocationSelect.js.map