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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPractitionersBatch = getPractitionersBatch;
var sdk_1 = require("@oystehr/sdk");
var utils_1 = require("utils");
var utils_2 = require("utils");
var shared_1 = require("../shared");
var helpers_1 = require("./helpers");
var BATCH_SIZE = 25;
var initializeOystehr = function (config) { return __awaiter(void 0, void 0, void 0, function () {
    var token;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, shared_1.getAuth0Token)(config)];
            case 1:
                token = _a.sent();
                if (!token)
                    throw new Error('Failed to fetch auth token.');
                return [2 /*return*/, new sdk_1.default({
                        fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(config.AUTH0_AUDIENCE),
                        accessToken: token,
                    })];
        }
    });
}); };
function getPractitionersBatch(oystehr, offset, count) {
    return __awaiter(this, void 0, void 0, function () {
        var resources, practitioners;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Practitioner',
                        params: [
                            { name: '_count', value: "".concat(count) },
                            { name: '_offset', value: "".concat(offset) },
                        ],
                    })];
                case 1:
                    resources = (_b.sent()).unbundle();
                    practitioners = (_a = resources === null || resources === void 0 ? void 0 : resources.filter(function (r) { return r.resourceType === 'Practitioner'; }).map(function (p) { return p; })) !== null && _a !== void 0 ? _a : [];
                    return [2 /*return*/, practitioners];
            }
        });
    });
}
var extractSuffixFromPractitioner = function (pr) {
    var _a, _b;
    var names = (_a = pr.name) !== null && _a !== void 0 ? _a : [];
    if (names.length === 0)
        return undefined;
    var suffixArr = (_b = names[0].suffix) !== null && _b !== void 0 ? _b : [];
    if (suffixArr.length > 0)
        return suffixArr[0];
    return undefined;
};
var normalizeSuffix = function (s) { return s.replace(/\./g, '').trim().toUpperCase(); };
var processPractitioners = function (practitioners) { return __awaiter(void 0, void 0, void 0, function () {
    var patchRequests, _i, practitioners_1, pr, rawSuffix, normalized, providerType, providerTypeText, newExtArr, newExt, existingExt, patchOperations;
    var _a;
    return __generator(this, function (_b) {
        patchRequests = [];
        for (_i = 0, practitioners_1 = practitioners; _i < practitioners_1.length; _i++) {
            pr = practitioners_1[_i];
            if (!pr.id) {
                console.warn('Practitioner without id encountered, skipping.', pr);
                continue;
            }
            rawSuffix = extractSuffixFromPractitioner(pr);
            if (!rawSuffix) {
                continue;
            }
            normalized = normalizeSuffix(rawSuffix);
            providerType = utils_2.PROVIDER_TYPE_VALUES.includes(normalized)
                ? normalized
                : 'other';
            providerTypeText = providerType === 'other' ? rawSuffix : providerType;
            newExtArr = (0, utils_2.makeProviderTypeExtension)(providerType, providerTypeText);
            if (!newExtArr || newExtArr.length === 0) {
                console.warn("makeProviderTypeExtension returned empty for Practitioner/".concat(pr.id, " suffix=\"").concat(rawSuffix, "\""));
                continue;
            }
            newExt = newExtArr[0];
            existingExt = ((_a = pr.extension) !== null && _a !== void 0 ? _a : []).find(function (e) { return e.url === utils_2.PROVIDER_TYPE_EXTENSION_URL; });
            if (existingExt) {
                continue;
            }
            patchOperations = [];
            if (pr.extension && pr.extension.length > 0) {
                patchOperations.push({
                    op: 'add',
                    path: '/extension/-',
                    value: newExt,
                });
            }
            else {
                patchOperations.push({
                    op: 'add',
                    path: '/extension',
                    value: [newExt],
                });
            }
            patchRequests.push((0, utils_1.getPatchBinary)({
                resourceType: 'Practitioner',
                resourceId: pr.id,
                patchOperations: patchOperations,
            }));
            console.log("Prepared patch to add provider-type extension for Practitioner/".concat(pr.id, " (suffix=\"").concat(rawSuffix, "\", providerType=\"").concat(providerType, "\")"));
        }
        return [2 /*return*/, patchRequests];
    });
}); };
var updatePractitionersProviderType = function (config, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var client, _a, offset, batchLength, totalPractitioners, totalPatched, practitioners, patchRequests, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = oystehr;
                if (_a) return [3 /*break*/, 2];
                return [4 /*yield*/, initializeOystehr(config)];
            case 1:
                _a = (_b.sent());
                _b.label = 2;
            case 2:
                client = _a;
                console.log('Starting Practitioner provider-type extension update...');
                offset = 0;
                batchLength = -1;
                totalPractitioners = 0;
                totalPatched = 0;
                _b.label = 3;
            case 3:
                if (!(batchLength !== 0)) return [3 /*break*/, 10];
                console.log("Fetching practitioners batch starting at offset: ".concat(offset));
                return [4 /*yield*/, getPractitionersBatch(client, offset, BATCH_SIZE)];
            case 4:
                practitioners = _b.sent();
                batchLength = practitioners.length;
                totalPractitioners += batchLength;
                if (!(batchLength > 0)) return [3 /*break*/, 9];
                console.log("Processing ".concat(practitioners.length, " practitioners..."));
                return [4 /*yield*/, processPractitioners(practitioners)];
            case 5:
                patchRequests = _b.sent();
                totalPatched += patchRequests.length;
                if (!(patchRequests.length > 0)) return [3 /*break*/, 9];
                console.log("Applying ".concat(patchRequests.length, " patch requests (batch offset ").concat(offset, ")..."));
                _b.label = 6;
            case 6:
                _b.trys.push([6, 8, , 9]);
                return [4 /*yield*/, client.fhir.batch({
                        requests: patchRequests,
                    })];
            case 7:
                _b.sent();
                return [3 /*break*/, 9];
            case 8:
                error_1 = _b.sent();
                console.error("Error during practitioner batch patch at offset ".concat(offset, ":"), JSON.stringify(error_1));
                throw new Error("Error during practitioner batch patch at offset ".concat(offset));
            case 9:
                offset += BATCH_SIZE;
                return [3 /*break*/, 3];
            case 10:
                console.log("[COMPLETE] Practitioner update summary:\n    - Total practitioners processed: ".concat(totalPractitioners, "\n    - Total practitioners patched (extensions added): ").concat(totalPatched));
                return [2 /*return*/];
        }
    });
}); };
var setupPractitionerUpdate = function (config) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, updatePractitionersProviderType(config)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var e_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, (0, helpers_1.performEffectWithEnvFile)(setupPractitionerUpdate)];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                e_1 = _a.sent();
                console.log('Catch some error while running practitioner update: ', e_1);
                console.log('Stringifies: ', JSON.stringify(e_1));
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
main().catch(function (error) {
    console.log('error', error);
    throw error;
});
