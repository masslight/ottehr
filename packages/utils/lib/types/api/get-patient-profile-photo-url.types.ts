import { z } from 'zod';
import { Secrets } from '../../secrets';

export interface GetOrUploadPatientProfilePhotoZambdaResponse {
  z3ImageUrl: string;
  presignedImageUrl: string;
}

const UploadInputSchema = z.object({
  action: z.literal('upload'),
  patientId: z.string(),
});

export type UploadPatientProfilePhotoInput = z.infer<typeof UploadInputSchema>;

const DownloadInputSchema = z.object({
  action: z.literal('download'),
  z3PhotoUrl: z.string(),
});

export type DownloadPatientProfilePhotoInput = z.infer<typeof DownloadInputSchema>;

export const GetOrUploadPatientProfilePhotoInputSchema = z.discriminatedUnion('action', [
  UploadInputSchema,
  DownloadInputSchema,
]);

export type GetOrUploadPatientProfilePhotoInput = z.infer<typeof GetOrUploadPatientProfilePhotoInputSchema>;

export type GetOrUploadPatientProfilePhotoInputValidated = GetOrUploadPatientProfilePhotoInput & {
  secrets: Secrets | null;
};
