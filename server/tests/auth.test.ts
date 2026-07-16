import { describe, it, expect } from 'vitest';

// Auth module reads config at import time - set env first
// (explicit empty ADMIN_PASSWORD_HASH so a local .env cannot leak into the test)
process.env.ADMIN_TOKEN = 'test-secret';
process.env.ADMIN_PASSWORD = 'correct-password';
process.env.ADMIN_PASSWORD_HASH = '';
process.env.NODE_ENV = 'test';

const auth = await import('../src/auth.js');

describe('verifyPassword', () => {
  it('akceptuje poprawne hasło', () => {
    expect(auth.verifyPassword('correct-password')).toBe(true);
  });

  it('odrzuca błędne hasło', () => {
    expect(auth.verifyPassword('wrong')).toBe(false);
  });

  it('odrzuca puste i za długie wejście', () => {
    expect(auth.verifyPassword('')).toBe(false);
    expect(auth.verifyPassword('x'.repeat(300))).toBe(false);
  });
});

describe('scrypt hash', () => {
  it('hashPassword → verifyScryptHash round-trip', () => {
    const hash = auth.hashPassword('moje-tajne-haslo');
    expect(hash.startsWith('scrypt:')).toBe(true);
    expect(auth.verifyScryptHash('moje-tajne-haslo', hash)).toBe(true);
    expect(auth.verifyScryptHash('inne-haslo', hash)).toBe(false);
  });

  it('odrzuca zniekształcony hash', () => {
    expect(auth.verifyScryptHash('x', 'nie-scrypt')).toBe(false);
    expect(auth.verifyScryptHash('x', 'scrypt:zz')).toBe(false);
  });
});

describe('tokeny sesji admina', () => {
  it('wystawiony token przechodzi weryfikację i ma przyszłe expiry', () => {
    const { token, expiresAt } = auth.issueToken();
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(auth.verifyToken(token)).toBe(true);
  });

  it('odrzuca token ze zmienionym podpisem', () => {
    const { token } = auth.issueToken();
    expect(auth.verifyToken(token.slice(0, -2) + 'xx')).toBe(false);
  });

  it('odrzuca śmieciowe tokeny', () => {
    expect(auth.verifyToken('')).toBe(false);
    expect(auth.verifyToken('a.b.c')).toBe(false);
    expect(auth.verifyToken('x'.repeat(600))).toBe(false);
  });
});

describe('tokeny wypisu z newslettera', () => {
  it('token działa dla adresu, dla którego został wystawiony', () => {
    const t = auth.unsubscribeToken('user@example.com');
    expect(auth.verifyUnsubscribeToken('user@example.com', t)).toBe(true);
  });

  it('email case-insensitive', () => {
    const t = auth.unsubscribeToken('user@example.com');
    expect(auth.verifyUnsubscribeToken('USER@EXAMPLE.COM', t)).toBe(true);
  });

  it('nie działa dla innego adresu ani po modyfikacji', () => {
    const t = auth.unsubscribeToken('user@example.com');
    expect(auth.verifyUnsubscribeToken('other@example.com', t)).toBe(false);
    expect(auth.verifyUnsubscribeToken('user@example.com', t.slice(0, -2) + 'xx')).toBe(false);
  });
});

describe('tokeny klienta (magic-link "moje rezerwacje")', () => {
  it('round-trip: token zwraca email (lowercase)', () => {
    const { token, expiresAt } = auth.issueCustomerToken('Klient@Example.COM');
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(auth.verifyCustomerToken(token)).toBe('klient@example.com');
  });

  it('odrzuca token ze zmienionym podpisem', () => {
    const { token } = auth.issueCustomerToken('user@example.com');
    expect(auth.verifyCustomerToken(token.slice(0, -2) + 'xx')).toBeNull();
  });

  it('odrzuca token admina (inny typ)', () => {
    const { token } = auth.issueToken();
    expect(auth.verifyCustomerToken(token)).toBeNull();
  });

  it('odrzuca śmieci', () => {
    expect(auth.verifyCustomerToken('')).toBeNull();
    expect(auth.verifyCustomerToken('a.b')).toBeNull();
    expect(auth.verifyCustomerToken('x'.repeat(2000))).toBeNull();
  });
});
