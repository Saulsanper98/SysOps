import { authenticator } from "otplib";
import qrcode from "qrcode";

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function generateOtpauthUri(secret: string, username: string): string {
  return authenticator.keyuri(username, "SysOps Hub", secret);
}

export async function generateQrDataUrl(uri: string): Promise<string> {
  return qrcode.toDataURL(uri);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  return authenticator.verify({ token: code, secret });
}
