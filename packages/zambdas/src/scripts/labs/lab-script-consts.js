"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DR_REFLEX_TAG = exports.DR_UNSOLICITED_RESULT_TAG = exports.EXAMPLE_ENVS = void 0;
var utils_1 = require("utils");
exports.EXAMPLE_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production', 'etc'];
exports.DR_UNSOLICITED_RESULT_TAG = {
    system: utils_1.LAB_DR_TYPE_TAG.system,
    code: utils_1.LAB_DR_TYPE_TAG.code.unsolicited,
    display: utils_1.LAB_DR_TYPE_TAG.display.unsolicited,
};
exports.DR_REFLEX_TAG = {
    system: utils_1.LAB_DR_TYPE_TAG.system,
    code: utils_1.LAB_DR_TYPE_TAG.code.reflex,
    display: utils_1.LAB_DR_TYPE_TAG.display.reflex,
};
