"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useEditPatientBirthDateMutation = void 0;
var react_query_1 = require("react-query");
var useAppClients_1 = require("../../hooks/useAppClients");
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useEditPatientBirthDateMutation = function () {
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
                        path: '/birthDate',
                        value: patientData.birthDate,
                    },
                ],
            });
        },
        onError: function (err) {
            console.error('Error during updating patient date of birth: ', err);
        },
    });
};
exports.useEditPatientBirthDateMutation = useEditPatientBirthDateMutation;
//# sourceMappingURL=useEditPatientBirthDateMutation.js.map