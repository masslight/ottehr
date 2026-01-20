"use strict";
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
var fhir_1 = require("utils/lib/fhir");
var locations_1 = require("utils/lib/ottehr-config/locations");
var vitest_1 = require("vitest");
var locations_and_schedules_json_1 = require("../../../config/oystehr/locations-and-schedules.json");
(0, vitest_1.describe)('location config matches spec', function () {
    var inPersonLocationsFromSpec = [];
    var telemedLocationsFromSpec = [];
    Object.entries(locations_and_schedules_json_1.default.fhirResources).forEach(function (_a) {
        var _b;
        var _ = _a[0], value = _a[1];
        if (((_b = value.resource) === null || _b === void 0 ? void 0 : _b.resourceType) === 'Location') {
            var location_1 = value.resource;
            var locationName = location_1.name;
            if ((0, fhir_1.isLocationVirtual)(location_1)) {
                telemedLocationsFromSpec.push(locationName);
            }
            else {
                inPersonLocationsFromSpec.push(locationName);
            }
        }
    });
    test('lengths match', function () {
        (0, vitest_1.expect)(inPersonLocationsFromSpec.length).toBe(locations_1.LOCATION_CONFIG.inPersonLocations.length);
        (0, vitest_1.expect)(telemedLocationsFromSpec.length).toBe(locations_1.LOCATION_CONFIG.telemedLocations.length);
    });
    test('in-person locations match', function () {
        var sortedInPersonConfig = __spreadArray([], locations_1.LOCATION_CONFIG.inPersonLocations.map(function (loc) { return loc.name; }), true).sort();
        var sortedInPersonSpec = inPersonLocationsFromSpec.sort();
        (0, vitest_1.expect)(sortedInPersonConfig).toEqual(sortedInPersonSpec);
    });
    test('telemed locations match', function () {
        var sortedTelemedConfig = __spreadArray([], locations_1.LOCATION_CONFIG.telemedLocations.map(function (loc) { return loc.name; }), true).sort();
        var sortedTelemedSpec = telemedLocationsFromSpec.sort();
        (0, vitest_1.expect)(sortedTelemedConfig).toEqual(sortedTelemedSpec);
    });
});
