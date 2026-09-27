import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const DEFAULT_DEV_SECRET = "teltech-dev-secret-change-in-production";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret === DEFAULT_DEV_SECRET || secret.length < 16) {
      throw new Error(
        "FATAL SECURITY ERROR: JWT_SECRET environment variable must be explicitly defined and at least 16 characters long in production!"
      );
    }
    return secret;
  }
  return secret ?? DEFAULT_DEV_SECRET;
}

const JWT_EXPIRES_IN = "7d";

export interface JwtPayload {
  userId: string;
  email: string;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}
