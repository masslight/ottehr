"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var task = JSON.parse(input.body);
    if (task.resourceType !== 'Task') {
        throw new Error("resource parsed should be a task but was a ".concat(task.resourceType));
    }
    if (task.status === 'completed') {
        throw new Error("task is already completed");
    }
    if (task.status === 'failed') {
        throw new Error("task has already failed");
    }
    if (!input.secrets) {
        throw new Error('Secrets not sent with input.');
    }
    return {
        task: task,
        secrets: input.secrets,
    };
}
