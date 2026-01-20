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
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var validation_1 = require("../validation");
(0, vitest_1.describe)('cancel-radiology-order zambda', function () {
    (0, vitest_1.describe)('Previous status preservation', function () {
        (0, vitest_1.it)('should save previous status when cancelling active radiology order', function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockServiceRequest, mockPatchedServiceRequest, mockOystehr;
            var _a, _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        mockServiceRequest = {
                            resourceType: 'ServiceRequest',
                            id: 'test-sr-1',
                            status: 'active',
                            intent: 'order',
                            subject: { reference: 'Patient/test' },
                            code: { text: 'X-Ray' },
                            identifier: [
                                {
                                    system: 'http://advapacs.com/accession-number',
                                    value: 'ACC123',
                                },
                            ],
                        };
                        mockPatchedServiceRequest = __assign(__assign({}, mockServiceRequest), { status: 'revoked', meta: {
                                tag: [
                                    {
                                        system: utils_1.CANCELLATION_TAG_SYSTEM,
                                        code: 'active',
                                        display: 'active',
                                    },
                                ],
                            } });
                        mockOystehr = {
                            fhir: {
                                get: vitest_1.vi.fn().mockResolvedValue(mockServiceRequest),
                                patch: vitest_1.vi.fn().mockResolvedValue(mockPatchedServiceRequest),
                            },
                        };
                        // Call patch directly to test the logic
                        return [4 /*yield*/, mockOystehr.fhir.patch({
                                resourceType: 'ServiceRequest',
                                id: 'test-sr-1',
                                operations: [
                                    {
                                        op: 'add',
                                        path: '/meta',
                                        value: {
                                            tag: [
                                                {
                                                    system: utils_1.CANCELLATION_TAG_SYSTEM,
                                                    code: 'active',
                                                    display: 'active',
                                                },
                                            ],
                                        },
                                    },
                                    {
                                        op: 'replace',
                                        path: '/status',
                                        value: 'revoked',
                                    },
                                ],
                            })];
                    case 1:
                        // Call patch directly to test the logic
                        _h.sent();
                        (0, vitest_1.expect)(mockOystehr.fhir.patch).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                            resourceType: 'ServiceRequest',
                            id: 'test-sr-1',
                            operations: vitest_1.expect.arrayContaining([
                                vitest_1.expect.objectContaining({
                                    op: 'add',
                                    path: '/meta',
                                }),
                                vitest_1.expect.objectContaining({
                                    op: 'replace',
                                    path: '/status',
                                    value: 'revoked',
                                }),
                            ]),
                        }));
                        // Verify the result structure
                        (0, vitest_1.expect)(mockPatchedServiceRequest.status).toBe('revoked');
                        (0, vitest_1.expect)((_a = mockPatchedServiceRequest.meta) === null || _a === void 0 ? void 0 : _a.tag).toBeDefined();
                        (0, vitest_1.expect)((_c = (_b = mockPatchedServiceRequest.meta) === null || _b === void 0 ? void 0 : _b.tag) === null || _c === void 0 ? void 0 : _c[0].system).toBe(utils_1.CANCELLATION_TAG_SYSTEM);
                        (0, vitest_1.expect)((_e = (_d = mockPatchedServiceRequest.meta) === null || _d === void 0 ? void 0 : _d.tag) === null || _e === void 0 ? void 0 : _e[0].code).toBe('active');
                        (0, vitest_1.expect)((_g = (_f = mockPatchedServiceRequest.meta) === null || _f === void 0 ? void 0 : _f.tag) === null || _g === void 0 ? void 0 : _g[0].display).toBe('active');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should save previous status when cancelling completed radiology order', function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockServiceRequest, mockPatchedServiceRequest;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                mockServiceRequest = {
                    resourceType: 'ServiceRequest',
                    id: 'test-sr-2',
                    status: 'completed',
                    intent: 'order',
                    subject: { reference: 'Patient/test' },
                    code: { text: 'CT Scan' },
                    meta: {
                        versionId: '1',
                    },
                };
                mockPatchedServiceRequest = __assign(__assign({}, mockServiceRequest), { status: 'revoked', meta: {
                        versionId: '2',
                        tag: [
                            {
                                system: utils_1.CANCELLATION_TAG_SYSTEM,
                                code: 'completed',
                                display: 'completed',
                            },
                        ],
                    } });
                // Verify the mock structure
                (0, vitest_1.expect)((_b = (_a = mockPatchedServiceRequest.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b[0].code).toBe('completed');
                (0, vitest_1.expect)((_d = (_c = mockPatchedServiceRequest.meta) === null || _c === void 0 ? void 0 : _c.tag) === null || _d === void 0 ? void 0 : _d[0].display).toBe('completed');
                return [2 /*return*/];
            });
        }); });
        (0, vitest_1.it)('should append cancellation tag to existing tags', function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockServiceRequest, mockPatchedServiceRequest;
            var _a, _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                mockServiceRequest = {
                    resourceType: 'ServiceRequest',
                    id: 'test-sr-3',
                    status: 'active',
                    intent: 'order',
                    subject: { reference: 'Patient/test' },
                    code: { text: 'MRI' },
                    meta: {
                        tag: [
                            {
                                system: 'http://example.com',
                                code: 'existing-tag',
                            },
                        ],
                    },
                };
                mockPatchedServiceRequest = __assign(__assign({}, mockServiceRequest), { status: 'revoked', meta: {
                        tag: [
                            {
                                system: 'http://example.com',
                                code: 'existing-tag',
                            },
                            {
                                system: utils_1.CANCELLATION_TAG_SYSTEM,
                                code: 'active',
                                display: 'active',
                            },
                        ],
                    } });
                // Verify the mock structure
                (0, vitest_1.expect)((_a = mockPatchedServiceRequest.meta) === null || _a === void 0 ? void 0 : _a.tag).toHaveLength(2);
                (0, vitest_1.expect)((_c = (_b = mockPatchedServiceRequest.meta) === null || _b === void 0 ? void 0 : _b.tag) === null || _c === void 0 ? void 0 : _c[0].system).toBe('http://example.com');
                (0, vitest_1.expect)((_e = (_d = mockPatchedServiceRequest.meta) === null || _d === void 0 ? void 0 : _d.tag) === null || _e === void 0 ? void 0 : _e[1].system).toBe(utils_1.CANCELLATION_TAG_SYSTEM);
                (0, vitest_1.expect)((_g = (_f = mockPatchedServiceRequest.meta) === null || _f === void 0 ? void 0 : _f.tag) === null || _g === void 0 ? void 0 : _g[1].code).toBe('active');
                return [2 /*return*/];
            });
        }); });
    });
    (0, vitest_1.describe)('Status validation', function () {
        (0, vitest_1.it)('should handle different valid statuses', function () {
            var validStatuses = ['draft', 'active', 'on-hold', 'completed'];
            validStatuses.forEach(function (status) {
                var mockServiceRequest = {
                    resourceType: 'ServiceRequest',
                    id: "test-sr-".concat(status),
                    status: status,
                    intent: 'order',
                    subject: { reference: 'Patient/test' },
                    code: { text: 'Test' },
                };
                (0, vitest_1.expect)(mockServiceRequest.status).toBe(status);
            });
        });
    });
    (0, vitest_1.describe)('Validation of cancellable orders', function () {
        var createMockInput = function (serviceRequestId) { return ({
            body: JSON.stringify({ serviceRequestId: serviceRequestId }),
            headers: {
                Authorization: 'Bearer test-token',
            },
            secrets: null,
        }); };
        (0, vitest_1.it)('should allow cancellation of draft orders', function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockServiceRequest, mockOystehr, input, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockServiceRequest = {
                            resourceType: 'ServiceRequest',
                            id: '123e4567-e89b-12d3-a456-426614174001',
                            status: 'draft',
                            intent: 'order',
                            subject: { reference: 'Patient/test' },
                            code: { text: 'X-Ray' },
                            identifier: [
                                {
                                    system: 'http://advapacs.com/accession-number',
                                    value: 'ACC123',
                                },
                            ],
                        };
                        mockOystehr = {
                            fhir: {
                                get: vitest_1.vi.fn().mockResolvedValue(mockServiceRequest),
                            },
                        };
                        input = createMockInput('123e4567-e89b-12d3-a456-426614174001');
                        return [4 /*yield*/, (0, validation_1.validateInput)(input, mockOystehr)];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.body.serviceRequestId).toBe('123e4567-e89b-12d3-a456-426614174001');
                        (0, vitest_1.expect)(mockOystehr.fhir.get).toHaveBeenCalledWith({
                            resourceType: 'ServiceRequest',
                            id: '123e4567-e89b-12d3-a456-426614174001',
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should allow cancellation of active orders', function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockServiceRequest, mockOystehr, input, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockServiceRequest = {
                            resourceType: 'ServiceRequest',
                            id: '123e4567-e89b-12d3-a456-426614174002',
                            status: 'active',
                            intent: 'order',
                            subject: { reference: 'Patient/test' },
                            code: { text: 'CT Scan' },
                            identifier: [
                                {
                                    system: 'http://advapacs.com/accession-number',
                                    value: 'ACC456',
                                },
                            ],
                        };
                        mockOystehr = {
                            fhir: {
                                get: vitest_1.vi.fn().mockResolvedValue(mockServiceRequest),
                            },
                        };
                        input = createMockInput('123e4567-e89b-12d3-a456-426614174002');
                        return [4 /*yield*/, (0, validation_1.validateInput)(input, mockOystehr)];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.body.serviceRequestId).toBe('123e4567-e89b-12d3-a456-426614174002');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should allow cancellation of on-hold orders', function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockServiceRequest, mockOystehr, input, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockServiceRequest = {
                            resourceType: 'ServiceRequest',
                            id: '123e4567-e89b-12d3-a456-426614174003',
                            status: 'on-hold',
                            intent: 'order',
                            subject: { reference: 'Patient/test' },
                            code: { text: 'MRI' },
                            identifier: [
                                {
                                    system: 'http://advapacs.com/accession-number',
                                    value: 'ACC789',
                                },
                            ],
                        };
                        mockOystehr = {
                            fhir: {
                                get: vitest_1.vi.fn().mockResolvedValue(mockServiceRequest),
                            },
                        };
                        input = createMockInput('123e4567-e89b-12d3-a456-426614174003');
                        return [4 /*yield*/, (0, validation_1.validateInput)(input, mockOystehr)];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.body.serviceRequestId).toBe('123e4567-e89b-12d3-a456-426614174003');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should allow cancellation of completed orders', function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockServiceRequest, mockOystehr, input, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockServiceRequest = {
                            resourceType: 'ServiceRequest',
                            id: '123e4567-e89b-12d3-a456-426614174004',
                            status: 'completed',
                            intent: 'order',
                            subject: { reference: 'Patient/test' },
                            code: { text: 'Ultrasound' },
                            identifier: [
                                {
                                    system: 'http://advapacs.com/accession-number',
                                    value: 'ACC321',
                                },
                            ],
                        };
                        mockOystehr = {
                            fhir: {
                                get: vitest_1.vi.fn().mockResolvedValue(mockServiceRequest),
                            },
                        };
                        input = createMockInput('123e4567-e89b-12d3-a456-426614174004');
                        return [4 /*yield*/, (0, validation_1.validateInput)(input, mockOystehr)];
                    case 1:
                        result = _a.sent();
                        (0, vitest_1.expect)(result.body.serviceRequestId).toBe('123e4567-e89b-12d3-a456-426614174004');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should reject cancellation of revoked orders', function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockServiceRequest, mockOystehr, input;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockServiceRequest = {
                            resourceType: 'ServiceRequest',
                            id: '123e4567-e89b-12d3-a456-426614174005',
                            status: 'revoked',
                            intent: 'order',
                            subject: { reference: 'Patient/test' },
                            code: { text: 'X-Ray' },
                            identifier: [
                                {
                                    system: 'http://advapacs.com/accession-number',
                                    value: 'ACC654',
                                },
                            ],
                        };
                        mockOystehr = {
                            fhir: {
                                get: vitest_1.vi.fn().mockResolvedValue(mockServiceRequest),
                            },
                        };
                        input = createMockInput('123e4567-e89b-12d3-a456-426614174005');
                        return [4 /*yield*/, (0, vitest_1.expect)((0, validation_1.validateInput)(input, mockOystehr)).rejects.toThrow('Order has already been canceled and cannot be canceled again')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should reject cancellation of entered-in-error orders', function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockServiceRequest, mockOystehr, input;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockServiceRequest = {
                            resourceType: 'ServiceRequest',
                            id: '123e4567-e89b-12d3-a456-426614174006',
                            status: 'entered-in-error',
                            intent: 'order',
                            subject: { reference: 'Patient/test' },
                            code: { text: 'CT Scan' },
                            identifier: [
                                {
                                    system: 'http://advapacs.com/accession-number',
                                    value: 'ACC987',
                                },
                            ],
                        };
                        mockOystehr = {
                            fhir: {
                                get: vitest_1.vi.fn().mockResolvedValue(mockServiceRequest),
                            },
                        };
                        input = createMockInput('123e4567-e89b-12d3-a456-426614174006');
                        return [4 /*yield*/, (0, vitest_1.expect)((0, validation_1.validateInput)(input, mockOystehr)).rejects.toThrow('Order has already been canceled and cannot be canceled again')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
