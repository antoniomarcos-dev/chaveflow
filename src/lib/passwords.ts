import crypto from "node:crypto";

export function hashPassword(password: string): string {
  if (password.length < 12 || password.length > 128)
    throw new Error("Use uma senha entre 12 e 128 caracteres.");
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  if (!password || password.length > 128) return false;
  const [algorithm, salt, digest] = hash.split(":");
  if (
    algorithm !== "scrypt" ||
    !salt ||
    !digest ||
    !/^[a-f0-9]{128}$/.test(digest)
  )
    return false;
  return crypto.timingSafeEqual(
    crypto.scryptSync(password, salt, 64),
    Buffer.from(digest, "hex"),
  );
}
