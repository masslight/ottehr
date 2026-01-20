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
var auth_1 = require("../../shared/auth");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
var ZAMBDA_NAME = 'telemed-get-patients';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, oystehr, user, patients, patientsInformation, _i, patients_1, patientTemp, email, weight, weightLastUpdated, chosenName, patient, response, error_1;
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    return __generator(this, function (_s) {
        switch (_s.label) {
            case 0:
                _s.trys.push([0, 6, , 7]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _s.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _s.label = 3;
            case 3:
                oystehr = (0, utils_1.createOystehrClient)(oystehrToken, (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets), (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets));
                console.log('getting user');
                return [4 /*yield*/, (0, auth_1.getUser)(input.headers.Authorization.replace('Bearer ', ''), secrets)];
            case 4:
                user = _s.sent();
                console.log('getting patients for user: ' + user.name);
                return [4 /*yield*/, (0, utils_1.getPatientsForUser)(user, oystehr)];
            case 5:
                patients = _s.sent();
                patientsInformation = [];
                console.log('building patient information resource array');
                for (_i = 0, patients_1 = patients; _i < patients_1.length; _i++) {
                    patientTemp = patients_1[_i];
                    email = (_b = (_a = patientTemp.telecom) === null || _a === void 0 ? void 0 : _a.find(function (telecom) { return telecom.system === 'email'; })) === null || _b === void 0 ? void 0 : _b.value;
                    weight = Number.parseFloat((_e = (_d = (_c = patientTemp.extension) === null || _c === void 0 ? void 0 : _c.find(function (ext) { return ext.url === utils_1.FHIR_EXTENSION.Patient.weight.url; })) === null || _d === void 0 ? void 0 : _d.valueString) !== null && _e !== void 0 ? _e : '');
                    if (isNaN(weight)) {
                        weight = undefined;
                    }
                    weightLastUpdated = (_g = (_f = patientTemp.extension) === null || _f === void 0 ? void 0 : _f.find(function (ext) { return ext.url === utils_1.FHIR_EXTENSION.Patient.weightLastUpdated.url; })) === null || _g === void 0 ? void 0 : _g.valueString;
                    chosenName = (_k = (_j = (_h = patientTemp.name) === null || _h === void 0 ? void 0 : _h.find(function (name) { return name.use === 'nickname'; })) === null || _j === void 0 ? void 0 : _j.given) === null || _k === void 0 ? void 0 : _k[0];
                    patient = {
                        id: patientTemp.id,
                        pointOfDiscovery: ((_l = patientTemp.extension) === null || _l === void 0 ? void 0 : _l.find(function (ext) { return ext.url === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/point-of-discovery"); }))
                            ? true
                            : false,
                        dateOfBirth: patientTemp.birthDate,
                        sex: patientTemp.gender,
                        firstName: (_o = (_m = patientTemp.name) === null || _m === void 0 ? void 0 : _m[0].given) === null || _o === void 0 ? void 0 : _o[0],
                        middleName: (_q = (_p = patientTemp.name) === null || _p === void 0 ? void 0 : _p[0].given) === null || _q === void 0 ? void 0 : _q[1],
                        lastName: (_r = patientTemp.name) === null || _r === void 0 ? void 0 : _r[0].family,
                        chosenName: chosenName,
                        email: email,
                        weightLastUpdated: weightLastUpdated,
                        weight: weight,
                    };
                    patientsInformation.push(patient);
                }
                response = {
                    message: 'Successfully retrieved all patients',
                    patients: patientsInformation,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 6:
                error_1 = _s.sent();
                console.log(error_1, error_1.issue);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 7: return [2 /*return*/];
        }
    });
}); });
