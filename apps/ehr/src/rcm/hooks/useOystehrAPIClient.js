"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useOystehrAPIClient = void 0;
var react_1 = require("react");
var useAppClients_1 = require("../../hooks/useAppClients");
var data_1 = require("../data");
var useOystehrAPIClient = function () {
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var apiClient = (0, react_1.useMemo)(function () {
        if (oystehrZambda)
            return (0, data_1.getOystehr_RCM_API)({
                getClaimsZambdaID: import.meta.env.VITE_APP_GET_CLAIMS_ZAMBDA_ID,
                isAppLocal: import.meta.env.VITE_APP_IS_LOCAL,
            }, oystehrZambda);
        return null;
    }, [oystehrZambda]);
    return apiClient;
};
exports.useOystehrAPIClient = useOystehrAPIClient;
//# sourceMappingURL=useOystehrAPIClient.js.map