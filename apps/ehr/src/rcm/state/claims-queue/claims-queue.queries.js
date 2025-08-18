"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useGetClaims = void 0;
var react_query_1 = require("react-query");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var claims_queue_store_1 = require("./claims-queue.store");
var useGetClaims = function (_a) {
    var apiClient = _a.apiClient, onSuccess = _a.onSuccess;
    var params = (0, getSelectors_1.getSelectors)(claims_queue_store_1.useClaimsQueueStore, [
        'patient',
        'visitId',
        'claimId',
        'teamMember',
        'queue',
        'dayInQueue',
        'status',
        'state',
        'facilityGroup',
        'facility',
        'insurance',
        'balance',
        'dosFrom',
        'dosTo',
        'offset',
        'pageSize',
    ]);
    return (0, react_query_1.useQuery)(['rcm-claims-queue', apiClient, params], function () {
        if (apiClient) {
            return apiClient.getClaims(params);
        }
        throw new Error('api client not defined');
    }, {
        onError: function (err) {
            console.error('Error during fetching get claims: ', err);
        },
        onSuccess: onSuccess,
        enabled: !!apiClient,
    });
};
exports.useGetClaims = useGetClaims;
//# sourceMappingURL=claims-queue.queries.js.map