import { ConfidentialClientApplication, type AuthorizationCodeRequest } from "@azure/msal-node";
import { config } from "../config";
import { logger } from "../utils/logger";

function getMsalClient(): ConfidentialClientApplication | null {
  if (!config.ENTRA_CLIENT_ID || !config.ENTRA_CLIENT_SECRET || !config.ENTRA_TENANT_ID) {
    return null;
  }
  return new ConfidentialClientApplication({
    auth: {
      clientId: config.ENTRA_CLIENT_ID,
      clientSecret: config.ENTRA_CLIENT_SECRET,
      authority: `https://login.microsoftonline.com/${config.ENTRA_TENANT_ID}`,
    },
  });
}

export interface EntraClaims {
  oid: string;
  email: string;
  displayName: string;
}

export async function buildAuthUrl(): Promise<string | null> {
  const client = getMsalClient();
  if (!client) return null;

  const redirectUri = config.ENTRA_REDIRECT_URI ?? `${config.FRONTEND_URL}/auth/entra/callback`;

  try {
    const url = await client.getAuthCodeUrl({
      scopes: ["openid", "profile", "email"],
      redirectUri,
    });
    return url;
  } catch (err: any) {
    logger.error({ err: err.message }, "Entra buildAuthUrl failed");
    return null;
  }
}

export async function handleCallback(code: string): Promise<EntraClaims | null> {
  const client = getMsalClient();
  if (!client) return null;

  const redirectUri = config.ENTRA_REDIRECT_URI ?? `${config.FRONTEND_URL}/auth/entra/callback`;

  try {
    const result = await client.acquireTokenByCode({
      code,
      scopes: ["openid", "profile", "email"],
      redirectUri,
    } as AuthorizationCodeRequest);

    if (!result?.idTokenClaims) return null;

    const claims = result.idTokenClaims as Record<string, any>;
    return {
      oid: claims.oid ?? claims.sub ?? "",
      email: claims.email ?? claims.preferred_username ?? "",
      displayName: claims.name ?? claims.preferred_username ?? "",
    };
  } catch (err: any) {
    logger.error({ err: err.message }, "Entra handleCallback failed");
    return null;
  }
}
