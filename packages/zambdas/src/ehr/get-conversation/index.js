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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.index = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("../../shared/helpers");
var oystehrToken;
var CHUNK_SIZE = 100;
var MAX_MESSAGE_COUNT = '1000';
exports.index = (0, shared_1.wrapHandler)('get-conversation', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, smsNumbers, timezone_1, oystehr, uniqueNumbers, smsQuery, allRecipients, _a, sentMessages, receivedMessages, rpMap_1, senderMap_1, patientMap_1, sentCommunications_1, receivedCommunications_1, sentMessagesToReturn, receivedMessagesToReturn, allMessages, error_1, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 6, , 7]);
                console.group('validateRequestParameters');
                validatedParameters = validateRequestParameters(input);
                secrets = validatedParameters.secrets, smsNumbers = validatedParameters.smsNumbers, timezone_1 = validatedParameters.timezone;
                console.groupEnd();
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _b.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _b.label = 3;
            case 3:
                oystehr = (0, helpers_1.createOystehrClient)(oystehrToken, secrets);
                uniqueNumbers = Array.from(new Set(smsNumbers));
                smsQuery = uniqueNumbers.map(function (number) { return "".concat(number); }).join(',');
                console.log('smsQuery', smsQuery);
                console.time('sms-query');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'RelatedPerson',
                        params: [{ name: 'telecom', value: smsQuery }],
                    })];
            case 4:
                allRecipients = (_b.sent())
                    .unbundle()
                    .map(function (recipient) { return "RelatedPerson/".concat(recipient.id); });
                console.timeEnd('sms-query');
                console.log("found ".concat(allRecipients.length, " related persons with the sms number ").concat(smsQuery, "; searching messages for all those recipients"));
                console.time('get_sent_and_received_messages');
                return [4 /*yield*/, Promise.all([
                        // todo: use safe batch pattern here :(
                        getSentMessages(allRecipients, oystehr),
                        getReceivedMessages(allRecipients, oystehr),
                    ])];
            case 5:
                _a = _b.sent(), sentMessages = _a[0], receivedMessages = _a[1];
                console.timeEnd('get_sent_and_received_messages');
                console.time('structure_conversation_data');
                rpMap_1 = {};
                senderMap_1 = {};
                patientMap_1 = {};
                sentCommunications_1 = [];
                receivedCommunications_1 = [];
                sentMessages.forEach(function (resource) {
                    if (resource.resourceType === 'Communication') {
                        sentCommunications_1.push(resource);
                    }
                    else if (resource.resourceType === 'Device' && resource.id) {
                        senderMap_1["Device/".concat(resource.id)] = resource;
                    }
                    else if (resource.resourceType === 'Practitioner' && resource.id) {
                        senderMap_1["Practitioner/".concat(resource.id)] = resource;
                    }
                });
                receivedMessages.forEach(function (resource) {
                    if (resource.resourceType === 'Communication') {
                        receivedCommunications_1.push(resource);
                    }
                    else if (resource.resourceType === 'RelatedPerson' && resource.id) {
                        rpMap_1["RelatedPerson/".concat(resource.id)] = resource;
                    }
                    else if (resource.resourceType === 'Patient' && resource.id) {
                        patientMap_1["Patient/".concat(resource.id)] = resource;
                    }
                });
                console.log('sent messages found: ', sentCommunications_1.length);
                console.log('received messages found: ', receivedCommunications_1.length);
                sentMessagesToReturn = sentCommunications_1.map(function (comm) {
                    var _a, _b;
                    var content = (0, utils_1.getMessageFromComm)(comm);
                    return {
                        id: (_a = comm.id) !== null && _a !== void 0 ? _a : '',
                        content: content,
                        isRead: true,
                        sentWhen: (_b = comm.sent) !== null && _b !== void 0 ? _b : '',
                        sender: getSenderNameFromComm(comm, senderMap_1),
                        isFromPatient: false,
                    };
                });
                receivedMessagesToReturn = receivedCommunications_1.map(function (comm) {
                    var _a, _b;
                    var content = (0, utils_1.getMessageFromComm)(comm);
                    var sender = getPatientSenderNameFromComm(comm, rpMap_1, patientMap_1);
                    return {
                        id: (_a = comm.id) !== null && _a !== void 0 ? _a : '',
                        content: content,
                        isRead: (0, utils_1.getMessageHasBeenRead)(comm),
                        sentWhen: (_b = comm.sent) !== null && _b !== void 0 ? _b : '',
                        sender: sender,
                        isFromPatient: true,
                    };
                });
                allMessages = __spreadArray(__spreadArray([], sentMessagesToReturn, true), receivedMessagesToReturn, true).sort(function (m1, m2) {
                    var time1 = luxon_1.DateTime.fromISO(m1.sentWhen);
                    var time2 = luxon_1.DateTime.fromISO(m2.sentWhen);
                    if (time1.equals(time2)) {
                        return 0;
                    }
                    return time1 < time2 ? -1 : 1;
                })
                    .map(function (message) {
                    var id = message.id, sentWhen = message.sentWhen, content = message.content, isRead = message.isRead, sender = message.sender, isFromPatient = message.isFromPatient;
                    var dateTime = luxon_1.DateTime.fromISO(sentWhen).setZone(timezone_1);
                    var sentDay = dateTime.toLocaleString({ day: 'numeric', month: 'numeric', year: '2-digit' }, { locale: 'en-us' });
                    var sentTime = dateTime.toLocaleString({ timeStyle: 'short' }, { locale: 'en-us' });
                    return {
                        id: id,
                        content: content,
                        isRead: isRead,
                        sender: sender,
                        sentDay: sentDay,
                        sentTime: sentTime,
                        isFromPatient: isFromPatient,
                    };
                });
                console.time('structure_conversation_data');
                console.log('messages to return: ', allMessages.length);
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(allMessages),
                    }];
            case 6:
                error_1 = _b.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('get-conversation', error_1, ENVIRONMENT)];
            case 7: return [2 /*return*/];
        }
    });
}); });
function validateRequestParameters(input) {
    var _a;
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var secrets = input.secrets;
    var env = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, secrets);
    var smsPhoneRegex = env === 'production' ? /^(\+1)\d{10}$/ : /^\+\d{1,3}\d{10}$/;
    var _b = JSON.parse(input.body), smsNumbers = _b.smsNumbers, timezone = _b.timezone;
    if (smsNumbers === undefined || smsNumbers.length === 0) {
        throw new Error('These fields are required: "smsNumbers"');
    }
    if (timezone === undefined) {
        throw new Error('These fields are required: "timezone"');
    }
    var now = luxon_1.DateTime.now().setZone(timezone);
    if (!now.isValid) {
        throw new Error("Field \"timezone\" is invalid ".concat((_a = now.invalidExplanation) !== null && _a !== void 0 ? _a : ''));
    }
    smsNumbers.forEach(function (smsNumber) {
        if (typeof smsNumber !== 'string') {
            throw new Error('Field "smsNumbers" must be a list of strings');
        }
        if (!smsPhoneRegex.test(smsNumber)) {
            throw new Error('smsNumber must be of the form "+1", followed by 10 digits');
        }
    });
    if (!input.secrets) {
        throw new Error('No secrets provided');
    }
    return {
        smsNumbers: Array.from(new Set(smsNumbers)),
        timezone: timezone,
        secrets: input.secrets,
    };
}
var getPatientSenderNameFromComm = function (communication, rpMap, patientMap) {
    var _a, _b;
    var senderRef = (_a = communication.sender) === null || _a === void 0 ? void 0 : _a.reference;
    if (senderRef && rpMap[senderRef]) {
        var parent_1 = rpMap[senderRef];
        var patient = patientMap[(_b = parent_1.patient.reference) !== null && _b !== void 0 ? _b : ''];
        var firstName = (0, utils_1.getFirstName)(patient);
        var lastName = (0, utils_1.getLastName)(patient);
        if (firstName && lastName) {
            return "".concat(firstName, " ").concat(lastName);
        }
        else if (patient) {
            firstName = (0, utils_1.getFirstName)(parent_1);
            lastName = (0, utils_1.getLastName)(parent_1);
        }
        if (firstName && lastName) {
            return "".concat(firstName, " ").concat(lastName);
        }
        else if (firstName) {
            return firstName;
        }
        else if (lastName) {
            return lastName;
        }
    }
    return 'Patient, Parent or Guardian';
};
var getSenderNameFromComm = function (communication, map) {
    var _a;
    var senderRef = (_a = communication.sender) === null || _a === void 0 ? void 0 : _a.reference;
    if (senderRef && map[senderRef]) {
        var resource = map[senderRef];
        if (resource.resourceType === 'Device') {
            return 'Automated Message';
        }
        else {
            var practitioner = resource;
            var name_1 = (0, utils_1.getFullestAvailableName)(practitioner);
            if (name_1) {
                return name_1;
            }
        }
    }
    return "".concat(utils_1.BRANDING_CONFIG.projectName, " Team");
};
var getReceivedMessages = function (relatedPersonRefs, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var batchGroups, searchRequests, batchResults, entries, idSet;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!(relatedPersonRefs.length <= CHUNK_SIZE)) return [3 /*break*/, 2];
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Communication',
                        params: [
                            { name: 'sender', value: relatedPersonRefs.join(',') },
                            { name: '_sort', value: '-sent' },
                            { name: '_count', value: MAX_MESSAGE_COUNT },
                            { name: 'sent:missing', value: 'false' },
                            { name: '_include', value: 'Communication:sender:RelatedPerson' },
                            { name: '_include:iterate', value: 'RelatedPerson:patient' },
                            { name: 'medium', value: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode|SMSWRIT' },
                        ],
                    })];
            case 1: return [2 /*return*/, (_b.sent()).unbundle()];
            case 2:
                batchGroups = (0, utils_1.chunkThings)(relatedPersonRefs, CHUNK_SIZE);
                searchRequests = batchGroups.map(function (ids) {
                    return {
                        url: "Communication?sender=".concat(ids.join(','), "&medium=http://terminology.hl7.org/CodeSystem/v3-ParticipationMode|SMSWRIT&_sort=-sent&_count=").concat(MAX_MESSAGE_COUNT, "&sent:missing=false&_include=Communication:sender:RelatedPerson&_include:iterate=RelatedPerson:patient"),
                        method: 'GET',
                    };
                });
                return [4 /*yield*/, oystehr.fhir.batch({
                        requests: searchRequests,
                    })];
            case 3:
                batchResults = _b.sent();
                entries = ((_a = batchResults.entry) !== null && _a !== void 0 ? _a : []).flatMap(function (be) {
                    var _a, _b, _c;
                    if (((_b = (_a = be.response) === null || _a === void 0 ? void 0 : _a.outcome) === null || _b === void 0 ? void 0 : _b.id) === 'ok' &&
                        be.resource &&
                        be.resource.resourceType === 'Bundle' &&
                        be.resource.type === 'searchset') {
                        var innerBundle = be.resource;
                        var innerEntry = innerBundle.entry;
                        if (!innerEntry) {
                            return [];
                        }
                        else {
                            return ((_c = innerBundle.entry) !== null && _c !== void 0 ? _c : []).map(function (ibe) { return ibe.resource; });
                        }
                    }
                    else {
                        return [];
                    }
                });
                idSet = new Set();
                return [2 /*return*/, entries.filter(function (entry) {
                        var id = entry.id, resourceType = entry.resourceType;
                        if (!id) {
                            return false;
                        }
                        if (idSet.has("".concat(resourceType, "/").concat(id))) {
                            return false;
                        }
                        else {
                            idSet.add("".concat(resourceType, "/").concat(id));
                            return true;
                        }
                    })];
        }
    });
}); };
var getSentMessages = function (relatedPersonRefs, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var results, batchGroups, searchRequests, batchResults, entries, idSet;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                console.time('get_sent_messages');
                if (!(relatedPersonRefs.length <= CHUNK_SIZE)) return [3 /*break*/, 2];
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Communication',
                        params: [
                            { name: 'recipient', value: relatedPersonRefs.join(',') },
                            { name: '_sort', value: '-sent' },
                            { name: '_count', value: MAX_MESSAGE_COUNT },
                            { name: 'sent:missing', value: 'false' },
                            { name: '_include', value: 'Communication:sender:Practitioner' },
                            { name: '_include', value: 'Communication:sender:Device' },
                            { name: 'medium', value: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode|SMSWRIT' },
                        ],
                    })];
            case 1:
                results = (_b.sent()).unbundle();
                console.timeEnd('get_sent_messages');
                return [2 /*return*/, results];
            case 2:
                batchGroups = (0, utils_1.chunkThings)(relatedPersonRefs, CHUNK_SIZE);
                searchRequests = batchGroups.map(function (ids) {
                    return {
                        url: "Communication?recipient=".concat(ids.join(','), "&medium=http://terminology.hl7.org/CodeSystem/v3-ParticipationMode|SMSWRIT&_sort=-sent&_count=").concat(MAX_MESSAGE_COUNT, "&sent:missing=false&_include=Communication:sender:Practitioner&_include=Communication:sender:Device"),
                        method: 'GET',
                    };
                });
                return [4 /*yield*/, oystehr.fhir.batch({
                        requests: searchRequests,
                    })];
            case 3:
                batchResults = _b.sent();
                entries = ((_a = batchResults.entry) !== null && _a !== void 0 ? _a : []).flatMap(function (be) {
                    var _a, _b, _c;
                    if (((_b = (_a = be.response) === null || _a === void 0 ? void 0 : _a.outcome) === null || _b === void 0 ? void 0 : _b.id) === 'ok' &&
                        be.resource &&
                        be.resource.resourceType === 'Bundle' &&
                        be.resource.type === 'searchset') {
                        var innerBundle = be.resource;
                        var innerEntry = innerBundle.entry;
                        if (!innerEntry) {
                            return [];
                        }
                        else {
                            return ((_c = innerBundle.entry) !== null && _c !== void 0 ? _c : []).map(function (ibe) { return ibe.resource; });
                        }
                    }
                    else {
                        return [];
                    }
                });
                idSet = new Set();
                console.timeEnd('get_sent_messages');
                return [2 /*return*/, entries.filter(function (entry) {
                        var id = entry.id, resourceType = entry.resourceType;
                        if (!id) {
                            return false;
                        }
                        if (idSet.has("".concat(resourceType, "/").concat(id))) {
                            return false;
                        }
                        else {
                            idSet.add("".concat(resourceType, "/").concat(id));
                            return true;
                        }
                    })];
        }
    });
}); };
