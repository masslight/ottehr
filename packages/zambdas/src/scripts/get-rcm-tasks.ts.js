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
var sdk_1 = require("@oystehr/sdk");
var fs = require("fs");
var shared_1 = require("../shared");
var helpers_1 = require("./helpers");
function getTasksByType(oystehr, code) {
    return __awaiter(this, void 0, void 0, function () {
        var currentIndex, total, result, bundledResponse, unbundled, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Fetching tasks for code: ".concat(code));
                    currentIndex = 0;
                    total = 1;
                    result = [];
                    _a.label = 1;
                case 1:
                    if (!(currentIndex < total)) return [3 /*break*/, 6];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Task',
                            params: [
                                {
                                    name: 'code',
                                    value: code,
                                },
                                {
                                    name: '_sort',
                                    value: '-_lastUpdated',
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
                case 3:
                    bundledResponse = _a.sent();
                    total = bundledResponse.total || 0;
                    unbundled = bundledResponse.unbundle();
                    result.push.apply(result, unbundled);
                    currentIndex += unbundled.length;
                    console.log("Fetched ".concat(unbundled.length, " Tasks (").concat(result.length, "/").concat(total, " total)"));
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    console.error("Error fetching Tasks at offset ".concat(currentIndex, ":"), error_1);
                    return [3 /*break*/, 6];
                case 5: return [3 /*break*/, 1];
                case 6:
                    console.log("Found ".concat(result.length, " Tasks for code: ").concat(code));
                    return [2 /*return*/, result];
            }
        });
    });
}
// Helper function to format date from YYYYMMDD to YYYY-MM-DD
// function formatDate(dateString: string): string | null {
//   if (!dateString || dateString.length !== 8) {
//     return null;
//   }
//   const year = dateString.substring(0, 4);
//   const month = dateString.substring(4, 6);
//   const day = dateString.substring(6, 8);
//   return `${year}-${month}-${day}`;
// }
// Add interface for the result
// interface AppointmentContext {
//   appointment: Appointment;
//   encounter?: Encounter;
//   patient?: Patient;
// }
// async function getAppointmentContext(
//   oystehr: Oystehr,
//   appointmentId: string,
// ): Promise<AppointmentContext | null> {
//   try {
//     console.log(`\n🔍 Fetching appointment context for: ${appointmentId}`);
//     // Fetch the Appointment
//     const appointment = await oystehr.fhir.get({
//       resourceType: 'Appointment',
//       id: appointmentId,
//     }) as Appointment;
//     console.log(`✅ Found appointment: ${appointmentId}`);
//     const context: AppointmentContext = {
//       appointment,
//     };
//     // Search for Encounter that references this Appointment
//     const encounterResponse = await oystehr.fhir.search<Encounter>({
//       resourceType: 'Encounter',
//       params: [
//         {
//           name: 'appointment',
//           value: `Appointment/${appointmentId}`,
//         },
//         {
//           name: '_count',
//           value: 1,
//         },
//       ],
//     });
//     const encounters = encounterResponse.unbundle();
//     if (encounters.length > 0) {
//       const encounter = encounters[0];
//       context.encounter = encounter;
//       console.log(`✅ Found encounter: ${encounter.id}`);
//       // Get Patient from Encounter subject
//       if (encounter.subject?.reference) {
//         const patientReference = encounter.subject.reference;
//         const patientId = patientReference.replace('Patient/', '');
//         try {
//           const patient = await oystehr.fhir.get({
//             resourceType: 'Patient',
//             id: patientId,
//           }) as Patient;
//           context.patient = patient;
//           console.log(
//             `✅ Found patient: ${patient.id} - ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`,
//           );
//         } catch (patientError) {
//           console.warn(`⚠️ Failed to fetch patient ${patientId}:`, patientError);
//         }
//       } else {
//         console.warn(`⚠️ Encounter ${encounter.id} has no subject reference`);
//       }
//     } else {
//       console.warn(`⚠️ No encounter found for appointment ${appointmentId}`);
//     }
//     return context;
//   } catch (error) {
//     console.error(`❌ Error fetching appointment context for ${appointmentId}:`, error);
//     return null;
//   }
// }
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var env, secrets, token, oystehr, tasks, failedTasks, _i, tasks_1, task, taskId, status_1, focusReference, appointmentRef, statusReasonCode, statusCounts, _a, tasks_2, task, status_2, _b, _c, _d, status_3, count;
        var _e, _f, _g, _h, _j;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    env = process.argv[2];
                    if (!env) {
                        throw new Error('❌ Environment is required. Usage: npm run script get-rcm-tasks <env>');
                    }
                    secrets = JSON.parse(fs.readFileSync(".env/".concat(env, ".json"), 'utf8'));
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
                case 1:
                    token = _k.sent();
                    if (!token) {
                        throw new Error('❌ Failed to fetch auth token.');
                    }
                    oystehr = new sdk_1.default({
                        accessToken: token,
                        fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(secrets.AUTH0_AUDIENCE),
                    });
                    return [4 /*yield*/, getTasksByType(oystehr, 'send-claim')];
                case 2:
                    tasks = _k.sent();
                    if (tasks.length === 0) {
                        console.log('No tasks found for code: send-claim');
                        return [2 /*return*/];
                    }
                    console.log("\n\uD83D\uDCCB Tasks for send-claim (".concat(tasks.length, " total):"));
                    console.log('='.repeat(140));
                    failedTasks = [];
                    for (_i = 0, tasks_1 = tasks; _i < tasks_1.length; _i++) {
                        task = tasks_1[_i];
                        taskId = task.id || 'N/A';
                        status_1 = task.status || 'N/A';
                        focusReference = ((_e = task.focus) === null || _e === void 0 ? void 0 : _e.reference) || 'N/A';
                        if (status_1 === 'failed') {
                            appointmentRef = ((_f = task.focus) === null || _f === void 0 ? void 0 : _f.reference) || 'N/A';
                            statusReasonCode = ((_j = (_h = (_g = task.statusReason) === null || _g === void 0 ? void 0 : _g.coding) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.code) || 'No reason provided';
                            console.log("Task: ".concat(taskId.padEnd(40), " | Status: ").concat(status_1.padEnd(15), " | Appointment: ").concat(appointmentRef.padEnd(50), " | Reason: ").concat(statusReasonCode));
                            failedTasks.push(task);
                        }
                        else {
                            console.log("Task: ".concat(taskId.padEnd(40), " | Status: ").concat(status_1.padEnd(15), " | Focus: ").concat(focusReference));
                        }
                    }
                    console.log('='.repeat(140));
                    // Print summary by status
                    console.log('\n📊 Summary by Status:');
                    statusCounts = new Map();
                    for (_a = 0, tasks_2 = tasks; _a < tasks_2.length; _a++) {
                        task = tasks_2[_a];
                        status_2 = task.status || 'unknown';
                        statusCounts.set(status_2, (statusCounts.get(status_2) || 0) + 1);
                    }
                    for (_b = 0, _c = Array.from(statusCounts.entries()).sort(); _b < _c.length; _b++) {
                        _d = _c[_b], status_3 = _d[0], count = _d[1];
                        console.log("   ".concat(status_3.padEnd(20), " ").concat(count, " tasks"));
                    }
                    console.log("\nTotal Failed Tasks: ".concat(failedTasks.length));
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return console.log('\n✅ This is all the tasks for sending claims.'); })
    .catch(function (error) {
    console.error(error);
    throw error;
});
