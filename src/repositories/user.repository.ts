import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export type UserRow = Prisma.UserGetPayload<true>;
export type RefreshTokenRow = Prisma.RefreshTokenGetPayload<true>;

export interface CreateUserInput {
  email: string;
  passwordHash: string;
}

export interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

async function createUser(input: CreateUserInput): Promise<UserRow> {
  return prisma.user.create({ data: input });
}

async function findUserByEmail(email: string): Promise<UserRow | null> {
  return prisma.user.findUnique({ where: { email } });
}

async function findUserById(id: string): Promise<UserRow | null> {
  return prisma.user.findUnique({ where: { id } });
}

async function createRefreshToken(input: CreateRefreshTokenInput): Promise<RefreshTokenRow> {
  return prisma.refreshToken.create({ data: input });
}

async function findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
  return prisma.refreshToken.findFirst({ where: { tokenHash } });
}

async function revokeRefreshToken(id: string, at: Date = new Date()): Promise<void> {
  await prisma.refreshToken.update({ where: { id }, data: { revokedAt: at } });
}

export const userRepository = {
  createUser,
  findUserByEmail,
  findUserById,
  createRefreshToken,
  findRefreshTokenByHash,
  revokeRefreshToken,
};
