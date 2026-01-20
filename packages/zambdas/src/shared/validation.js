"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.phoneRegex = void 0;
exports.safeValidate = safeValidate;
exports.formatZodError = formatZodError;
var zod_1 = require("zod");
var zod_validation_error_1 = require("zod-validation-error");
// Phone number regex
// ^(\+1)? match an optional +1 at the beginning of the string
// \d{10}$ match exactly 10 digits at the end of the string
exports.phoneRegex = /^(\+1)?\d{10}$/;
function safeValidate(schema, input) {
    try {
        return schema.parse(input);
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            var formatted = (0, zod_validation_error_1.fromZodError)(error);
            console.error('[Validation Error]', formatted.message);
            throw new Error(formatted.message);
        }
        if (error instanceof Error) {
            console.error('[Unknown Validation Error]', error.message);
            throw error;
        }
        console.error('[Unknown Validation Error]', error);
        throw new Error('Unknown validation error');
    }
}
function formatZodError(err) {
    return err.errors.map(function (e) { return "".concat(e.path.length ? e.path.join('.') : '(root)', ": ").concat(e.message); }).join('; ');
}
