import speakeasy from "speakeasy";
import qrcode from "qrcode";

export function generateTotpSecret(): string {
  return speakeasy.generateSecret({ length: 20 }).base32!;
}

export function generateOtpauthUri(secret: string, username: string): string {
  return speakeasy.otpauthURL({
    secret,
    label: encodeURIComponent(username),
    issuer: "SysOps Hub",
    encoding: "base32",
  });
}

export async function generateQrDataUrl(uri: string): Promise<string> {
  return qrcode.toDataURL(uri);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  return speakeasy.totp.verify({ secret, encoding: "base32", token: code, window: 1 });
}
