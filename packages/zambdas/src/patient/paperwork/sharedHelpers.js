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
exports.createOrUpdateFlags = createOrUpdateFlags;
var utils_1 = require("utils");
function createOrUpdateFlags(flagName, existingFlags, patientID, encounterID, timestamp, oystehr, user) {
    return __awaiter(this, void 0, void 0, function () {
        var metaTags, formattedUserNumber, paperworkStartedBy, createdByTag, flag, requests_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!(!existingFlags || !existingFlags.length)) return [3 /*break*/, 2];
                    metaTags = [{ code: flagName }];
                    formattedUserNumber = void 0;
                    paperworkStartedBy = void 0;
                    createdByTag = void 0;
                    if (user) {
                        formattedUserNumber = (0, utils_1.formatPhoneNumberDisplay)(((_a = user === null || user === void 0 ? void 0 : user.name) === null || _a === void 0 ? void 0 : _a.replace('+1', '')) || '');
                        paperworkStartedBy = "Patient".concat(formattedUserNumber ? " ".concat(formattedUserNumber) : '');
                    }
                    if (formattedUserNumber && paperworkStartedBy) {
                        createdByTag = { system: 'created-date-time', display: paperworkStartedBy, version: timestamp };
                        metaTags.push(createdByTag);
                    }
                    return [4 /*yield*/, oystehr.fhir.create({
                            resourceType: 'Flag',
                            status: 'active',
                            code: {
                                coding: [
                                    {
                                        system: 'https://fhir.zapehr.com/r4/StructureDefinitions/flag-code',
                                        code: flagName,
                                        display: flagName,
                                    },
                                ],
                            },
                            category: [
                                {
                                    coding: [
                                        {
                                            system: 'https://hl7.org/fhir/R4/codesystem-flag-category.html',
                                            code: 'admin',
                                            display: 'Administrative',
                                        },
                                    ],
                                },
                            ],
                            subject: {
                                type: 'Patient',
                                reference: "Patient/".concat(patientID),
                            },
                            period: {
                                start: timestamp,
                            },
                            encounter: {
                                reference: "Encounter/".concat(encounterID),
                            },
                            meta: {
                                tag: metaTags,
                            },
                        })];
                case 1:
                    flag = _c.sent();
                    console.log("New flag created for ".concat(flagName), flag);
                    return [3 /*break*/, 4];
                case 2:
                    requests_1 = [];
                    requests_1.push((0, utils_1.getPatchBinary)({
                        resourceType: 'Flag',
                        resourceId: (_b = existingFlags[0].id) !== null && _b !== void 0 ? _b : '',
                        patchOperations: [
                            {
                                op: 'replace',
                                path: '/period/start',
                                value: timestamp,
                            },
                        ],
                    }));
                    // deactivate any other active flags
                    existingFlags.slice(1).forEach(function (flag) {
                        var _a;
                        requests_1.push((0, utils_1.getPatchBinary)({
                            resourceType: 'Flag',
                            resourceId: (_a = flag.id) !== null && _a !== void 0 ? _a : '',
                            patchOperations: [
                                {
                                    op: 'replace',
                                    path: '/status',
                                    value: 'inactive',
                                },
                            ],
                        }));
                    });
                    return [4 /*yield*/, oystehr.fhir.batch({ requests: requests_1 })];
                case 3:
                    _c.sent();
                    console.log("Updated flag ".concat(flagName, " period.start to ").concat(timestamp));
                    _c.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    });
}
