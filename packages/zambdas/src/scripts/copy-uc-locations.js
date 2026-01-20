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
var crypto_1 = require("crypto");
var fs_1 = require("fs");
var utils_1 = require("utils");
var shared_1 = require("../shared");
var directorsAreSame = function (practitioner1, practitioner2) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    if (!practitioner1 || !practitioner2) {
        throw new Error('bad practitioner');
    }
    var id1 = (_b = (_a = practitioner1 === null || practitioner1 === void 0 ? void 0 : practitioner1.identifier) === null || _a === void 0 ? void 0 : _a.find(function (id) {
        return id.system === 'http://hl7.org.fhir/sid/us-npi' || id.system === 'http://hl7.org/fhir/sid/us-npi';
    })) === null || _b === void 0 ? void 0 : _b.value;
    var id2 = (_d = (_c = practitioner2 === null || practitioner2 === void 0 ? void 0 : practitioner2.identifier) === null || _c === void 0 ? void 0 : _c.find(function (id) {
        return id.system === 'http://hl7.org.fhir/sid/us-npi' || id.system === 'http://hl7.org/fhir/sid/us-npi';
    })) === null || _d === void 0 ? void 0 : _d.value;
    var firstName1 = (_g = (_f = (_e = practitioner1 === null || practitioner1 === void 0 ? void 0 : practitioner1.name) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.given) === null || _g === void 0 ? void 0 : _g[0];
    var firstName2 = (_k = (_j = (_h = practitioner2 === null || practitioner2 === void 0 ? void 0 : practitioner2.name) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.given) === null || _k === void 0 ? void 0 : _k[0];
    var lastName1 = (_m = (_l = practitioner1 === null || practitioner1 === void 0 ? void 0 : practitioner1.name) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.family;
    var lastName2 = (_p = (_o = practitioner2 === null || practitioner2 === void 0 ? void 0 : practitioner2.name) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.family;
    if (id1 === id2) {
        if (firstName1 !== firstName2 || lastName1 !== lastName2) {
            console.log('weird case', firstName1, firstName2);
            return false;
        }
        else {
            return true;
        }
    }
    else {
        return false;
    }
};
var getDirectorNPIUpdates = function (practitioner) {
    var _a, _b;
    var putRequests = [];
    var id1 = (_a = practitioner === null || practitioner === void 0 ? void 0 : practitioner.identifier) === null || _a === void 0 ? void 0 : _a.find(function (id) {
        return id.system === 'http://hl7.org.fhir/sid/us-npi';
    });
    if (id1) {
        var newIds = (_b = practitioner === null || practitioner === void 0 ? void 0 : practitioner.identifier) === null || _b === void 0 ? void 0 : _b.map(function (id) {
            if (id.system === 'http://hl7.org.fhir/sid/us-npi') {
                return __assign(__assign({}, id), { system: 'http://hl7.org/fhir/sid/us-npi' });
            }
            else {
                return id;
            }
        });
        putRequests.push({
            method: 'PUT',
            url: "Practitioner/".concat(practitioner.id),
            resource: __assign(__assign({}, practitioner), { identifier: newIds }),
        });
    }
    return putRequests;
};
var filterDirectorListForInclusion = function (listToFilter, sourceList) {
    return listToFilter.filter(function (practitioner) {
        return sourceList.some(function (sp) { return directorsAreSame(practitioner, sp); });
    });
};
var copyLocations = function (fromConfig_1, toConfig_1) {
    var args_1 = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        args_1[_i - 2] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([fromConfig_1, toConfig_1], args_1, true), void 0, function (fromConfig, toConfig, isDryRun) {
        var fromEnvToken, toEnvToken, sourceEnvOystehrClient, destinationEnvOystehrClient, locationsToCreate, locationsToUpdate, directorsToUpdate, rolesToUpdate, rolesToCreate, sourceRolesToUpdate, sourceRolesToCreate, fromEnvUCLocs, toEnvUCLocs_1, sourceDirectorRolesAndPractitioners, destinationDirectorRolesAndPractitioners, sourceDirectorRoles_1, sourceDirectors_1, destinationDirectorRoles_1, destinationDirectors_1, e_1;
        if (isDryRun === void 0) { isDryRun = true; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, shared_1.getAuth0Token)(fromConfig)];
                case 1:
                    fromEnvToken = _a.sent();
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(toConfig)];
                case 2:
                    toEnvToken = _a.sent();
                    if (!fromEnvToken || !toEnvToken) {
                        throw new Error('Failed to fetch auth token.');
                    }
                    sourceEnvOystehrClient = (0, shared_1.createOystehrClient)(fromEnvToken, fromConfig);
                    destinationEnvOystehrClient = (0, shared_1.createOystehrClient)(toEnvToken, toConfig);
                    locationsToCreate = [];
                    locationsToUpdate = [];
                    directorsToUpdate = [];
                    rolesToUpdate = [];
                    rolesToCreate = [];
                    sourceRolesToUpdate = [];
                    sourceRolesToCreate = [];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 12, , 13]);
                    return [4 /*yield*/, sourceEnvOystehrClient.fhir.search({
                            resourceType: 'Location',
                        })];
                case 4:
                    fromEnvUCLocs = (_a.sent())
                        .unbundle()
                        .filter(function (loc) {
                        var _a;
                        return !((_a = loc.extension) === null || _a === void 0 ? void 0 : _a.some(function (ext) {
                            var _a;
                            // filter out telemed locations
                            return ((_a = ext.valueCoding) === null || _a === void 0 ? void 0 : _a.code) === 'vi';
                        }));
                    });
                    return [4 /*yield*/, destinationEnvOystehrClient.fhir.search({
                            resourceType: 'Location',
                        })];
                case 5:
                    toEnvUCLocs_1 = (_a.sent())
                        .unbundle()
                        .filter(function (loc) {
                        var _a;
                        return !((_a = loc.extension) === null || _a === void 0 ? void 0 : _a.some(function (ext) {
                            var _a;
                            // filter out telemed locations
                            return ((_a = ext.valueCoding) === null || _a === void 0 ? void 0 : _a.code) === 'vi';
                        }));
                    });
                    return [4 /*yield*/, sourceEnvOystehrClient.fhir.search({
                            resourceType: 'PractitionerRole',
                            params: [
                                {
                                    name: 'identifier',
                                    value: "".concat(utils_1.FHIR_BASE_URL, "/r4/practitioner-role|ip-medical-director"),
                                },
                                {
                                    name: 'location.identifier',
                                    value: "".concat(utils_1.FHIR_BASE_URL, "/r4/facility-name|"),
                                },
                                {
                                    name: '_include',
                                    value: 'PractitionerRole:practitioner',
                                },
                            ],
                        })];
                case 6:
                    sourceDirectorRolesAndPractitioners = (_a.sent()).unbundle();
                    return [4 /*yield*/, destinationEnvOystehrClient.fhir.search({
                            resourceType: 'PractitionerRole',
                            params: [
                                {
                                    name: 'identifier',
                                    value: "".concat(utils_1.FHIR_BASE_URL, "/r4/practitioner-role|ip-medical-director"),
                                },
                                {
                                    name: 'location.identifier',
                                    value: "".concat(utils_1.FHIR_BASE_URL, "/r4/facility-name|"),
                                },
                                {
                                    name: '_include',
                                    value: 'PractitionerRole:practitioner',
                                },
                            ],
                        })];
                case 7:
                    destinationDirectorRolesAndPractitioners = (_a.sent()).unbundle();
                    sourceDirectorRoles_1 = sourceDirectorRolesAndPractitioners.filter(function (res) { return res.resourceType === 'PractitionerRole'; });
                    sourceDirectors_1 = sourceDirectorRolesAndPractitioners.filter(function (res) { return res.resourceType === 'Practitioner'; });
                    destinationDirectorRoles_1 = destinationDirectorRolesAndPractitioners.filter(function (res) { return res.resourceType === 'PractitionerRole'; });
                    destinationDirectors_1 = destinationDirectorRolesAndPractitioners.filter(function (res) { return res.resourceType === 'Practitioner'; });
                    destinationDirectors_1 = filterDirectorListForInclusion(destinationDirectors_1, sourceDirectors_1);
                    console.log('from env IP Locs', fromEnvUCLocs.length);
                    console.log('to env IP Locs', toEnvUCLocs_1.length);
                    console.log('from env director roles', sourceDirectorRoles_1.length);
                    console.log('to env director roles', destinationDirectorRoles_1.length);
                    console.log('from env directors', sourceDirectors_1.length);
                    console.log('to env directors', destinationDirectors_1.length);
                    fromEnvUCLocs.forEach(function (sourceLoc) { return __awaiter(void 0, void 0, void 0, function () {
                        var sourceDirectorRole, sourceDirector, targetLoc, destDirectorRole_1, destDirector_1, practitionerToUse, alreadyAdded, fullUrl, practitionerToUse_1, randomIdx, sourceDir, randomIdx, sourceDir;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    sourceDirectorRole = sourceDirectorRoles_1.find(function (role) { var _a, _b; return ((_b = (_a = role.location) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference) === "Location/".concat(sourceLoc.id); });
                                    sourceDirector = sourceDirectors_1.find(function (dir) { var _a; return ((_a = sourceDirectorRole === null || sourceDirectorRole === void 0 ? void 0 : sourceDirectorRole.practitioner) === null || _a === void 0 ? void 0 : _a.reference) === "Practitioner/".concat(dir.id); });
                                    targetLoc = toEnvUCLocs_1.find(function (loc) {
                                        var _a, _b, _c;
                                        return loc.name === sourceLoc.name && ((_a = loc.address) === null || _a === void 0 ? void 0 : _a.state) && ((_b = loc.address) === null || _b === void 0 ? void 0 : _b.state) === ((_c = sourceLoc === null || sourceLoc === void 0 ? void 0 : sourceLoc.address) === null || _c === void 0 ? void 0 : _c.state);
                                    });
                                    if (!targetLoc) return [3 /*break*/, 3];
                                    locationsToUpdate.push({
                                        resource: __assign(__assign({}, targetLoc), { extension: sourceLoc.extension }),
                                        method: 'PUT',
                                        url: "Location/".concat(targetLoc.id),
                                    });
                                    destDirectorRole_1 = destinationDirectorRoles_1.find(function (role) { var _a, _b; return ((_b = (_a = role.location) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference) === "Location/".concat(targetLoc.id); });
                                    if (!!destDirectorRole_1) return [3 /*break*/, 2];
                                    return [4 /*yield*/, destinationEnvOystehrClient.fhir.create({
                                            resourceType: 'PractitionerRole',
                                            location: [
                                                {
                                                    reference: "Location/".concat(targetLoc.id),
                                                },
                                            ],
                                        })];
                                case 1:
                                    destDirectorRole_1 = _a.sent();
                                    _a.label = 2;
                                case 2:
                                    if (!destDirectorRole_1) {
                                        console.log('dest director role missing', targetLoc.name);
                                        throw new Error('director role missing');
                                    }
                                    destDirector_1 = destinationDirectors_1.find(function (dir) { var _a; return ((_a = destDirectorRole_1 === null || destDirectorRole_1 === void 0 ? void 0 : destDirectorRole_1.practitioner) === null || _a === void 0 ? void 0 : _a.reference) === "Practitioner/".concat(dir.id); });
                                    if (!sourceDirector || !destDirector_1) {
                                        if (!sourceDirector) {
                                            console.log("source director missing for ".concat(sourceLoc.name, " - skipping"));
                                        }
                                        else {
                                            practitionerToUse = destinationDirectors_1.find(function (dd) { return directorsAreSame(dd, sourceDirector); });
                                            console.log('linking practitioner to role for ', targetLoc.name);
                                            rolesToUpdate.push({
                                                method: 'PUT',
                                                url: "PractitionerRole/".concat(destDirectorRole_1.id),
                                                resource: __assign(__assign({}, destDirectorRole_1), { practitioner: { reference: "Practitioner/".concat(practitionerToUse === null || practitionerToUse === void 0 ? void 0 : practitionerToUse.id) } }),
                                            });
                                        }
                                    }
                                    else {
                                        if (directorsAreSame(sourceDirector, destDirector_1)) {
                                            console.log('directors same, no update needed');
                                            alreadyAdded = directorsToUpdate.some(function (update) {
                                                return update.resource.id === destDirector_1.id;
                                            });
                                            if (!alreadyAdded) {
                                                directorsToUpdate.push.apply(directorsToUpdate, getDirectorNPIUpdates(destDirector_1));
                                            }
                                        }
                                        else {
                                            // no cases of this observed...
                                            console.log('directors different, update needed', targetLoc.name);
                                        }
                                    }
                                    return [3 /*break*/, 4];
                                case 3:
                                    fullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                                    locationsToCreate.push({
                                        method: 'POST',
                                        url: 'Location',
                                        fullUrl: fullUrl,
                                        resource: __assign(__assign({}, sourceLoc), { id: undefined }),
                                    });
                                    if (sourceDirector) {
                                        practitionerToUse_1 = destinationDirectors_1.find(function (dd) { return directorsAreSame(dd, sourceDirector); });
                                    }
                                    else if (sourceDirectorRole) {
                                        randomIdx = Math.round(Math.random() * 100) % destinationDirectors_1.length;
                                        console.log('randomIdx', randomIdx);
                                        practitionerToUse_1 = destinationDirectors_1[randomIdx];
                                        sourceDir = sourceDirectors_1.find(function (dir) { return directorsAreSame(dir, practitionerToUse_1); });
                                        sourceRolesToUpdate.push({
                                            method: 'PUT',
                                            url: "PractitionerRole/".concat(sourceDirectorRole === null || sourceDirectorRole === void 0 ? void 0 : sourceDirectorRole.id),
                                            resource: __assign(__assign({}, (sourceDirectorRole !== null && sourceDirectorRole !== void 0 ? sourceDirectorRole : {})), { practitioner: { reference: "Practitioner/".concat(sourceDir === null || sourceDir === void 0 ? void 0 : sourceDir.id) } }),
                                        });
                                    }
                                    else {
                                        console.log('source director role missing', sourceLoc.name);
                                        randomIdx = Math.round(Math.random() * 100) % destinationDirectors_1.length;
                                        practitionerToUse_1 = destinationDirectors_1[randomIdx];
                                        sourceDir = sourceDirectorRoles_1[randomIdx];
                                        sourceRolesToCreate.push({
                                            resource: {
                                                resourceType: 'PractitionerRole',
                                                location: [
                                                    {
                                                        reference: "Location/".concat(sourceLoc.id),
                                                    },
                                                ],
                                                practitioner: { reference: "Practitioner/".concat(sourceDir.id) },
                                            },
                                            method: 'POST',
                                            url: 'PractitionerRole',
                                        });
                                    }
                                    rolesToCreate.push({
                                        method: 'POST',
                                        url: 'PractitionerRole',
                                        resource: {
                                            resourceType: 'PractitionerRole',
                                            location: [{ reference: fullUrl }],
                                            practitioner: { reference: "Practitioner/".concat(practitionerToUse_1 === null || practitionerToUse_1 === void 0 ? void 0 : practitionerToUse_1.id) },
                                        },
                                    });
                                    _a.label = 4;
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    if (!isDryRun) return [3 /*break*/, 8];
                    console.log('locations to create', locationsToCreate.length);
                    console.log('locations to update', locationsToUpdate.length);
                    console.log('roles to create', rolesToCreate.length);
                    console.log('roles to update', rolesToUpdate.length);
                    console.log('directors to update', directorsToUpdate.length);
                    console.log('source director roles to update', sourceRolesToUpdate.length);
                    console.log('source director roles to create', sourceRolesToCreate.length);
                    return [3 /*break*/, 11];
                case 8: return [4 /*yield*/, destinationEnvOystehrClient.fhir.transaction({
                        requests: __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], locationsToCreate, true), locationsToUpdate, true), directorsToUpdate, true), rolesToCreate, true), rolesToUpdate, true),
                    })];
                case 9:
                    _a.sent();
                    console.log('successfully updated/created destination locations');
                    return [4 /*yield*/, sourceEnvOystehrClient.fhir.transaction({ requests: __spreadArray(__spreadArray([], sourceRolesToUpdate, true), sourceRolesToCreate, true) })];
                case 10:
                    _a.sent();
                    console.log('successfully updated source roles');
                    _a.label = 11;
                case 11: return [3 /*break*/, 13];
                case 12:
                    e_1 = _a.sent();
                    console.log('copy loc failed: ', JSON.stringify(e_1));
                    return [3 /*break*/, 13];
                case 13: return [2 /*return*/];
            }
        });
    });
};
// So we can use await
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var fromEnv, toEnv, dryRun, fromSecrets, toSecrets, isDryRun;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                fromEnv = (_a = process.argv[2]) !== null && _a !== void 0 ? _a : 'staging';
                toEnv = (_b = process.argv[3]) !== null && _b !== void 0 ? _b : 'testing';
                dryRun = (_c = process.argv[4]) !== null && _c !== void 0 ? _c : 'false';
                fromSecrets = JSON.parse(fs_1.default.readFileSync(".env/".concat(fromEnv, ".json"), 'utf8'));
                toSecrets = JSON.parse(fs_1.default.readFileSync(".env/".concat(toEnv, ".json"), 'utf8'));
                isDryRun = dryRun === 'dry';
                return [4 /*yield*/, copyLocations(fromSecrets, toSecrets, isDryRun)];
            case 1:
                _d.sent();
                return [2 /*return*/];
        }
    });
}); };
main().catch(function (error) {
    console.log('error', error);
    throw error;
});
