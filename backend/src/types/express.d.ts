import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by pino-http (nestjs-pino) when `genReqId` is configured. */
    id?: string;
    /** Populated by Passport JWT after successful auth (store users). */
    user?: { id: string; username?: string; role?: string; clientId?: string };
  }
}
