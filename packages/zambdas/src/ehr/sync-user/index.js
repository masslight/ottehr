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
exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("../../shared/helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'sync-user';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, m2mOystehrClient, userToken, userOystehrClient, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                secrets = (0, validateRequestParameters_1.validateRequestParameters)(input).secrets;
                console.log('Parameters: ' + JSON.stringify(input));
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _a.sent();
                m2mOystehrClient = (0, helpers_1.createOystehrClient)(m2mToken, secrets);
                userToken = input.headers.Authorization.replace('Bearer ', '');
                userOystehrClient = (0, helpers_1.createOystehrClient)(userToken, secrets);
                return [4 /*yield*/, performEffect(m2mOystehrClient, userOystehrClient, secrets)];
            case 2:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _a.sent();
                console.log(JSON.stringify(error_1));
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 4: return [2 /*return*/];
        }
    });
}); });
function performEffect(m2mOystehrClient, userOystehrClient, secrets) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, remotePractitioner, localPractitioner, ehrPractitioner, result;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        getRemotePractitionerAndCredentials(userOystehrClient, secrets),
                        getLocalEHRPractitioner(userOystehrClient),
                    ])];
                case 1:
                    _a = _b.sent(), remotePractitioner = _a[0], localPractitioner = _a[1];
                    if (!remotePractitioner) {
                        return [2 /*return*/, {
                                message: 'Remote provider licenses and qualifications not found for current practitioner.',
                                updated: false,
                            }];
                    }
                    ehrPractitioner = __assign({}, localPractitioner);
                    console.log("remotePractitioner: ".concat(JSON.stringify(remotePractitioner)));
                    console.log("localPractitioner:  ".concat(JSON.stringify(ehrPractitioner)));
                    ehrPractitioner = updatePractitionerName(ehrPractitioner, remotePractitioner);
                    ehrPractitioner.birthDate = remotePractitioner.date_of_birth;
                    ehrPractitioner = updatePractitionerPhone(ehrPractitioner, remotePractitioner);
                    ehrPractitioner = updatePractitionerPhoto(ehrPractitioner, remotePractitioner);
                    ehrPractitioner = updatePractitionerQualification(ehrPractitioner, remotePractitioner);
                    ehrPractitioner = updatePractitionerCredentials(ehrPractitioner, remotePractitioner);
                    ehrPractitioner = updatePractitionerNPI(ehrPractitioner, remotePractitioner);
                    return [4 /*yield*/, updatePractitioner(m2mOystehrClient, ehrPractitioner)];
                case 2:
                    result = _b.sent();
                    console.log("Practitioner updated successfully:  ".concat(JSON.stringify(result)));
                    if (result)
                        return [2 /*return*/, {
                                message: 'Practitioner credentials have been synchronized with remote credentials authority successfully.',
                                updated: true,
                            }];
                    throw new Error('Failed updating practitioner...');
            }
        });
    });
}
function getRemotePractitionerAndCredentials(oystehr, secrets) {
    return __awaiter(this, void 0, void 0, function () {
        var myEhrUser, myEmail, clinicianSearchResults, provider;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('Preparing search parameters for remote practitioner');
                    return [4 /*yield*/, oystehr.user.me()];
                case 1:
                    myEhrUser = _b.sent();
                    myEmail = (_a = myEhrUser.email) === null || _a === void 0 ? void 0 : _a.toLocaleLowerCase();
                    console.log("Preparing search for local practitioner email: ".concat(myEmail));
                    clinicianSearchResults = [];
                    // TODO: this is where you could handle provider search results
                    //       from a remote credentialing authority
                    //
                    // const searchResults: RemotePractitionerData[] = await searchRemoteCredentialsAuthority(
                    //   `/api/v1/org/providers/?search=${myEmail}`,
                    //   secrets,
                    // );
                    console.log("Response: ".concat(JSON.stringify(clinicianSearchResults)));
                    if (clinicianSearchResults) {
                        provider = clinicianSearchResults.find(function (provider) { return provider.email === myEmail; });
                        if (provider === null || provider === void 0 ? void 0 : provider.id) {
                            // TODO: this is where you could handle provider credentials and licenses
                            //       from a remote credentialing authority
                            //
                            // const licensesResponse = await searchRemoteCredentialsAuthority(
                            //   `api/v1/org/licenses/?provider=${provider.id}`,
                            //   secrets,
                            // );
                            // const licenses: PractitionerLicense[] = [];
                            // if (licensesResponse) {
                            //   licensesResponse?.forEach((license: any) => {
                            //     const code = license.certificate_type;
                            //     const state = license.state;
                            //     if (code && state) licenses.push({ code, state, active: true });
                            //   });
                            // }
                            return [2 /*return*/, undefined];
                            // {
                            // ...provider,
                            // licenses,
                            // };
                        }
                    }
                    return [2 /*return*/, undefined];
            }
        });
    });
}
function getLocalEHRPractitioner(oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var practitionerId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.user.me()];
                case 1:
                    practitionerId = (_a.sent()).profile.replace('Practitioner/', '');
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Practitioner',
                            id: practitionerId,
                        })];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function searchRemoteCredentialsAuthority(path, secrets) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/];
        });
    });
}
function updatePractitionerName(localClinician, remoteClinician) {
    if (!(remoteClinician.first_name || remoteClinician.middle_name || remoteClinician.last_name))
        return localClinician;
    var firstName = remoteClinician.first_name;
    var secondName = remoteClinician.middle_name;
    var lastName = remoteClinician.last_name;
    if (firstName || secondName || lastName) {
        if (!localClinician.name)
            localClinician.name = [{}];
        var given = [];
        if (!localClinician.name[0].given) {
            if (firstName)
                given.push(firstName);
            if (secondName)
                given.push(secondName);
            if (given.length > 0) {
                localClinician.name[0].given = given;
            }
        }
        if (lastName)
            localClinician.name[0].family = lastName;
    }
    return localClinician;
}
function updatePractitionerPhone(localClinician, remoteClinician) {
    if (!remoteClinician.primary_phone)
        return localClinician;
    localClinician = findTelecomAndUpdateOrAddNew('phone', localClinician, remoteClinician.primary_phone);
    localClinician = findTelecomAndUpdateOrAddNew('sms', localClinician, remoteClinician.primary_phone);
    return localClinician;
}
function findTelecomAndUpdateOrAddNew(system, practitioner, newPhone) {
    var _a;
    var newPractitioner = __assign({}, practitioner);
    var foundTelecomPhone = (_a = newPractitioner.telecom) === null || _a === void 0 ? void 0 : _a.find(function (phone, id) {
        if (phone.system === system) {
            if (newPractitioner.telecom)
                newPractitioner.telecom[id].value = newPhone;
            return true;
        }
        return false;
    });
    if (!foundTelecomPhone) {
        var phoneRecord = {
            system: system,
            value: newPhone,
        };
        if (newPractitioner.telecom) {
            newPractitioner.telecom.push(phoneRecord);
        }
        else {
            newPractitioner.telecom = [phoneRecord];
        }
    }
    return newPractitioner;
}
function updatePractitionerPhoto(localClinician, remoteClinician) {
    if (!remoteClinician.photoUrl)
        return localClinician;
    if (localClinician === null || localClinician === void 0 ? void 0 : localClinician.photo) {
        if (localClinician.photo[0]) {
            localClinician.photo[0] = { url: remoteClinician.photoUrl };
        }
    }
    else {
        localClinician.photo = [{ url: remoteClinician.photoUrl }];
    }
    return localClinician;
}
function updatePractitionerQualification(localPractitioner, remotePractitioner) {
    var _a;
    if (!remotePractitioner.licenses)
        return localPractitioner;
    if (localPractitioner.qualification) {
        var existedLicenses_1 = (0, utils_1.allLicensesForPractitioner)(localPractitioner);
        var missingLicenses_1 = [];
        (_a = remotePractitioner.licenses) === null || _a === void 0 ? void 0 : _a.forEach(function (license) {
            if (!existedLicenses_1.find(function (existed) { return existed.state === license.state && existed.code === license.code; }))
                missingLicenses_1.push(license);
        });
        missingLicenses_1 === null || missingLicenses_1 === void 0 ? void 0 : missingLicenses_1.forEach(function (license) {
            var _a;
            (_a = localPractitioner.qualification) === null || _a === void 0 ? void 0 : _a.push((0, utils_1.makeQualificationForPractitioner)(license));
        });
    }
    else {
        localPractitioner.qualification = [];
        remotePractitioner.licenses.forEach(function (license) {
            return localPractitioner.qualification.push((0, utils_1.makeQualificationForPractitioner)(license));
        });
    }
    return localPractitioner;
}
function updatePractitionerNPI(localClinician, remoteClinician) {
    if (!remoteClinician.npi)
        return localClinician;
    var identifier = {
        system: utils_1.FHIR_IDENTIFIER_NPI,
        value: "".concat(remoteClinician.npi),
    };
    if (localClinician.identifier) {
        var foundIdentifier = (0, utils_1.getPractitionerNPIIdentifier)(localClinician);
        if (foundIdentifier && foundIdentifier.value !== identifier.value) {
            foundIdentifier.value = identifier.value;
        }
        else if (!foundIdentifier)
            localClinician.identifier.push(identifier);
    }
    else {
        localClinician.identifier = [identifier];
    }
    return localClinician;
}
function updatePractitionerCredentials(localClinician, remoteClinician) {
    var _a;
    if (!remoteClinician.profession)
        return localClinician;
    if (!localClinician.name)
        localClinician.name = [{}];
    if (!((_a = localClinician.name[0].suffix) === null || _a === void 0 ? void 0 : _a.includes(remoteClinician.profession))) {
        if (!localClinician.name[0].suffix)
            localClinician.name[0].suffix = [];
        localClinician.name[0].suffix.push(remoteClinician.profession);
    }
    return localClinician;
}
function updatePractitioner(oystehr, practitioner) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.update(practitioner)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
