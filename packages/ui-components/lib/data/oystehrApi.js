import { chooseJson, } from 'utils';
const zambdasPublicityMap = {
    'cancel appointment': false,
    'check in': true,
    'create appointment': false,
    'delete payment method': false,
    'get appointments': false,
    'get past visits': false,
    'get eligibility': false,
    'get visit details': false,
    'get answer options': false,
    'get schedule': true,
    'get paperwork': true,
    'get patients': false,
    'get patient balances': false,
    'get payment methods': false,
    'get presigned file url': true,
    'get telemed states': true,
    'get wait status': true,
    'join call': true,
    'setup payment method': false,
    'set default payment method': false,
    'update appointment': false,
    'patch paperwork': true,
    'submit paperwork': true,
    'video chat cancel invite': false,
    'video chat create invite': false,
    'video chat list invites': false,
    'list bookables': true,
};
export const getOystehrAPI = (params, oystehr) => {
    const { cancelAppointmentZambdaID, checkInZambdaID, createAppointmentZambdaID, deletePaymentMethodZambdaID, getAppointmentsZambdaID, getPastVisitsZambdaID, getEligibilityZambdaID, getVisitDetailsZambdaID, getAnswerOptionsZambdaID, getScheduleZambdaID, getPaperworkZambdaID, getPatientsZambdaID, getPatientBalancesZambdaID, getPaymentMethodsZambdaID, getPresignedFileURLZambdaID, getTelemedLocationsZambdaID: getTelemedStatesZambdaID, getWaitStatusZambdaID, joinCallZambdaID, setDefaultPaymentMethodZambdaID, setupPaymentMethodZambdaID, updateAppointmentZambdaID, patchPaperworkZambdaID, submitPaperworkZambdaID, videoChatCancelInviteZambdaID, videoChatCreateInviteZambdaID, videoChatListInvitesZambdaID, listBookablesZambdaID, } = params;
    const zambdasToIdsMap = {
        'cancel appointment': cancelAppointmentZambdaID,
        'check in': checkInZambdaID,
        'create appointment': createAppointmentZambdaID,
        'delete payment method': deletePaymentMethodZambdaID,
        'get appointments': getAppointmentsZambdaID,
        'get past visits': getPastVisitsZambdaID,
        'get eligibility': getEligibilityZambdaID,
        'get visit details': getVisitDetailsZambdaID,
        'get answer options': getAnswerOptionsZambdaID,
        'get schedule': getScheduleZambdaID,
        'get paperwork': getPaperworkZambdaID,
        'get patients': getPatientsZambdaID,
        'get patient balances': getPatientBalancesZambdaID,
        'get payment methods': getPaymentMethodsZambdaID,
        'get presigned file url': getPresignedFileURLZambdaID,
        'get telemed states': getTelemedStatesZambdaID,
        'get wait status': getWaitStatusZambdaID,
        'join call': joinCallZambdaID,
        'set default payment method': setDefaultPaymentMethodZambdaID,
        'setup payment method': setupPaymentMethodZambdaID,
        'update appointment': updateAppointmentZambdaID,
        'patch paperwork': patchPaperworkZambdaID,
        'submit paperwork': submitPaperworkZambdaID,
        'video chat cancel invite': videoChatCancelInviteZambdaID,
        'video chat create invite': videoChatCreateInviteZambdaID,
        'video chat list invites': videoChatListInvitesZambdaID,
        'list bookables': listBookablesZambdaID,
    };
    const isAppLocalProvided = params.isAppLocal != null;
    const verifyZambdaProvidedAndNotLocalThrowErrorOtherwise = (zambdaID, zambdaName) => {
        if (zambdaID === undefined || !isAppLocalProvided) {
            throw new Error(`${zambdaName} zambda environment variable could not be loaded`);
        }
        return true;
    };
    const makeZapRequest = async (zambdaName, payload, additionalErrorHandler) => {
        const zambdaId = zambdasToIdsMap[zambdaName];
        try {
            if (verifyZambdaProvidedAndNotLocalThrowErrorOtherwise(zambdaId, zambdaName)) {
                let zambdaPromise;
                if (zambdasPublicityMap[zambdaName]) {
                    zambdaPromise = oystehr.zambda.executePublic({ id: zambdaId, ...payload });
                }
                else {
                    zambdaPromise = oystehr.zambda.execute({ id: zambdaId, ...payload });
                }
                const response = await zambdaPromise;
                const jsonToUse = chooseJson(response);
                return jsonToUse;
            }
            // won't be reached, but for TS to give the right return type
            throw Error();
        }
        catch (error) {
            if (additionalErrorHandler) {
                additionalErrorHandler(error);
            }
            throw apiErrorToThrow(error);
        }
    };
    // Zambdas
    const cancelAppointment = async (parameters) => {
        return await makeZapRequest('cancel appointment', parameters, NotFoundAppointmentErrorHandler);
    };
    const checkIn = async (appointmentId) => {
        return await makeZapRequest('check in', { appointment: appointmentId }, NotFoundAppointmentErrorHandler);
    };
    const createAppointment = async (parameters) => {
        return await makeZapRequest('create appointment', parameters);
    };
    const createZ3Object = async (appointmentID, fileType, fileFormat, file) => {
        try {
            const presignedURLRequest = await getPresignedFileURL(appointmentID, fileType, fileFormat);
            // const presignedURLResponse = await presignedURLRequest.json();
            // Upload the file to S3
            const uploadResponse = await fetch(presignedURLRequest.presignedURL, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type,
                },
                body: file,
            });
            if (!uploadResponse.ok) {
                throw new Error('Failed to upload file');
            }
            return presignedURLRequest;
        }
        catch (error) {
            throw apiErrorToThrow(error);
        }
    };
    const deletePaymentMethod = async (parameters) => {
        return await makeZapRequest('delete payment method', parameters);
    };
    const getAppointments = async (parameters) => {
        return await makeZapRequest('get appointments', parameters);
    };
    const getPastVisits = async (parameters) => {
        return await makeZapRequest('get past visits', parameters);
    };
    const getEligibility = async (parameters) => {
        return await makeZapRequest('get eligibility', parameters);
    };
    const getVisitDetails = async (parameters) => {
        return await makeZapRequest('get visit details', parameters, NotFoundAppointmentErrorHandler);
    };
    const getAnswerOptions = async (parameters) => {
        return await makeZapRequest('get answer options', parameters);
    };
    const getSchedule = async (parameters) => {
        return await makeZapRequest('get schedule', parameters);
    };
    const getPaperworkPublic = async (parameters) => {
        return await makeZapRequest('get paperwork', parameters, NotFoundAppointmentErrorHandler);
    };
    const getPaperwork = async (parameters) => {
        return await makeZapRequest('get paperwork', parameters, NotFoundAppointmentErrorHandler);
    };
    const getPatients = async () => {
        return await makeZapRequest('get patients');
    };
    const getPatientBalances = async (parameters) => {
        return await makeZapRequest('get patient balances', parameters);
    };
    const getPaymentMethods = async (parameters) => {
        return await makeZapRequest('get payment methods', parameters);
    };
    const getPresignedFileURL = async (appointmentID, fileType, fileFormat) => {
        const payload = {
            appointmentID,
            fileType,
            fileFormat,
        };
        return await makeZapRequest('get presigned file url', payload);
    };
    const getTelemedStates = async () => {
        return await makeZapRequest('get telemed states');
    };
    const getWaitStatus = async (parameters) => {
        return await makeZapRequest('get wait status', parameters);
    };
    const joinCall = async (parameters) => {
        return await makeZapRequest('join call', parameters);
    };
    const setDefaultPaymentMethod = async (parameters) => {
        return await makeZapRequest('set default payment method', parameters);
    };
    const setupPaymentMethod = async (parameters) => {
        return await makeZapRequest('setup payment method', parameters);
    };
    const updateAppointment = async (parameters) => {
        return await makeZapRequest('update appointment', parameters);
    };
    const patchPaperwork = async (parameters) => {
        const payload = Object.fromEntries(Object.entries(parameters).filter(([_parameterKey, parameterValue]) => parameterValue && !Object.values(parameterValue).every((tempValue) => tempValue === undefined)));
        return await makeZapRequest('patch paperwork', payload);
    };
    const submitPaperwork = async (parameters) => {
        const payload = Object.fromEntries(Object.entries(parameters).filter(([_parameterKey, parameterValue]) => parameterValue && !Object.values(parameterValue).every((tempValue) => tempValue === undefined)));
        return await makeZapRequest('submit paperwork', payload);
    };
    const videoChatCancelInvite = async (parameters) => {
        return await makeZapRequest('video chat cancel invite', parameters);
    };
    const videoChatCreateInvite = async (parameters) => {
        return await makeZapRequest('video chat create invite', parameters);
    };
    const videoChatListInvites = async (parameters) => {
        return await makeZapRequest('video chat list invites', parameters);
    };
    const listBookables = async (parameters) => {
        return await makeZapRequest('list bookables', parameters);
    };
    return {
        cancelAppointment,
        checkIn,
        createAppointment,
        createZ3Object,
        deletePaymentMethod,
        getAppointments,
        getPastVisits,
        getEligibility,
        getVisitDetails,
        getAnswerOptions,
        getSchedule,
        getPaperworkPublic,
        getPaperwork,
        getPatients,
        getPatientBalances,
        getPaymentMethods,
        getTelemedStates,
        getWaitStatus,
        joinCall,
        setDefaultPaymentMethod,
        setupPaymentMethod,
        updateAppointment,
        patchPaperwork,
        submitPaperwork,
        videoChatCancelInvite,
        videoChatCreateInvite,
        videoChatListInvites,
        listBookables,
    };
};
const InternalError = {
    message: 'Internal Service Error',
};
const isApiError = (error) => error instanceof Object && error && 'message' in error;
export const apiErrorToThrow = (error) => {
    console.error(`Top level catch block:\nError: ${error}\nError stringified: ${JSON.stringify(error)}`);
    if (isApiError(error)) {
        return error;
    }
    else {
        console.error('An endpoint threw and did not provide a well formed ApiError');
        return InternalError;
    }
};
function NotFoundAppointmentErrorHandler(error) {
    if (error.message === 'Appointment is not found') {
        throw error;
    }
}
//# sourceMappingURL=oystehrApi.js.map