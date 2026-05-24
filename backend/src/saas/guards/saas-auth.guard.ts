import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Validates `Authorization: Bearer` using {@link SaasJwtStrategy} and `SAAS_JWT_SECRET`. */
@Injectable()
export class SaasAuthGuard extends AuthGuard('saas-jwt') {}
