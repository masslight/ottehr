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
exports.location = exports.DEFAULT_TEST_TIMEOUT = void 0;
var utils_1 = require("utils");
var vitest_1 = require("vitest");
exports.DEFAULT_TEST_TIMEOUT = 100000;
exports.location = '71bc5925-65d6-471f-abd0-be357043172a';
var contactArray = [
    {
        telecom: [
            {
                value: 'ykulik+up1@masslight.com',
                system: 'email',
            },
            {
                value: '1212121212',
                system: 'phone',
            },
        ],
        relationship: [
            {
                coding: [
                    {
                        code: 'Parent/Guardian',
                        system: 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship',
                        display: 'Parent/Guardian',
                    },
                ],
            },
        ],
    },
    {
        name: {
            use: 'usual',
            given: ['Yevheniia'],
            family: 'Yevheniia',
        },
        telecom: [
            {
                use: 'mobile',
                rank: 1,
                value: '5555555555',
                system: 'phone',
            },
        ],
        relationship: [
            {
                coding: [
                    {
                        code: 'BP',
                        system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
                        display: 'Billing contact person',
                    },
                ],
            },
        ],
    },
];
describe('appointments tests', function () {
    vitest_1.vi.setConfig({ testTimeout: exports.DEFAULT_TEST_TIMEOUT });
    test('Codings equal = true when codings equal', function () { return __awaiter(void 0, void 0, void 0, function () {
        var coding1, indexOfCurrent, currentBillingContact;
        return __generator(this, function (_a) {
            coding1 = {
                code: 'BP',
                system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
                display: 'Billing contact person',
            };
            indexOfCurrent = contactArray.findIndex(function (contactEntry) {
                var _a;
                return (_a = contactEntry.relationship) === null || _a === void 0 ? void 0 : _a.some(function (relationship) {
                    var _a, _b;
                    var coding = ((_a = relationship.coding) !== null && _a !== void 0 ? _a : []);
                    console.log('coding', coding);
                    return (0, utils_1.codingsEqual)(((_b = coding[0]) !== null && _b !== void 0 ? _b : {}), coding1);
                });
            });
            currentBillingContact = contactArray[indexOfCurrent];
            (0, vitest_1.expect)(indexOfCurrent).toBe(1);
            (0, vitest_1.expect)(currentBillingContact).toBeDefined();
            return [2 /*return*/];
        });
    }); });
});
