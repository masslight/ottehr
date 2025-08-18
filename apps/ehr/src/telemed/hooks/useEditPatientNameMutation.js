"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useEditPatientNameMutation = void 0;
var react_query_1 = require("react-query");
var useAppClients_1 = require("../../hooks/useAppClients");
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useEditPatientNameMutation = function () {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useMutation)({
        mutationFn: function (_a) {
            var _b;
            var patientData = _a.patientData;
            if (!oystehr) {
                throw new Error('Oystehr not found');
            }
            return oystehr.fhir.patch({
                resourceType: 'Patient',
                id: (_b = patientData.id) !== null && _b !== void 0 ? _b : '',
                operations: [
                    {
                        op: 'replace',
                        path: '/name',
                        value: patientData.name,
                    },
                ],
            });
        },
        onError: function (err) {
            console.error('Error during editing patient name: ', err);
        },
    });
};
exports.useEditPatientNameMutation = useEditPatientNameMutation;
//# sourceMappingURL=useEditPatientNameMutation.js.map