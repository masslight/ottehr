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
exports.createOrUpdateRelatedPerson = void 0;
var utils_1 = require("utils");
var getGender = function (sex) {
    if (sex != undefined) {
        switch (sex.toLowerCase()) {
            case 'male':
                return 'male';
            case 'female':
                return 'female';
            case 'unknown':
                return 'unknown';
            default:
                return 'other';
        }
    }
    return 'unknown';
};
var createOrUpdateRelatedPerson = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var newRelatedPerson;
    var oystehr = _b.oystehr, patient = _b.patient, relatedPersonData = _b.relatedPersonData, relatedPerson = _b.relatedPerson, eligibility = _b.eligibility, primary = _b.primary;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!!relatedPerson) return [3 /*break*/, 2];
                console.log('Creating a RelatedPerson.');
                return [4 /*yield*/, createRelatedPerson(patient, relatedPersonData, oystehr, eligibility ? (primary ? 1 : 2) : undefined)];
            case 1:
                newRelatedPerson = _c.sent();
                return [3 /*break*/, 4];
            case 2:
                console.log('Updating the RelatedPerson.');
                return [4 /*yield*/, updateRelatedPerson(relatedPerson, relatedPersonData, oystehr)];
            case 3:
                newRelatedPerson = _c.sent();
                _c.label = 4;
            case 4: return [2 /*return*/, newRelatedPerson];
        }
    });
}); };
exports.createOrUpdateRelatedPerson = createOrUpdateRelatedPerson;
var createRelatedPerson = function (patient, data, oystehr, eligibility) { return __awaiter(void 0, void 0, void 0, function () {
    var code, address, relatedPerson;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                code = '';
                switch (data.relationship) {
                    case 'Father':
                        code = 'FTH';
                        break;
                    case 'Mother':
                        code = 'MTH';
                        break;
                    case 'Parent':
                        code = 'PRN';
                        break;
                    case 'Spouse':
                        code = 'SPS';
                        break;
                    case 'Sibling':
                        code = 'SIB';
                        break;
                    case 'Other':
                        code = 'O';
                        break;
                    default:
                        code = 'CHILD';
                        break;
                }
                address = [
                    {
                        line: data.address ? [data.address] : [],
                        city: data.city,
                        state: data.state,
                        postalCode: data.zip,
                        country: 'US',
                    },
                ];
                return [4 /*yield*/, oystehr.fhir.create({
                        resourceType: 'RelatedPerson',
                        patient: { reference: "Patient/".concat(patient.id) },
                        name: (0, utils_1.createFhirHumanName)(data.firstName, data.middleName, data.lastName),
                        birthDate: data.dob,
                        gender: getGender(data.sex),
                        address: address,
                        relationship: [
                            {
                                coding: [
                                    {
                                        code: code,
                                        display: data.relationship ? data.relationship : 'Child',
                                        system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                                    },
                                ],
                            },
                        ],
                        meta: eligibility
                            ? {
                                tag: [
                                    {
                                        code: "".concat(utils_1.ELIGIBILITY_RELATED_PERSON_META_TAG, "_").concat(eligibility),
                                    },
                                ],
                            }
                            : undefined,
                    })];
            case 1:
                relatedPerson = _a.sent();
                return [2 /*return*/, relatedPerson];
        }
    });
}); };
var createPatchOperation = function (path, value, existing) {
    if (value != null) {
        if (existing != null) {
            // Replace
            return {
                op: 'replace',
                path: path,
                value: value,
            };
        }
        else {
            // Add
            return {
                op: 'add',
                path: path,
                value: value,
            };
        }
    }
    else {
        if (existing != null) {
            // Remove
            return {
                op: 'remove',
                path: path,
            };
        }
        else {
            // Leave it
            return undefined;
        }
    }
};
var updateRelatedPerson = function (relatedPerson, data, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var gender, operations, existingDetails, nameOp, operation, operation, operation, operation, operation, operation, codingIndex, relationshipIndex, relationshipIndexToUse, codingIndexToUse, code, display, path, updatedRelatedPerson;
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    return __generator(this, function (_m) {
        switch (_m.label) {
            case 0:
                if (relatedPerson.id == null) {
                    throw new Error("RelatedPerson can't be missing an ID.");
                }
                gender = getGender(data.sex);
                operations = [];
                existingDetails = {
                    givenNames: (_a = relatedPerson.name) === null || _a === void 0 ? void 0 : _a[0].given,
                    lastName: (_b = relatedPerson.name) === null || _b === void 0 ? void 0 : _b[0].family,
                    dob: relatedPerson.birthDate,
                    gender: relatedPerson.gender,
                    address: (_d = (_c = relatedPerson.address) === null || _c === void 0 ? void 0 : _c[0].line) === null || _d === void 0 ? void 0 : _d[0],
                    city: (_e = relatedPerson.address) === null || _e === void 0 ? void 0 : _e[0].city,
                    state: (_f = relatedPerson.address) === null || _f === void 0 ? void 0 : _f[0].state,
                    zip: (_g = relatedPerson.address) === null || _g === void 0 ? void 0 : _g[0].postalCode,
                };
                nameOp = createPatchOperation('/name', (0, utils_1.createFhirHumanName)(data.firstName, data.middleName, data.lastName), existingDetails.givenNames || existingDetails.lastName);
                if (nameOp)
                    operations.push(nameOp);
                if (data.dob !== existingDetails.dob) {
                    operation = createPatchOperation('/birthDate', data.dob, existingDetails.dob);
                    if (operation)
                        operations.push(operation);
                }
                if (gender !== existingDetails.gender) {
                    operation = createPatchOperation('/gender', gender, existingDetails.gender);
                    if (operation)
                        operations.push(operation);
                }
                if (data.address !== existingDetails.address) {
                    operation = createPatchOperation('/address/0/line', data.address ? [data.address] : [], existingDetails.address);
                    if (operation)
                        operations.push(operation);
                }
                if (data.city !== existingDetails.city) {
                    operation = createPatchOperation('/address/0/city', data.city, existingDetails.city);
                    if (operation)
                        operations.push(operation);
                }
                if (data.state !== existingDetails.state) {
                    operation = createPatchOperation('/address/0/state', data.state, existingDetails.state);
                    if (operation)
                        operations.push(operation);
                }
                if (data.zip !== existingDetails.zip) {
                    operation = createPatchOperation('/address/0/postalCode', data.zip, existingDetails.zip);
                    if (operation)
                        operations.push(operation);
                }
                codingIndex = -1;
                relationshipIndex = (_j = (_h = relatedPerson.relationship) === null || _h === void 0 ? void 0 : _h.findIndex(function (relationship) {
                    var _a;
                    var index = (_a = relationship.coding) === null || _a === void 0 ? void 0 : _a.findIndex(function (coding) { return coding.system === 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype'; });
                    if (index != null && index >= 0) {
                        codingIndex = index;
                        return true;
                    }
                    return false;
                })) !== null && _j !== void 0 ? _j : -1;
                relationshipIndexToUse = relationshipIndex > -1 ? relationshipIndex : 0;
                codingIndexToUse = codingIndex > -1 ? codingIndex : 0;
                if (data.relationship !== ((_l = (_k = relatedPerson.relationship) === null || _k === void 0 ? void 0 : _k[relationshipIndexToUse].coding) === null || _l === void 0 ? void 0 : _l[codingIndexToUse].display)) {
                    code = '';
                    switch (data.relationship) {
                        case 'Father':
                            code = 'FTH';
                            break;
                        case 'Mother':
                            code = 'MTH';
                            break;
                        case 'Parent':
                            code = 'PRN';
                            break;
                        case 'Spouse':
                            code = 'SPS';
                            break;
                        case 'Sibling':
                            code = 'SIB';
                            break;
                        case 'Other':
                            code = 'O';
                            break;
                        default:
                            code = 'CHILD';
                            break;
                    }
                    display = 'Child';
                    if (data.relationship)
                        display = data.relationship;
                    path = "/relationship/".concat(relationshipIndexToUse, "/coding/").concat(codingIndexToUse);
                    operations.push({
                        op: 'add',
                        path: "".concat(path, "/code"),
                        value: code,
                    });
                    operations.push({
                        op: 'add',
                        path: "".concat(path, "/display"),
                        value: display,
                    });
                }
                if (operations.length === 0)
                    return [2 /*return*/, relatedPerson];
                console.log('Updating RelatedPerson with:', operations);
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'RelatedPerson',
                        id: relatedPerson.id,
                        operations: operations,
                    })];
            case 1:
                updatedRelatedPerson = _m.sent();
                return [2 /*return*/, updatedRelatedPerson];
        }
    });
}); };
