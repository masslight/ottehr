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
var fs_1 = require("fs");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var VALID_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production', 'etc'];
var USAGE_STR = "Usage: npm run update-locations-for-lab-accounts [".concat(VALID_ENVS.join(' | '), "]\n");
main().catch(function (error) {
    console.error('Script failed:', error);
    process.exit(1);
});
/**
 * Maps existing lab Organizations to Locations in a project. This enables each Location to order tests from the same Laboratory
 * using Location-specific account numbers. This should only be used to transition existing projects from the old model (one account number per Lab Org)
 * to the new model.
 */
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var ENV, envConfig, token, oystehrClient, requests, _a, locationsResponse, labOrgsResponse, locations, labOrgs, labIdentifiers, results, e_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (process.argv.length !== 3) {
                        console.error("exiting, incorrect number of arguments passed\n");
                        console.log(USAGE_STR);
                        process.exit(1);
                    }
                    ENV = process.argv[2].toLowerCase();
                    ENV = ENV === 'dev' ? 'development' : ENV;
                    if (!ENV) {
                        console.error("exiting, ENV variable must be populated");
                        console.log(USAGE_STR);
                        process.exit(2);
                    }
                    envConfig = undefined;
                    try {
                        envConfig = JSON.parse(fs_1.default.readFileSync(".env/".concat(ENV, ".json"), 'utf8'));
                    }
                    catch (e) {
                        console.error("Unable to read env file. Error: ".concat(JSON.stringify(e)));
                        process.exit(3);
                    }
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(envConfig)];
                case 1:
                    token = _b.sent();
                    if (!token) {
                        console.error('Failed to fetch auth token.');
                        process.exit(4);
                    }
                    oystehrClient = (0, shared_1.createOystehrClient)(token, envConfig);
                    requests = [];
                    return [4 /*yield*/, Promise.all([
                            getLocations(oystehrClient),
                            getLabOrgs(oystehrClient),
                        ])];
                case 2:
                    _a = _b.sent(), locationsResponse = _a[0], labOrgsResponse = _a[1];
                    locations = locationsResponse
                        .unbundle()
                        .filter(function (loc) {
                        var _a;
                        return !((_a = loc.extension) === null || _a === void 0 ? void 0 : _a.some(function (ext) {
                            var _a, _b;
                            return ((_a = ext.valueCoding) === null || _a === void 0 ? void 0 : _a.code) === 'vi' &&
                                ((_b = ext.valueCoding) === null || _b === void 0 ? void 0 : _b.system) === 'http://terminology.hl7.org/CodeSystem/location-physical-type';
                        }));
                    });
                    labOrgs = labOrgsResponse.unbundle();
                    console.log("This is returned locations: ".concat(JSON.stringify(locations)));
                    console.log("This is returned labOrgs: ".concat(JSON.stringify(labOrgs)));
                    labIdentifiers = labOrgs
                        .map(function (org) {
                        var _a;
                        var accountNumberIdentifier = (_a = org.identifier) === null || _a === void 0 ? void 0 : _a.find(function (id) { return id.system === utils_1.LAB_ACCOUNT_NUMBER_SYSTEM; });
                        if (!accountNumberIdentifier || !accountNumberIdentifier.value)
                            return undefined;
                        return __assign(__assign({}, accountNumberIdentifier), { assigner: { type: 'Organization', reference: "Organization/".concat(org.id) } });
                    })
                        .filter(function (labId) { return labId !== undefined; });
                    // for each location, figure out which identifiers are already present, grab a quick set difference and add them to the existing identifiers in a patch request
                    locations.forEach(function (loc) {
                        var _a;
                        var existingIdentifierAsStrings = new Set(((_a = loc.identifier) !== null && _a !== void 0 ? _a : []).map(function (id) { return makeIdentifierStringKey(id); }));
                        console.log("\n\nThese are the ".concat(loc.name, "'s existing identifiers as strings: ").concat(JSON.stringify(__spreadArray([], existingIdentifierAsStrings, true))));
                        var identifiersToAdd = [];
                        labIdentifiers.forEach(function (labId) {
                            if (!existingIdentifierAsStrings.has(makeIdentifierStringKey(labId)))
                                identifiersToAdd.push(labId);
                        });
                        if (identifiersToAdd.length) {
                            console.log("\n\nThese are the identifiers being added: ".concat(JSON.stringify(identifiersToAdd, undefined, 2)));
                            requests.push({
                                method: 'PATCH',
                                url: "Location/".concat(loc.id),
                                operations: [
                                    {
                                        op: loc.identifier ? 'replace' : 'add',
                                        path: '/identifier',
                                        value: loc.identifier ? __spreadArray(__spreadArray([], loc.identifier, true), identifiersToAdd, true) : identifiersToAdd,
                                    },
                                ],
                            });
                        }
                    });
                    console.log("\n\nThese are the ".concat(requests.length, " requests to make: ").concat(JSON.stringify(requests)));
                    console.log("\n\nMaking ".concat(requests.length, " patch requests across ").concat(locations.length, " locations to capture info from ").concat(labOrgs.length, " Lab Orgs"));
                    if (!requests.length) {
                        console.log('No requests to make. Exiting successfully.');
                        process.exit(0);
                    }
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: requests })];
                case 4:
                    results = _b.sent();
                    console.log("Successfully patched Locations! Results: ".concat(JSON.stringify(results)));
                    process.exit(0);
                    return [3 /*break*/, 6];
                case 5:
                    e_1 = _b.sent();
                    console.error('Encountered error patching Locations');
                    throw e_1;
                case 6: return [2 /*return*/];
            }
        });
    });
}
var getLocations = function (oystehrClient) {
    return oystehrClient.fhir.search({
        resourceType: 'Location',
        params: [
            {
                name: 'status',
                value: 'active',
            },
        ],
    });
};
var getLabOrgs = function (oystehrClient) {
    return oystehrClient.fhir.search({
        resourceType: 'Organization',
        params: [
            {
                name: 'identifier',
                value: "".concat(utils_1.OYSTEHR_LAB_GUID_SYSTEM, "|"),
            },
            {
                name: 'identifier',
                value: "".concat(utils_1.LAB_ACCOUNT_NUMBER_SYSTEM, "|"),
            },
        ],
    });
};
var makeIdentifierStringKey = function (id) {
    var _a;
    return "".concat(id.system, "|").concat(id.value, "|").concat((_a = id.assigner) === null || _a === void 0 ? void 0 : _a.reference);
};
