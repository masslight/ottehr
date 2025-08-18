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
exports.useEditClaimInformationMutation = exports.useEditRelatedPersonInformationMutation = exports.useEditCoverageInformationMutation = exports.useGetFacilities = exports.useGetOrganizations = exports.useGetInsurancePlans = exports.useGetClaim = void 0;
var react_query_1 = require("react-query");
var utils_1 = require("utils");
var useAppClients_1 = require("../../../hooks/useAppClients");
var utils_2 = require("../../utils");
var useGetClaim = function (_a, onSuccess) {
    var claimId = _a.claimId;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['rcm-claim', claimId], function () { return __awaiter(void 0, void 0, void 0, function () {
        var resources, claim, coverageReference, coverageResourcesPromise, additionalCoverageReference, additionalCoverageResourcesPromise, _a, _b, _c, _d, _e, _f;
        var _g, _h, _j, _k, _l, _m;
        return __generator(this, function (_o) {
            switch (_o.label) {
                case 0:
                    if (!(oystehr && claimId)) return [3 /*break*/, 4];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Claim',
                            params: [
                                { name: '_id', value: claimId },
                                {
                                    name: '_include',
                                    value: 'Claim:patient',
                                },
                                {
                                    name: '_include',
                                    value: 'Claim:encounter',
                                },
                                {
                                    name: '_include:iterate',
                                    value: 'Encounter:appointment',
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'DocumentReference:encounter',
                                },
                            ],
                        })];
                case 1:
                    resources = (_o.sent()).unbundle();
                    claim = (0, utils_2.findResourceByType)(resources, 'Claim');
                    coverageReference = (_j = (_h = (_g = claim === null || claim === void 0 ? void 0 : claim.insurance) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.coverage) === null || _j === void 0 ? void 0 : _j.reference;
                    coverageResourcesPromise = (0, utils_2.getCoverageRelatedResources)(oystehr, coverageReference);
                    additionalCoverageReference = (_m = (_l = (_k = claim === null || claim === void 0 ? void 0 : claim.insurance) === null || _k === void 0 ? void 0 : _k[1]) === null || _l === void 0 ? void 0 : _l.coverage) === null || _m === void 0 ? void 0 : _m.reference;
                    additionalCoverageResourcesPromise = (0, utils_2.getCoverageRelatedResources)(oystehr, additionalCoverageReference);
                    _b = (_a = resources.push).apply;
                    _c = [resources];
                    return [4 /*yield*/, coverageResourcesPromise];
                case 2:
                    _b.apply(_a, _c.concat([(_o.sent())]));
                    _e = (_d = resources.push).apply;
                    _f = [resources];
                    return [4 /*yield*/, additionalCoverageResourcesPromise];
                case 3:
                    _e.apply(_d, _f.concat([(_o.sent())]));
                    return [2 /*return*/, resources];
                case 4: throw new Error('fhir client not defined or claimId not provided');
            }
        });
    }); }, {
        onSuccess: onSuccess,
        onError: function (err) {
            console.error('Error during fetching get claim: ', err);
        },
    });
};
exports.useGetClaim = useGetClaim;
var useGetInsurancePlans = function (onSuccess) {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['rcm-insurance-plans'], function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr) return [3 /*break*/, 2];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'InsurancePlan',
                            params: [
                                {
                                    name: '_tag',
                                    value: utils_1.INSURANCE_PLAN_PAYER_META_TAG_CODE,
                                },
                                {
                                    name: 'status',
                                    value: 'active',
                                },
                            ],
                        })];
                case 1: return [2 /*return*/, (_a.sent()).unbundle()];
                case 2: throw new Error('fhir client not defined');
            }
        });
    }); }, {
        onSuccess: onSuccess,
        onError: function (err) {
            console.error('Error during fetching get insurance plans: ', err);
        },
    });
};
exports.useGetInsurancePlans = useGetInsurancePlans;
var useGetOrganizations = function (onSuccess) {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['rcm-organizations'], function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr) return [3 /*break*/, 2];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Organization',
                        })];
                case 1: return [2 /*return*/, (_a.sent()).unbundle()];
                case 2: throw new Error('fhir client not defined');
            }
        });
    }); }, {
        onSuccess: onSuccess,
        onError: function (err) {
            console.error('Error during fetching get organizations: ', err);
        },
    });
};
exports.useGetOrganizations = useGetOrganizations;
var useGetFacilities = function (onSuccess) {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['rcm-facilities'], function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr) return [3 /*break*/, 2];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Location',
                        })];
                case 1: return [2 /*return*/, (_a.sent()).unbundle()];
                case 2: throw new Error('fhir client not defined');
            }
        });
    }); }, {
        onSuccess: onSuccess,
        onError: function (err) {
            console.error('Error during fetching get facilities: ', err);
        },
    });
};
exports.useGetFacilities = useGetFacilities;
var useEditCoverageInformationMutation = function () {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useMutation)({
        mutationFn: function (_a) {
            var _b;
            var coverageData = _a.coverageData, previousCoverageData = _a.previousCoverageData, fieldsToUpdate = _a.fieldsToUpdate;
            if (!oystehr) {
                throw new Error('Oystehr not found');
            }
            if (!fieldsToUpdate || fieldsToUpdate.length === 0) {
                fieldsToUpdate = ['relationship'];
            }
            var fieldsSet = __spreadArray([], new Set(fieldsToUpdate), true);
            var operations = fieldsSet
                .filter(function (field) { return coverageData[field] !== undefined || previousCoverageData[field] !== undefined; })
                .map(function (field) { return ({
                op: (0, utils_2.generateOpByResourceData)(coverageData, previousCoverageData, field),
                path: "/".concat(field),
                value: coverageData[field],
            }); });
            if (operations.length === 0) {
                return Promise.resolve(coverageData);
            }
            return oystehr.fhir.patch({
                resourceType: 'Coverage',
                id: (_b = coverageData.id) !== null && _b !== void 0 ? _b : '',
                operations: operations,
            });
        },
        onError: function (err) {
            console.error('Error during editing coverage information: ', err);
        },
    });
};
exports.useEditCoverageInformationMutation = useEditCoverageInformationMutation;
var useEditRelatedPersonInformationMutation = function () {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useMutation)({
        mutationFn: function (_a) {
            var _b;
            var relatedPersonData = _a.relatedPersonData, previousRelatedPersonData = _a.previousRelatedPersonData, fieldsToUpdate = _a.fieldsToUpdate;
            if (!oystehr) {
                throw new Error('Oystehr not found');
            }
            if (!fieldsToUpdate || fieldsToUpdate.length === 0) {
                fieldsToUpdate = ['address', 'birthDate', 'gender', 'name'];
            }
            var fieldsSet = __spreadArray([], new Set(fieldsToUpdate), true);
            return oystehr.fhir.patch({
                resourceType: 'RelatedPerson',
                id: (_b = relatedPersonData.id) !== null && _b !== void 0 ? _b : '',
                operations: fieldsSet
                    .filter(function (field) { return relatedPersonData[field] !== undefined || previousRelatedPersonData[field] !== undefined; })
                    .map(function (field) { return ({
                    op: (0, utils_2.generateOpByResourceData)(relatedPersonData, previousRelatedPersonData, field),
                    path: "/".concat(field),
                    value: relatedPersonData[field],
                }); }),
            });
        },
        onError: function (err) {
            console.error('Error during editing related person information: ', err);
        },
    });
};
exports.useEditRelatedPersonInformationMutation = useEditRelatedPersonInformationMutation;
var useEditClaimInformationMutation = function () {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useMutation)({
        mutationFn: function (_a) {
            var _b;
            var claimData = _a.claimData, previousClaimData = _a.previousClaimData, fieldsToUpdate = _a.fieldsToUpdate;
            if (!oystehr) {
                throw new Error('Oystehr not found');
            }
            if (!fieldsToUpdate || fieldsToUpdate.length === 0) {
                fieldsToUpdate = ['accident', 'extension', 'supportingInfo', 'related', 'insurance'];
            }
            var fieldsSet = __spreadArray([], new Set(fieldsToUpdate), true);
            return oystehr.fhir.patch({
                resourceType: 'Claim',
                id: (_b = claimData.id) !== null && _b !== void 0 ? _b : '',
                operations: fieldsSet
                    .filter(function (field) { return claimData[field] !== undefined || previousClaimData[field] !== undefined; })
                    .map(function (field) { return ({
                    op: (0, utils_2.generateOpByResourceData)(claimData, previousClaimData, field),
                    path: "/".concat(field),
                    value: claimData[field],
                }); }),
            });
        },
        onError: function (err) {
            console.error('Error during editing claim information: ', err);
        },
    });
};
exports.useEditClaimInformationMutation = useEditClaimInformationMutation;
//# sourceMappingURL=claim.queries.js.map