import type { FastifyRequest, FastifyReply } from "fastify";
import { UnauthorizedError, ForbiddenError } from "../utils/errors";
import type { JWTPayload } from "./index";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: JWTPayload;
  }
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await req.jwtVerify();
    req.user = req.user as JWTPayload;
  } catch {
    throw new UnauthorizedError();
  }
}

export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    await requireAuth(req, _reply);
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Se requiere rol: ${roles.join(" o ")}. Tu rol: ${req.user.role}`,
      );
    }
  };
}
