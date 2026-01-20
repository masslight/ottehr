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
var crypto_1 = require("crypto");
var fs_1 = require("fs");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../shared");
var randomVisitId = (0, crypto_1.randomUUID)();
var inPersonConfirmationTestInput = function (env, appointmentData) {
    var _a, _b, _c, _d;
    return ({
        location: "".concat(appointmentData.locationName),
        time: "".concat((_a = appointmentData.startTime) !== null && _a !== void 0 ? _a : luxon_1.DateTime.now().toFormat(utils_1.DATETIME_FULL_NO_YEAR)),
        address: "".concat(appointmentData.locationAddress),
        'address-url': "https://www.google.com/maps/search/?api=1&query=".concat(encodeURI(appointmentData.locationAddress)),
        'modify-visit-url': "".concat(env['WEBSITE_URL'], "/visit/").concat((_b = appointmentData.id) !== null && _b !== void 0 ? _b : randomVisitId, "/reschedule"),
        'cancel-visit-url': "".concat(env['WEBSITE_URL'], "/visit/").concat((_c = appointmentData.id) !== null && _c !== void 0 ? _c : randomVisitId, "/cancel"),
        'paperwork-url': "".concat(env['WEBSITE_URL'], "/paperwork/").concat((_d = appointmentData.id) !== null && _d !== void 0 ? _d : randomVisitId),
    });
};
var inPersonCancelationTestInput = function (env, appointmentData) {
    var _a, _b;
    return ({
        location: "".concat(appointmentData.locationName),
        time: "".concat((_a = appointmentData.startTime) !== null && _a !== void 0 ? _a : luxon_1.DateTime.now().toFormat(utils_1.DATETIME_FULL_NO_YEAR)),
        address: "".concat(appointmentData.locationAddress),
        'address-url': "https://www.google.com/maps/search/?api=1&query=".concat(encodeURI(appointmentData.locationAddress)),
        'book-again-url': "".concat(env['WEBSITE_URL'], "/visit/").concat((_b = appointmentData.id) !== null && _b !== void 0 ? _b : randomVisitId, "/book-again"),
    });
};
var inPersonCompletionTestInput = function (env, appointmentData) {
    var _a, _b;
    return ({
        location: "".concat(appointmentData.locationName),
        time: "".concat((_a = appointmentData.startTime) !== null && _a !== void 0 ? _a : luxon_1.DateTime.now().toFormat(utils_1.DATETIME_FULL_NO_YEAR)),
        address: "".concat(appointmentData.locationAddress),
        'address-url': "https://www.google.com/maps/search/?api=1&query=".concat(encodeURI(appointmentData.locationAddress)),
        'visit-note-url': "".concat(env['WEBSITE_URL'], "/visit/").concat((_b = appointmentData.id) !== null && _b !== void 0 ? _b : randomVisitId, "/note"), // todo: confirm actual note url
    });
};
var inPersonReminderTemplateData = function (env, appointmentData) {
    var _a, _b, _c, _d;
    return ({
        location: "".concat(appointmentData.locationName),
        time: "".concat((_a = appointmentData.startTime) !== null && _a !== void 0 ? _a : luxon_1.DateTime.now().toFormat(utils_1.DATETIME_FULL_NO_YEAR)),
        address: "".concat(appointmentData.locationAddress),
        'address-url': "https://www.google.com/maps/search/?api=1&query=".concat(encodeURI(appointmentData.locationAddress)),
        'modify-visit-url': "".concat(env['WEBSITE_URL'], "/visit/").concat((_b = appointmentData.id) !== null && _b !== void 0 ? _b : randomVisitId, "/reschedule"),
        'cancel-visit-url': "".concat(env['WEBSITE_URL'], "/visit/").concat((_c = appointmentData.id) !== null && _c !== void 0 ? _c : randomVisitId, "/cancel"),
        'paperwork-url': "".concat(env['WEBSITE_URL'], "/paperwork/").concat((_d = appointmentData.id) !== null && _d !== void 0 ? _d : randomVisitId),
    });
};
var inPersonReceiptTemplateData = function (appointmentData) {
    var _a, _b;
    return ({
        'recipient-name': (_a = appointmentData.patientName) !== null && _a !== void 0 ? _a : '',
        date: (_b = appointmentData.startTime) !== null && _b !== void 0 ? _b : luxon_1.DateTime.now().toFormat(utils_1.DATETIME_FULL_NO_YEAR),
    });
};
var getInPersonReceiptTestPdfFileAttachment = function () {
    var file = fs_1.default.readFileSync('test/data/files/test-receipt.pdf');
    return {
        content: file.toString('base64'),
        filename: 'receipt.pdf',
        type: utils_1.MIME_TYPES.PDF,
        disposition: 'attachment',
    };
};
var telemedConfirmationTestInput = function (env, appointmentData) {
    var _a, _b, _c;
    return ({
        location: "".concat(appointmentData.locationName),
        'cancel-visit-url': "".concat(env['WEBSITE_URL'], "/visit/").concat((_a = appointmentData.id) !== null && _a !== void 0 ? _a : randomVisitId, "/cancel"),
        'paperwork-url': "".concat(env['WEBSITE_URL'], "/paperwork/").concat((_b = appointmentData.id) !== null && _b !== void 0 ? _b : randomVisitId),
        'join-visit-url': "".concat(env['WEBSITE_URL'], "/visit/").concat((_c = appointmentData.id) !== null && _c !== void 0 ? _c : randomVisitId, "/join"),
    });
};
var telemedCancelationTestInput = function (env, appointmentData) {
    var _a;
    return ({
        location: "".concat(appointmentData.locationName),
        'book-again-url': "".concat(env['WEBSITE_URL'], "/visit/").concat((_a = appointmentData.id) !== null && _a !== void 0 ? _a : randomVisitId, "/book-again"),
    });
};
var telemedCompletionTestInput = function (env, appointmentData) {
    var _a;
    return ({
        location: "".concat(appointmentData.locationName),
        'visit-note-url': "".concat(env['WEBSITE_URL'], "/visit/").concat((_a = appointmentData.id) !== null && _a !== void 0 ? _a : randomVisitId, "/note"), // todo: confirm actual note url
    });
};
var telemedInvitationTestInput = function (env, appointmentData) {
    var _a, _b;
    return ({
        'join-visit-url': "".concat(env['WEBSITE_URL'], "/visit/").concat((_a = appointmentData.id) !== null && _a !== void 0 ? _a : randomVisitId, "/join"),
        'patient-name': (_b = appointmentData.patientName) !== null && _b !== void 0 ? _b : 'John Doe',
        location: "".concat(appointmentData.locationName),
    });
};
var errorReportTestInput = function (env) { return ({
    'error-message': 'Test error message',
    environment: env['ENVIRONMENT'],
    timestamp: luxon_1.DateTime.now().toFormat(utils_1.DATETIME_FULL_NO_YEAR),
}); };
var testEmails = function (envConfig, to, appointmentData) { return __awaiter(void 0, void 0, void 0, function () {
    var emailClient, e_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 13, , 14]);
                emailClient = (0, shared_1.getEmailClient)(envConfig);
                if (!(appointmentData.serviceMode === 'in-person')) return [3 /*break*/, 6];
                return [4 /*yield*/, emailClient.sendInPersonConfirmationEmail(to, inPersonConfirmationTestInput(envConfig, appointmentData))];
            case 1:
                _a.sent();
                return [4 /*yield*/, emailClient.sendInPersonCancelationEmail(to, inPersonCancelationTestInput(envConfig, appointmentData))];
            case 2:
                _a.sent();
                return [4 /*yield*/, emailClient.sendInPersonCompletionEmail(to, inPersonCompletionTestInput(envConfig, appointmentData))];
            case 3:
                _a.sent();
                return [4 /*yield*/, emailClient.sendInPersonReminderEmail(to, inPersonReminderTemplateData(envConfig, appointmentData))];
            case 4:
                _a.sent();
                return [4 /*yield*/, emailClient.sendInPersonReceiptEmail(to, inPersonReceiptTemplateData(appointmentData), [
                        getInPersonReceiptTestPdfFileAttachment(),
                    ])];
            case 5:
                _a.sent();
                return [3 /*break*/, 11];
            case 6: return [4 /*yield*/, emailClient.sendVirtualConfirmationEmail(to, telemedConfirmationTestInput(envConfig, appointmentData))];
            case 7:
                _a.sent();
                return [4 /*yield*/, emailClient.sendVirtualCancelationEmail(to, telemedCancelationTestInput(envConfig, appointmentData))];
            case 8:
                _a.sent();
                return [4 /*yield*/, emailClient.sendVirtualCompletionEmail(to, telemedCompletionTestInput(envConfig, appointmentData))];
            case 9:
                _a.sent();
                return [4 /*yield*/, emailClient.sendVideoChatInvitationEmail(to, telemedInvitationTestInput(envConfig, appointmentData))];
            case 10:
                _a.sent();
                _a.label = 11;
            case 11: return [4 /*yield*/, emailClient.sendErrorEmail(to, errorReportTestInput(envConfig))];
            case 12:
                _a.sent();
                return [3 /*break*/, 14];
            case 13:
                e_1 = _a.sent();
                console.log('email test threw error:', e_1);
                return [3 /*break*/, 14];
            case 14: return [2 /*return*/];
        }
    });
}); };
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var env, to, serviceModeArg, appointmentID, envConfig, serviceMode, locationName, locationAddress, appointmentData, token, oystehr, appointmentBundle, appointment, patient, slot, location_1, patientName, serviceMode_1, startTime, locationName_1, locationAddress_1;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                env = process.argv[2];
                to = process.argv[3];
                serviceModeArg = process.argv[4];
                appointmentID = process.argv[5];
                envConfig = JSON.parse(fs_1.default.readFileSync(".env/".concat(env, ".json"), 'utf8'));
                try {
                    envConfig = JSON.parse(fs_1.default.readFileSync(".env/".concat(env, ".json"), 'utf8'));
                }
                catch (error) {
                    console.error("Error parsing secrets for ENV '".concat(env, "'. Error: ").concat(JSON.stringify(error)));
                }
                serviceMode = serviceModeArg === 'in-person' ? utils_1.ServiceMode['in-person'] : utils_1.ServiceMode.virtual;
                locationName = serviceMode === utils_1.ServiceMode['in-person'] ? 'Manassas' : 'Telemed VA';
                locationAddress = serviceMode === utils_1.ServiceMode['in-person'] ? '123 Main St, Manassas, VA 20110' : '';
                appointmentData = { serviceMode: serviceMode, locationName: locationName, locationAddress: locationAddress };
                console.log("env: ".concat(env, ", send to: ").concat(to, ", appointmentID: ").concat(appointmentID, ", serviceMode: ").concat(serviceModeArg));
                if (!appointmentID) return [3 /*break*/, 3];
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(envConfig)];
            case 1:
                token = _d.sent();
                if (!token) {
                    throw new Error('Failed to fetch auth token.');
                }
                oystehr = (0, shared_1.createOystehrClient)(token, envConfig);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: [
                            {
                                name: '_id',
                                value: appointmentID,
                            },
                            {
                                name: '_include',
                                value: 'Appointment:patient',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:slot',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:location',
                            },
                        ],
                    })];
            case 2:
                appointmentBundle = (_d.sent()).unbundle();
                appointment = appointmentBundle.find(function (resource) { return resource.resourceType === 'Appointment'; });
                patient = appointmentBundle.find(function (resource) { return resource.resourceType === 'Patient'; });
                slot = appointmentBundle.find(function (resource) { return resource.resourceType === 'Slot'; });
                location_1 = appointmentBundle.find(function (resource) { return resource.resourceType === 'Location'; });
                if (!appointment) {
                    console.log("exiting, no appointment found with that ID in this env\n");
                    process.exit(1);
                }
                if (!patient) {
                    console.log("exiting, no patient found for that appointment in this env\n");
                    process.exit(1);
                }
                if (!location_1) {
                    console.log("exiting, no location found for that appointment in this env\n");
                    process.exit(1);
                }
                patientName = (0, utils_1.getFullName)(patient);
                serviceMode_1 = slot ? (_a = (0, utils_1.getServiceModeFromSlot)(slot)) !== null && _a !== void 0 ? _a : utils_1.ServiceMode.virtual : utils_1.ServiceMode.virtual;
                startTime = appointment.start
                    ? luxon_1.DateTime.fromISO(appointment.start).toFormat(utils_1.DATETIME_FULL_NO_YEAR)
                    : undefined;
                locationName_1 = (_b = location_1 === null || location_1 === void 0 ? void 0 : location_1.name) !== null && _b !== void 0 ? _b : (serviceMode_1 === utils_1.ServiceMode.virtual ? 'Telemed VA' : 'Manassas');
                locationAddress_1 = (_c = (0, utils_1.getAddressString)(location_1 === null || location_1 === void 0 ? void 0 : location_1.address)) !== null && _c !== void 0 ? _c : (serviceMode_1 === utils_1.ServiceMode.virtual ? '' : '123 Main St, Manassas, VA 20110');
                appointmentData = { serviceMode: serviceMode_1, id: appointmentID, patientName: patientName, startTime: startTime, locationName: locationName_1, locationAddress: locationAddress_1 };
                console.log("found appointment with service mode ".concat(serviceMode_1, " for ").concat(patientName));
                return [3 /*break*/, 4];
            case 3:
                if (serviceModeArg == undefined) {
                    throw new Error('Must provide either appointment ID or service mode as argument.');
                }
                _d.label = 4;
            case 4: return [4 /*yield*/, testEmails(envConfig, to, appointmentData)];
            case 5:
                _d.sent();
                return [2 /*return*/];
        }
    });
}); };
main().catch(function (error) {
    console.log('error', error);
    throw error;
});
