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
var csvtojson_1 = require("csvtojson");
var fs = require("fs");
var path_1 = require("path");
var utils_1 = require("utils");
var shared_1 = require("../shared");
var helpers_1 = require("./helpers");
var PayersFileColumns;
(function (PayersFileColumns) {
    PayersFileColumns["payerId"] = "Payer ID";
    PayersFileColumns["payerName"] = "Payer Name";
    PayersFileColumns["eligibility"] = "Eligibility";
    PayersFileColumns["era"] = "ERA";
    PayersFileColumns["payerType"] = "Payer Type";
})(PayersFileColumns || (PayersFileColumns = {}));
var CSV_FILE_PATH = path_1.default.join(__dirname, 'data', 'insurance-payers.csv');
var PAYER_ID_SYSTEM = 'payer-id';
function getOrganizationResourceFromDataRow(data, organization) {
    var payerIdKey = data[PayersFileColumns.payerId];
    var payerName = data[PayersFileColumns.payerName];
    var eligibilityPayerId = data[PayersFileColumns.payerId];
    var newOrganization = {
        resourceType: 'Organization',
        active: true,
        name: payerName,
        type: [
            {
                coding: [
                    {
                        system: "".concat(utils_1.ORG_TYPE_CODE_SYSTEM),
                        code: "".concat(utils_1.ORG_TYPE_PAYER_CODE),
                    },
                ],
            },
        ],
        identifier: [
            {
                type: {
                    coding: [{ system: PAYER_ID_SYSTEM, code: payerIdKey }],
                },
            },
            {
                type: {
                    coding: [{ code: 'XX', system: 'http://terminology.hl7.org/CodeSystem/v2-0203' }],
                },
                value: eligibilityPayerId,
            },
        ],
        extension: organization === null || organization === void 0 ? void 0 : organization.extension,
    };
    var extensionsToUpdate = [
        {
            url: "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/eligibility"),
            valueString: data[PayersFileColumns.eligibility],
        },
        { url: "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/era"), valueString: data[PayersFileColumns.era] },
        {
            url: "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/payer-type"),
            valueString: data[PayersFileColumns.payerType],
        },
    ];
    extensionsToUpdate.forEach(function (currentExtension) {
        if (!newOrganization.extension) {
            newOrganization.extension = [];
        }
        var existingExtIndex = newOrganization.extension.findIndex(function (ext) { return ext.url === currentExtension.url; });
        if (existingExtIndex >= 0) {
            if (!currentExtension.valueString) {
                newOrganization.extension = newOrganization.extension.splice(existingExtIndex, 1);
            }
            else
                newOrganization.extension[existingExtIndex] = currentExtension;
        }
        else if (currentExtension.valueString) {
            newOrganization.extension.push(currentExtension);
        }
    });
    return newOrganization;
}
function createOrganization(oystehr, data) {
    return __awaiter(this, void 0, void 0, function () {
        var organization;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.create(getOrganizationResourceFromDataRow(data))];
                case 1:
                    organization = _a.sent();
                    console.log("Created organization: ".concat(organization.id, "."));
                    return [2 /*return*/, organization];
            }
        });
    });
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function updateOrganization(oystehr, organization, data) {
    return __awaiter(this, void 0, void 0, function () {
        var updatedOrg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.update(__assign(__assign({}, getOrganizationResourceFromDataRow(data)), { resourceType: 'Organization', id: organization.id }))];
                case 1:
                    updatedOrg = _a.sent();
                    console.log("Updated organization: ".concat(organization.id, "."));
                    return [2 /*return*/, updatedOrg];
            }
        });
    });
}
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
function processCsv(filePath, oystehr, organizations) {
    return __awaiter(this, void 0, void 0, function () {
        var organizationMap, csvData, BATCH_SIZE, i, batch, promises;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    organizationMap = new Map(organizations.map(function (org) { return [(0, utils_1.getPayerId)(org), org]; }));
                    return [4 /*yield*/, (0, csvtojson_1.default)().fromFile(filePath)];
                case 1:
                    csvData = _a.sent();
                    BATCH_SIZE = 20;
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < csvData.length)) return [3 /*break*/, 5];
                    batch = csvData.slice(i, i + BATCH_SIZE);
                    promises = batch.map(function (data) { return __awaiter(_this, void 0, void 0, function () {
                        var payerIdKey, existingOrganization, newOrg, error_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 4, , 5]);
                                    payerIdKey = data[PayersFileColumns.payerId];
                                    if (!organizationMap.has(payerIdKey)) return [3 /*break*/, 1];
                                    existingOrganization = organizationMap.get(payerIdKey);
                                    if (existingOrganization) {
                                        /** ---------- not updating not to override existing resource changes -------- */
                                        // existingOrganization = await updateOrganization(oystehr, existingOrganization, data);
                                        organizationMap.set(payerIdKey, existingOrganization);
                                    }
                                    return [3 /*break*/, 3];
                                case 1: return [4 /*yield*/, createOrganization(oystehr, data)];
                                case 2:
                                    newOrg = _a.sent();
                                    if (newOrg) {
                                        organizationMap.set(payerIdKey, newOrg);
                                    }
                                    _a.label = 3;
                                case 3: return [3 /*break*/, 5];
                                case 4:
                                    error_1 = _a.sent();
                                    console.error("Error processing row: ".concat(JSON.stringify(error_1)), data);
                                    throw error_1;
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.allSettled(promises).then(function (results) {
                            results.forEach(function (result) {
                                if (result.status === 'rejected') {
                                    console.error("Error processing row: ".concat(JSON.stringify(result)));
                                }
                            });
                        })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    i += BATCH_SIZE;
                    return [3 /*break*/, 2];
                case 5:
                    console.log('CSV file successfully processed');
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
                        throw new Error('Failed to fetch auth token.');
                    }
                    oystehr = new sdk_1.default({
                        accessToken: token,
                        fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(secrets.AUTH0_AUDIENCE),
                    });
                    return [4 /*yield*/, getPayerOrganizations(oystehr)];
                case 2:
                    organizations = _a.sent();
                    return [4 /*yield*/, processCsv(CSV_FILE_PATH, oystehr, organizations)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return console.log('Completed processing CSV file'); })
    .catch(function (error) {
    console.error(error);
    throw error;
});
