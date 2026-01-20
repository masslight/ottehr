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
var sdk_1 = require("@oystehr/sdk");
var fs = require("fs");
var utils_1 = require("utils");
var shared_1 = require("../shared");
var helpers_1 = require("./helpers");
var PAYER_ID_SYSTEM = 'payer-id';
function getPayerOrganizations(oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var currentIndex, total, result, bundledResponse, unbundled;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    currentIndex = 0;
                    total = 1;
                    result = [];
                    _a.label = 1;
                case 1:
                    if (!(currentIndex < total)) return [3 /*break*/, 3];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Organization',
                            params: [
                                {
                                    name: 'type',
                                    value: "".concat(utils_1.ORG_TYPE_CODE_SYSTEM, "|").concat(utils_1.ORG_TYPE_PAYER_CODE),
                                },
                                {
                                    name: '_offset',
                                    value: currentIndex,
                                },
                                {
                                    name: '_count',
                                    value: 1000,
                                },
                                {
                                    name: '_total',
                                    value: 'accurate',
                                },
                            ],
                        })];
                case 2:
                    bundledResponse = _a.sent();
                    total = bundledResponse.total || 0;
                    unbundled = bundledResponse.unbundle();
                    result.push.apply(result, unbundled);
                    currentIndex += unbundled.length;
                    return [3 /*break*/, 1];
                case 3:
                    console.log('Found', result.length, 'organizations');
                    return [2 /*return*/, result];
            }
        });
    });
}
function fixOrganizations(oystehr, organizations) {
    return __awaiter(this, void 0, void 0, function () {
        var fixedCount, payerIdFixCount, eligibilityPayerIdFixCount, i, organization, payerIdIdentifier, payerIdKey, eligibilityPayerIdIdentifier, eligibilityPayerIdKey, needsUpdate, originalPayerIdKey, originalEligibilityPayerIdKey, updatedOrganization, payerIdIndex, codingIndex, eligibilityIdIndex, error_1;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    console.log("Processing ".concat(organizations.length, " organizations..."));
                    fixedCount = 0;
                    payerIdFixCount = 0;
                    eligibilityPayerIdFixCount = 0;
                    i = 0;
                    _g.label = 1;
                case 1:
                    if (!(i < organizations.length)) return [3 /*break*/, 7];
                    organization = organizations[i];
                    _g.label = 2;
                case 2:
                    _g.trys.push([2, 5, , 6]);
                    console.log("Processing organization ".concat(i + 1, "/").concat(organizations.length, ": ").concat(organization.id));
                    payerIdIdentifier = (_a = organization.identifier) === null || _a === void 0 ? void 0 : _a.find(function (id) { var _a, _b; return (_b = (_a = id.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.system === PAYER_ID_SYSTEM; }); });
                    payerIdKey = (_d = (_c = (_b = payerIdIdentifier === null || payerIdIdentifier === void 0 ? void 0 : payerIdIdentifier.type) === null || _b === void 0 ? void 0 : _b.coding) === null || _c === void 0 ? void 0 : _c.find(function (coding) { return coding.system === PAYER_ID_SYSTEM; })) === null || _d === void 0 ? void 0 : _d.code;
                    eligibilityPayerIdIdentifier = (_e = organization.identifier) === null || _e === void 0 ? void 0 : _e.find(function (id) {
                        var _a, _b;
                        return (_b = (_a = id.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.code === 'XX' && coding.system === 'http://terminology.hl7.org/CodeSystem/v2-0203'; });
                    });
                    eligibilityPayerIdKey = eligibilityPayerIdIdentifier === null || eligibilityPayerIdIdentifier === void 0 ? void 0 : eligibilityPayerIdIdentifier.value;
                    needsUpdate = false;
                    // Fix payerIdKey if it's purely numeric and not 5 characters
                    if (payerIdKey && /^\d+$/.test(payerIdKey) && payerIdKey.length !== 5) {
                        originalPayerIdKey = payerIdKey;
                        payerIdKey = payerIdKey.padStart(5, '0');
                        console.log("  - Fixed payerIdKey: ".concat(originalPayerIdKey, " -> ").concat(payerIdKey));
                        needsUpdate = true;
                        payerIdFixCount++;
                    }
                    // Fix eligibilityPayerIdKey if it's purely numeric and not 5 characters
                    if (eligibilityPayerIdKey && /^\d+$/.test(eligibilityPayerIdKey) && eligibilityPayerIdKey.length !== 5) {
                        originalEligibilityPayerIdKey = eligibilityPayerIdKey;
                        eligibilityPayerIdKey = eligibilityPayerIdKey.padStart(5, '0');
                        console.log("  - Fixed eligibilityPayerIdKey: ".concat(originalEligibilityPayerIdKey, " -> ").concat(eligibilityPayerIdKey));
                        needsUpdate = true;
                        eligibilityPayerIdFixCount++;
                    }
                    if (!needsUpdate) return [3 /*break*/, 4];
                    updatedOrganization = __assign({}, organization);
                    // Update payerIdKey in the organization
                    if (payerIdIdentifier && updatedOrganization.identifier) {
                        payerIdIndex = updatedOrganization.identifier.findIndex(function (id) { var _a, _b; return (_b = (_a = id.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.system === PAYER_ID_SYSTEM; }); });
                        if (payerIdIndex !== -1 && ((_f = updatedOrganization.identifier[payerIdIndex].type) === null || _f === void 0 ? void 0 : _f.coding)) {
                            codingIndex = updatedOrganization.identifier[payerIdIndex].type.coding.findIndex(function (coding) { return coding.system === PAYER_ID_SYSTEM; });
                            if (codingIndex !== -1) {
                                updatedOrganization.identifier[payerIdIndex].type.coding[codingIndex].code = payerIdKey;
                            }
                        }
                    }
                    // Update eligibilityPayerIdKey in the organization
                    if (eligibilityPayerIdIdentifier && updatedOrganization.identifier) {
                        eligibilityIdIndex = updatedOrganization.identifier.findIndex(function (id) {
                            var _a, _b;
                            return (_b = (_a = id.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.code === 'XX' && coding.system === 'http://terminology.hl7.org/CodeSystem/v2-0203'; });
                        });
                        if (eligibilityIdIndex !== -1) {
                            updatedOrganization.identifier[eligibilityIdIndex].value = eligibilityPayerIdKey;
                        }
                    }
                    return [4 /*yield*/, oystehr.fhir.update(updatedOrganization)];
                case 3:
                    _g.sent();
                    console.log("  - Updated organization ".concat(organization.id));
                    fixedCount++;
                    _g.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_1 = _g.sent();
                    console.error("\u274C Error processing organization ".concat(organization.id, ":"), error_1);
                    return [3 /*break*/, 6];
                case 6:
                    i++;
                    return [3 /*break*/, 1];
                case 7:
                    console.log('Finished processing all organizations');
                    console.log("\uD83D\uDCCA Summary:");
                    console.log("  - Total organizations processed: ".concat(organizations.length));
                    console.log("  - Organizations updated: ".concat(fixedCount));
                    console.log("  - PayerIdKey fixes: ".concat(payerIdFixCount));
                    console.log("  - EligibilityPayerIdKey fixes: ".concat(eligibilityPayerIdFixCount));
                    return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var env, secrets, token, oystehr, organizations;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    env = process.argv[2];
                    secrets = JSON.parse(fs.readFileSync(".env/".concat(env, ".json"), 'utf8'));
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
                case 1:
                    token = _a.sent();
                    if (!token) {
                        throw new Error('❌ Failed to fetch auth token.');
                    }
                    oystehr = new sdk_1.default({
                        accessToken: token,
                        fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(secrets.AUTH0_AUDIENCE),
                    });
                    return [4 /*yield*/, getPayerOrganizations(oystehr)];
                case 2:
                    organizations = _a.sent();
                    return [4 /*yield*/, fixOrganizations(oystehr, organizations)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return console.log('✅ Completed fixing payer IDs in organizations'); })
    .catch(function (error) {
    console.error(error);
    throw error;
});
