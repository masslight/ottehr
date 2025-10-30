// export const useGetPrefilledInvoiceInfo = (
//   {
//     apiClient,
//     patientId,
//   }: {
//     apiClient: OystehrTelemedAPIClient | null;
//     patientId: string | null;
//   },
//   onSuccess?: (data: PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientCoverages']>> | null) => void
// ): UseQueryResult<PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientCoverages']>>, Error> => {
//   const queryResult = useQuery({
//     queryKey: ['patient-coverages', { apiClient, patientId }],
//     queryFn: () => {
//       return apiClient!.getPatientCoverages({
//         patientId: patientId!,
//       });
//     },
//     enabled: apiClient != null && patientId != null,
//   });
//
//   useSuccessQuery(queryResult.data, onSuccess);
//
//   return queryResult;
// };
