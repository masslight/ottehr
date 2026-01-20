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
var child_process_1 = require("child_process");
var luxon_1 = require("luxon");
var util_1 = require("util");
var delete_patient_data_1 = require("./delete-patient-data");
var helpers_1 = require("./helpers");
var exec = (0, util_1.promisify)(child_process_1.exec);
var CUT_OFF_DAYS = 30;
var RECENT_APT_PATIENTS_PER_RUN = 100;
var deleteTestPatientsData = function (config) { return __awaiter(void 0, void 0, void 0, function () {
    var env, oystehr, hasMoreAppointments, fhirSearchParams, resources, appointments;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                env = config.env;
                return [4 /*yield*/, (0, helpers_1.createOystehrClientFromConfig)(config)];
            case 1:
                oystehr = _a.sent();
                hasMoreAppointments = true;
                _a.label = 2;
            case 2:
                if (!hasMoreAppointments) return [3 /*break*/, 5];
                fhirSearchParams = {
                    resourceType: 'Patient',
                    params: [
                        {
                            name: 'name',
                            value: 'Test_Doe_Random,TA_User,TM_User,Test_first_name,new_1Snow,new_2Snow,new_3Snow',
                        },
                        {
                            name: '_revinclude',
                            value: 'Appointment:patient',
                        },
                        {
                            name: '_count',
                            value: '25',
                        },
                    ],
                };
                return [4 /*yield*/, oystehr.fhir.search(fhirSearchParams)];
            case 3:
                resources = (_a.sent()).unbundle();
                appointments = resources.filter(function (resource) { return resource.resourceType === 'Appointment'; });
                console.log(appointments);
                if (appointments.length === 0) {
                    hasMoreAppointments = false;
                    return [3 /*break*/, 2];
                }
                return [4 /*yield*/, Promise.all(appointments.map(function (appt) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a, stdout, stderr, error_1;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, exec("tsx ./src/scripts/delete-appointment-data.ts ".concat(env, " ").concat(appt.id))];
                                case 1:
                                    _a = _b.sent(), stdout = _a.stdout, stderr = _a.stderr;
                                    if (stdout) {
                                        console.log('STDOUT:', stdout);
                                        return [2 /*return*/, true];
                                    }
                                    if (stderr) {
                                        console.error('STDERR:', stderr);
                                    }
                                    return [2 /*return*/, false];
                                case 2:
                                    error_1 = _b.sent();
                                    console.error('Error:', error_1);
                                    return [2 /*return*/, false];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); }))];
            case 4:
                _a.sent();
                return [3 /*break*/, 2];
            case 5: return [2 /*return*/];
        }
    });
}); };
// async function removeOldAppointments(config: any): Promise<void> {
//   const env = config.env;
//   const oystehr = await createOystehrClientFromConfig(config);
//   let hasMoreAppointments = true;
//   while (hasMoreAppointments) {
//     const fhirSearchParams = {
//       resourceType: 'Appointment',
//       params: [
//         {
//           name: 'date',
//           value: `lt${DateTime.now().minus({ days: 10 }).toUTC().toISO()}`,
//         },
//         {
//           name: '_include',
//           value: 'Appointment:patient',
//         },
//         {
//           name: '_count',
//           value: '50',
//         },
//       ],
//     };
//     const resources = (await oystehr.fhir.search<Patient | Appointment>(fhirSearchParams)).unbundle();
//     const appointments = resources.filter((resource) => resource.resourceType === 'Appointment') as Appointment[];
//     console.log(appointments);
//     if (appointments.length === 0) {
//       hasMoreAppointments = false;
//       continue;
//     }
//     await Promise.all(
//       appointments.map(async (appt) => {
//         try {
//           const { stdout, stderr } = await exec(`tsx ./src/scripts/delete-appointment-data.ts ${env} ${appt.id}`);
//           if (stdout) {
//             console.log('STDOUT:', stdout);
//             return true;
//           }
//           if (stderr) {
//             console.error('STDERR:', stderr);
//           }
//           return false;
//         } catch (error) {
//           console.error('Error:', error);
//           return false;
//         }
//       })
//     );
//   }
// }
function removePatientsWithoutRecentAppointments(config) {
    return __awaiter(this, void 0, void 0, function () {
        var oystehr, hasMorePatients, offset, totalNumDeletedPatients, totalNumDeletedOtherResources, cutOffDate, fhirSearchParams, patients, error_2, numDeletedPatients, _i, patients_1, patient, _a, hasDeletedPatient, otherResources, error_3;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, helpers_1.createOystehrClientFromConfig)(config)];
                case 1:
                    oystehr = _b.sent();
                    hasMorePatients = true;
                    offset = 0;
                    totalNumDeletedPatients = 0;
                    totalNumDeletedOtherResources = 0;
                    cutOffDate = luxon_1.DateTime.now().minus({ days: CUT_OFF_DAYS });
                    _b.label = 2;
                case 2:
                    if (!hasMorePatients) return [3 /*break*/, 13];
                    fhirSearchParams = {
                        resourceType: 'Patient',
                        params: [
                            {
                                name: '_sort',
                                value: '_lastUpdated',
                            },
                            {
                                name: '_count',
                                value: "".concat(RECENT_APT_PATIENTS_PER_RUN),
                            },
                            {
                                name: '_offset',
                                value: offset,
                            },
                        ],
                    };
                    patients = [];
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, oystehr.fhir.search(fhirSearchParams)];
                case 4:
                    patients = (_b.sent()).unbundle();
                    return [3 /*break*/, 6];
                case 5:
                    error_2 = _b.sent();
                    console.log("Error fetching patients: ".concat(error_2), JSON.stringify(error_2));
                    console.log('ALERT:assuming token expiry, quitting script');
                    return [3 /*break*/, 13];
                case 6:
                    console.log('offset:', offset, 'patients found:', patients.length);
                    numDeletedPatients = 0;
                    console.group('deleting patients without recent appointments');
                    _i = 0, patients_1 = patients;
                    _b.label = 7;
                case 7:
                    if (!(_i < patients_1.length)) return [3 /*break*/, 12];
                    patient = patients_1[_i];
                    _b.label = 8;
                case 8:
                    _b.trys.push([8, 10, , 11]);
                    // patient without id won't exist since we're fetching from fhir
                    if (!patient.id)
                        return [2 /*return*/];
                    return [4 /*yield*/, (0, delete_patient_data_1.deletePatientData)(oystehr, patient.id, cutOffDate)];
                case 9:
                    _a = _b.sent(), hasDeletedPatient = _a.patients, otherResources = _a.otherResources;
                    numDeletedPatients += hasDeletedPatient;
                    totalNumDeletedOtherResources += otherResources;
                    return [3 /*break*/, 11];
                case 10:
                    error_3 = _b.sent();
                    console.error('Error:', error_3);
                    console.log('patient id', patient.id);
                    return [3 /*break*/, 11];
                case 11:
                    _i++;
                    return [3 /*break*/, 7];
                case 12:
                    console.groupEnd();
                    console.debug('deleting patients without recent appointments completed, deleted', numDeletedPatients, 'patients');
                    offset += RECENT_APT_PATIENTS_PER_RUN - numDeletedPatients;
                    totalNumDeletedPatients += numDeletedPatients;
                    if (patients.length === 0)
                        return [3 /*break*/, 13];
                    return [3 /*break*/, 2];
                case 13:
                    console.log('deleted', totalNumDeletedPatients, 'patients, skipped', offset, 'patients');
                    console.log('deleted', totalNumDeletedOtherResources, 'other resources');
                    return [2 /*return*/];
            }
        });
    });
}
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, helpers_1.performEffectWithEnvFile)(deleteTestPatientsData)];
            case 1:
                _a.sent();
                // await performEffectWithEnvFile(removeOldAppointments);
                return [4 /*yield*/, (0, helpers_1.performEffectWithEnvFile)(removePatientsWithoutRecentAppointments)];
            case 2:
                // await performEffectWithEnvFile(removeOldAppointments);
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
main().catch(function (error) {
    console.log('error', error);
    throw error;
});
