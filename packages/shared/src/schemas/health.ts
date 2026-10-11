import { z } from 'zod';

export const DockerStatus = z.object({
  available: z.boolean(),
  version: z.string().optional(),
});
export type DockerStatus = z.infer<typeof DockerStatus>;

export const HealthResponse = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().nonnegative(),
  docker: DockerStatus,
});
export type HealthResponse = z.infer<typeof HealthResponse>;
