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
exports.createPresignedUrl = createPresignedUrl;
exports.uploadObjectToZ3 = uploadObjectToZ3;
exports.deleteZ3Object = deleteZ3Object;
var retry_1 = require("retry");
var utils_1 = require("utils");
function createPresignedUrl(token, baseUploadURL, action) {
    return __awaiter(this, void 0, void 0, function () {
        var presignedURLRequest, presignedURLResponse;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch(baseUploadURL, {
                        method: 'POST',
                        headers: {
                            authorization: "Bearer ".concat(token),
                        },
                        body: JSON.stringify({ action: action }),
                    })];
                case 1:
                    presignedURLRequest = _a.sent();
                    return [4 /*yield*/, presignedURLRequest.json()];
                case 2:
                    presignedURLResponse = _a.sent();
                    if (!presignedURLRequest.ok) {
                        console.log(presignedURLResponse);
                        throw new Error("Failed to get presigned url: ".concat(presignedURLRequest.statusText));
                    }
                    return [2 /*return*/, presignedURLResponse.signedUrl];
            }
        });
    });
}
function uploadObjectToZ3(fileBytes, presignedUploadUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var operation;
        var _this = this;
        return __generator(this, function (_a) {
            operation = retry_1.default.operation({
                retries: 3,
                factor: 2,
                minTimeout: 2000,
                maxTimeout: 10000,
                randomize: true,
            });
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    operation.attempt(function (currentAttempt) { return __awaiter(_this, void 0, void 0, function () {
                        var uploadRequest, error, error_1, errorMessage, errorObj;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    console.log("uploadObjectToZ3: Attempt ".concat(currentAttempt, "/4"));
                                    return [4 /*yield*/, fetch(presignedUploadUrl, {
                                            method: 'PUT',
                                            headers: {
                                                'Content-Type': utils_1.MIME_TYPES.PDF,
                                            },
                                            body: fileBytes,
                                        })];
                                case 1:
                                    uploadRequest = _a.sent();
                                    if (!uploadRequest.ok) {
                                        error = new Error("Upload request was not OK: ".concat(uploadRequest.status, " ").concat(uploadRequest.statusText));
                                        console.error("uploadObjectToZ3: HTTP error ".concat(uploadRequest.status, ", not retrying"));
                                        reject(error);
                                        return [2 /*return*/];
                                    }
                                    console.log("uploadObjectToZ3: Successfully uploaded on attempt ".concat(currentAttempt));
                                    resolve();
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_1 = _a.sent();
                                    errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                                    console.info("uploadObjectToZ3: Network error on attempt ".concat(currentAttempt, ":"), errorMessage);
                                    errorObj = error_1 instanceof Error ? error_1 : new Error(String(error_1));
                                    if (!operation.retry(errorObj)) {
                                        console.error("uploadObjectToZ3: All ".concat(currentAttempt, " attempts failed with network errors"));
                                        reject(operation.mainError());
                                    }
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                })];
        });
    });
}
function deleteZ3Object(baseFileUrl, token) {
    return __awaiter(this, void 0, void 0, function () {
        var deleteRequest;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch(baseFileUrl, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            authorization: "Bearer ".concat(token),
                        },
                    })];
                case 1:
                    deleteRequest = _a.sent();
                    if (!deleteRequest.ok) {
                        throw new Error("Delete request was not OK: ".concat(deleteRequest.statusText));
                    }
                    return [2 /*return*/];
            }
        });
    });
}
