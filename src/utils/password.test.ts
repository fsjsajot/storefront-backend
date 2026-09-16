import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password utils', () => {
  it('hashes a password without storing it in plaintext', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash).not.toBe('correct-horse-battery-staple');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('verifies the correct password', async () => {
    const hash = await hashPassword('secret123');
    await expect(verifyPassword('secret123', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('secret123');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('generates a unique salt per hash', async () => {
    const first = await hashPassword('same-password');
    const second = await hashPassword('same-password');
    expect(first).not.toBe(second);
  });
});
