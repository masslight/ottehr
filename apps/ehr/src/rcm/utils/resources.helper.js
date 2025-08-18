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
exports.mapPersonNameToResource = exports.mapPersonInformationToResource = exports.getCoverageRelatedResources = exports.generateOpByResourceData = exports.getDateFromISO = exports.getDateFromFormat = exports.filterResourcesByType = exports.findResourceByTypeAndId = exports.findResourceByType = exports.DIAGNOSES_SEQUENCE_LETTER = exports.RELATIONSHIP_TO_INSURED = exports.genderOptions = exports.mapGenderToLabel = void 0;
var luxon_1 = require("luxon");
exports.mapGenderToLabel = {
    male: 'Male',
    female: 'Female',
    other: 'Intersex',
    unknown: 'Unknown',
};
exports.genderOptions = Object.keys(exports.mapGenderToLabel)
    .filter(function (gender) { return gender !== 'unknown'; })
    .map(function (gender) { return ({ label: exports.mapGenderToLabel[gender], value: gender }); });
exports.RELATIONSHIP_TO_INSURED = ['Child', 'Parent', 'Spouse', 'Other', 'Self'];
exports.DIAGNOSES_SEQUENCE_LETTER = ['A.', 'B.', 'C.', 'D.', 'E.', 'F.', 'G.', 'H.', 'I.', 'J.', 'K.', 'L.'];
var findResourceByType = function (data, type) {
    return data.find(function (resource) { return resource.resourceType === type; });
};
exports.findResourceByType = findResourceByType;
var findResourceByTypeAndId = function (data, type, id) {
    if (!type || !id) {
        return;
    }
    return data.find(function (resource) { return resource.resourceType === type && resource.id === id; });
};
exports.findResourceByTypeAndId = findResourceByTypeAndId;
var filterResourcesByType = function (data, type) {
    return data.filter(function (resource) { return resource.resourceType === type; });
};
exports.filterResourcesByType = filterResourcesByType;
var getDateFromFormat = function (value, format) {
    if (!value) {
        return;
    }
    return luxon_1.DateTime.fromFormat(value, format || 'yyyy-MM-dd');
};
exports.getDateFromFormat = getDateFromFormat;
var getDateFromISO = function (value) {
    if (!value) {
        return;
    }
    return luxon_1.DateTime.fromISO(value);
};
exports.getDateFromISO = getDateFromISO;
var generateOpByResourceData = function (newData, currentData, field) {
    if (newData[field] === undefined && currentData[field] !== undefined) {
        return 'remove';
    }
    if (newData[field] !== undefined && currentData[field] === undefined) {
        return 'add';
    }
    return 'replace';
};
exports.generateOpByResourceData = generateOpByResourceData;
var getCoverageRelatedResources = function (oystehr, coverageReference) { return __awaiter(void 0, void 0, void 0, function () {
    var resources, coverageResource, coverage, subscriberReference, subscriberResource;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!coverageReference) {
                    return [2 /*return*/, []];
                }
                resources = [];
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Coverage',
                        params: [{ name: '_id', value: coverageReference.split('/')[1] }],
                    })];
            case 1:
                coverageResource = (_b.sent()).unbundle();
                coverage = (0, exports.findResourceByType)(coverageResource, 'Coverage');
                resources.push.apply(resources, coverageResource);
                subscriberReference = (_a = coverage === null || coverage === void 0 ? void 0 : coverage.subscriber) === null || _a === void 0 ? void 0 : _a.reference;
                if (!subscriberReference) return [3 /*break*/, 3];
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: subscriberReference.split('/')[0],
                        params: [{ name: '_id', value: subscriberReference.split('/')[1] }],
                    })];
            case 2:
                subscriberResource = (_b.sent()).unbundle();
                resources.push.apply(resources, subscriberResource);
                _b.label = 3;
            case 3: return [2 /*return*/, resources];
        }
    });
}); };
exports.getCoverageRelatedResources = getCoverageRelatedResources;
var mapPersonInformationToResource = function (person, information) {
    var _a, _b;
    if (information.dob) {
        person.birthDate = information.dob.toFormat('yyyy-MM-dd');
    }
    else {
        person.birthDate = undefined;
    }
    if (information.sex) {
        person.gender = information.sex;
    }
    else {
        person.gender = undefined;
    }
    (0, exports.mapPersonNameToResource)(person, information);
    var city = information.city.trim();
    var address = information.address.trim();
    var state = information.state;
    var zip = information.zip.trim();
    if (!city && !address && !state && !zip) {
        person.address = undefined;
    }
    else {
        if (!person.address || person.address.length === 0) {
            person.address = [{}];
        }
        if (!person.address[0].line || person.address[0].line.length === 0) {
            person.address[0].line = [];
        }
        if (city) {
            person.address[0].city = city;
        }
        else {
            person.address[0].city = undefined;
        }
        if (address) {
            person.address[0].line[0] = address;
        }
        else {
            person.address[0].line = undefined;
        }
        if (state) {
            person.address[0].state = state;
        }
        else {
            person.address[0].state = undefined;
        }
        if (zip) {
            person.address[0].postalCode = zip;
        }
        else {
            person.address[0].postalCode = undefined;
        }
    }
    var phone = information.phone;
    if (phone) {
        if (!((_a = person.telecom) === null || _a === void 0 ? void 0 : _a.find(function (item) { return item.system === 'phone'; }))) {
            person.telecom = __spreadArray(__spreadArray([], (person.telecom || []), true), [{ system: 'phone', value: phone }], false);
        }
        else {
            person.telecom = person.telecom.map(function (item) {
                return item.system === 'phone' ? { system: 'phone', value: phone } : item;
            });
        }
    }
    else {
        person.telecom = (_b = person.telecom) === null || _b === void 0 ? void 0 : _b.filter(function (item) { return item.system !== 'phone'; });
    }
};
exports.mapPersonInformationToResource = mapPersonInformationToResource;
var mapPersonNameToResource = function (person, information) {
    var lastName = information.lastName.trim();
    var firstName = information.firstName.trim();
    var middleName = information.middleName.trim();
    if (!lastName && !firstName && !middleName) {
        person.name = undefined;
    }
    else {
        if (!person.name || person.name.length === 0) {
            person.name = [{}];
        }
        if (!person.name[0].given || person.name[0].given.length === 0) {
            person.name[0].given = [];
        }
        if (lastName) {
            person.name[0].family = lastName;
        }
        else {
            person.name[0].family = undefined;
        }
        if (!information.middleName && !information.lastName) {
            person.name[0].given = undefined;
        }
        else {
            if (firstName) {
                person.name[0].given[0] = firstName;
            }
            if (middleName) {
                person.name[0].given[1] = middleName;
            }
            else {
                person.name[0].given.splice(1, 1);
            }
        }
    }
};
exports.mapPersonNameToResource = mapPersonNameToResource;
//# sourceMappingURL=resources.helper.js.map