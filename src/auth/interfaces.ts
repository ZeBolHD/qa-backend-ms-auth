import { Role, Token } from "@prisma/client";

export type AccessToken = {
  token: string;
  expiresIn: number;
};

export interface Tokens {
  accessToken: AccessToken;
  refreshToken: Token;
}

export interface JwtPayload {
  id: string;
  email: string;
  roles: Role[];
  verified: boolean;
}
