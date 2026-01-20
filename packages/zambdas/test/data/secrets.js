"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SECRETS = void 0;
var local_json_1 = require("../../.env/local.json");
exports.SECRETS = {
    FHIR_API: local_json_1.FHIR_API,
    AUTH0_ENDPOINT: local_json_1.AUTH0_ENDPOINT,
    AUTH0_AUDIENCE: local_json_1.AUTH0_AUDIENCE,
    AUTH0_CLIENT_TESTS: local_json_1.AUTH0_CLIENT_TESTS,
    AUTH0_SECRET_TESTS: local_json_1.AUTH0_SECRET_TESTS,
    PROJECT_API: local_json_1.PROJECT_API,
    PROJECT_ID: local_json_1.PROJECT_ID,
};
