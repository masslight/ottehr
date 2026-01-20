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
exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var in_house_labs_1 = require("../shared/in-house-labs");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'get-create-in-house-lab-order-resources';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, validatedParameters, oystehr_1, attendingPractitionerName, activeActivityDefinitions, testItems, _i, activeActivityDefinitions_1, activeDefinition, testItem, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                secrets = input.secrets;
                try {
                    validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                }
                catch (error) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            body: JSON.stringify({
                                message: "Invalid request parameters. ".concat(error.message || error),
                            }),
                        }];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 5, , 6]);
                secrets = validatedParameters.secrets;
                console.log('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 2:
                m2mToken = _a.sent();
                oystehr_1 = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, (function () { return __awaiter(void 0, void 0, void 0, function () {
                        var oystehrCurrentUser, _a, myPractitionerId, _b, encounter, timezone, practitionerId, attendingPractitionerPromise, currentPractitionerPromise, _c, attendingPractitioner, currentPractitioner, attendingPractitionerName, currentPractitionerName, attendingPractitionerId, currentPractitionerId;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    oystehrCurrentUser = (0, shared_1.createOystehrClient)(validatedParameters.userToken, validatedParameters.secrets);
                                    return [4 /*yield*/, Promise.all([
                                            (0, shared_1.getMyPractitionerId)(oystehrCurrentUser),
                                            validatedParameters.encounterId
                                                ? oystehr_1.fhir
                                                    .search({
                                                    resourceType: 'Encounter',
                                                    params: [
                                                        { name: '_id', value: validatedParameters.encounterId },
                                                        { name: '_include', value: 'Encounter:location' },
                                                    ],
                                                })
                                                    .then(function (bundle) {
                                                    var resources = bundle.unbundle();
                                                    var encounter = resources.find(function (r) { return r.resourceType === 'Encounter'; });
                                                    var location = resources.find(function (r) { return r.resourceType === 'Location'; });
                                                    var timezone = location && (0, utils_1.getTimezone)(location);
                                                    return { encounter: encounter, timezone: timezone };
                                                })
                                                : Promise.resolve({ encounter: null, timezone: undefined }),
                                        ])];
                                case 1:
                                    _a = _d.sent(), myPractitionerId = _a[0], _b = _a[1], encounter = _b.encounter, timezone = _b.timezone;
                                    if (!encounter) {
                                        // todo: we don't have encounter in patient page, this zambda should return the test items only,
                                        // the rest of data should be fetched from the get-orders zambda
                                        return [2 /*return*/, {
                                                attendingPractitionerName: '',
                                                currentPractitionerName: '',
                                                attendingPractitionerId: '',
                                                currentPractitionerId: '',
                                                timezone: undefined,
                                            }];
                                    }
                                    practitionerId = (0, utils_1.getAttendingPractitionerId)(encounter);
                                    attendingPractitionerPromise = practitionerId
                                        ? oystehr_1.fhir.get({
                                            resourceType: 'Practitioner',
                                            id: practitionerId,
                                        })
                                        : Promise.resolve(null);
                                    currentPractitionerPromise = myPractitionerId
                                        ? oystehr_1.fhir.get({
                                            resourceType: 'Practitioner',
                                            id: myPractitionerId,
                                        })
                                        : Promise.resolve(null);
                                    return [4 /*yield*/, Promise.all([
                                            attendingPractitionerPromise,
                                            currentPractitionerPromise,
                                        ])];
                                case 2:
                                    _c = _d.sent(), attendingPractitioner = _c[0], currentPractitioner = _c[1];
                                    attendingPractitionerName = attendingPractitioner
                                        ? (0, utils_1.getFullestAvailableName)(attendingPractitioner) || ''
                                        : '';
                                    currentPractitionerName = currentPractitioner ? (0, utils_1.getFullestAvailableName)(currentPractitioner) || '' : '';
                                    attendingPractitionerId = (attendingPractitioner === null || attendingPractitioner === void 0 ? void 0 : attendingPractitioner.id) || '';
                                    currentPractitionerId = (currentPractitioner === null || currentPractitioner === void 0 ? void 0 : currentPractitioner.id) || '';
                                    return [2 /*return*/, {
                                            attendingPractitionerName: attendingPractitionerName,
                                            currentPractitionerName: currentPractitionerName,
                                            attendingPractitionerId: attendingPractitionerId,
                                            currentPractitionerId: currentPractitionerId,
                                            timezone: timezone,
                                        }];
                            }
                        });
                    }); })()];
            case 3:
                attendingPractitionerName = (_a.sent()).attendingPractitionerName;
                return [4 /*yield*/, (0, in_house_labs_1.fetchActiveInHouseLabActivityDefinitions)(oystehr_1)];
            case 4:
                activeActivityDefinitions = _a.sent();
                console.log("Found ".concat(activeActivityDefinitions.length, " active ActivityDefinition resources"));
                testItems = [];
                for (_i = 0, activeActivityDefinitions_1 = activeActivityDefinitions; _i < activeActivityDefinitions_1.length; _i++) {
                    activeDefinition = activeActivityDefinitions_1[_i];
                    testItem = (0, utils_1.convertActivityDefinitionToTestItem)(activeDefinition);
                    testItems.push(testItem);
                }
                response = {
                    labs: testItems,
                    providerName: attendingPractitionerName,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 5:
                error_1 = _a.sent();
                console.error('Error processing in-house lab order resources:', error_1);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('get-create-in-house-lab-order-resources', error_1, ENVIRONMENT)];
            case 6: return [2 /*return*/];
        }
    });
}); });
