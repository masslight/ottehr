"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useApiClients = useApiClients;
var sdk_1 = require("@oystehr/sdk");
var react_1 = require("react");
var zustand_1 = require("zustand");
var useAuthToken_1 = require("./useAuthToken");
var useApiClientsStore = (0, zustand_1.create)()(function () { return ({
    oystehr: undefined,
    oystehrZambda: undefined,
}); });
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function useApiClients() {
    var token = (0, useAuthToken_1.useAuthToken)();
    var _a = useApiClientsStore(function (state) { return state; }), oystehr = _a.oystehr, oystehrZambda = _a.oystehrZambda;
    (0, react_1.useEffect)(function () {
        if (!oystehr || oystehr.config.accessToken !== token) {
            useApiClientsStore.setState({
                oystehr: new sdk_1.default({
                    accessToken: token,
                    fhirApiUrl: import.meta.env.VITE_APP_FHIR_API_URL,
                    projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
                    projectId: import.meta.env.VITE_APP_PROJECT_ID,
                }),
            });
        }
    }, [oystehr, token]);
    (0, react_1.useEffect)(function () {
        if (!oystehrZambda || oystehrZambda.config.accessToken !== token) {
            useApiClientsStore.setState({
                oystehrZambda: new sdk_1.default({
                    accessToken: token,
                    fhirApiUrl: import.meta.env.VITE_APP_FHIR_API_URL,
                    projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_ZAMBDA_URL,
                    projectId: import.meta.env.VITE_APP_PROJECT_ID,
                }),
            });
        }
    }, [oystehrZambda, token]);
    return { oystehr: oystehr, oystehrZambda: oystehrZambda };
}
//# sourceMappingURL=useAppClients.js.map