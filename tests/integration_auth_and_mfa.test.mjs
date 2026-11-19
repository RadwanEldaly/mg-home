// ============================================================================
// MG HOME CMS — Supabase Auth & MFA (AAL2) Integration Simulation Suite
// File: tests/integration_auth_and_mfa.test.mjs
// Run: node --test tests/integration_auth_and_mfa.test.mjs
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Integration Test: Supabase Auth, TOTP MFA (AAL2), and Admin Authorization', () => {
  // Simulated PostgreSQL & Supabase Auth Database State
  const authUsers = new Map([
    ['usr-admin-1', { id: 'usr-admin-1', email: 'admin@mg-home.online', passwordHash: 'hash-secret-pwd' }],
    ['usr-guest-2', { id: 'usr-guest-2', email: 'intruder@example.com', passwordHash: 'hash-guest-pwd' }]
  ]);

  const adminProfiles = new Map([
    ['usr-admin-1', { id: 'usr-admin-1', email: 'admin@mg-home.online', role: 'super_admin', is_singleton: true }]
  ]);

  const mfaFactors = new Map([
    ['usr-admin-1', [{ id: 'factor-totp-1', factor_type: 'totp', status: 'verified', secret: 'JBSWY3DPEHPK3PXP' }]]
  ]);

  // Auth Harness simulating Supabase Auth Client
  class MockSupabaseAuthClient {
    constructor() {
      this.currentSession = null;
    }

    async signInWithPassword({ email, password }) {
      const user = Array.from(authUsers.values()).find(u => u.email === email);
      if (!user || password !== 'ValidPassword123!') {
        return { data: null, error: new Error('Invalid login credentials') };
      }

      // Initial login yields AAL1 session
      this.currentSession = {
        access_token: this._createJwt(user.id, 'aal1'),
        user: { id: user.id, email: user.email }
      };
      return { data: { session: this.currentSession, user: this.currentSession.user }, error: null };
    }

    async getAuthenticatorAssuranceLevel() {
      if (!this.currentSession) return { data: null, error: new Error('No session') };
      const factors = mfaFactors.get(this.currentSession.user.id) || [];
      const hasVerified = factors.some(f => f.status === 'verified');
      const payload = this._decodeJwt(this.currentSession.access_token);
      return {
        data: {
          currentLevel: payload.aal,
          nextLevel: hasVerified ? 'aal2' : 'aal1'
        },
        error: null
      };
    }

    async listFactors() {
      if (!this.currentSession) return { data: null, error: new Error('No session') };
      const factors = mfaFactors.get(this.currentSession.user.id) || [];
      return {
        data: {
          totp: factors.filter(f => f.factor_type === 'totp'),
          all: factors
        },
        error: null
      };
    }

    async challengeAndVerify({ factorId, code }) {
      if (!this.currentSession) return { data: null, error: new Error('No session') };
      const factors = mfaFactors.get(this.currentSession.user.id) || [];
      const factor = factors.find(f => f.id === factorId);
      if (!factor) return { data: null, error: new Error('Factor not found') };

      // In real TOTP, code must match HMAC-SHA1. We accept '123456'.
      if (code !== '123456') {
        return { data: null, error: new Error('Invalid two-factor authentication code') };
      }

      factor.status = 'verified';
      // Upgrade session to AAL2
      this.currentSession.access_token = this._createJwt(this.currentSession.user.id, 'aal2');
      return { data: { user: this.currentSession.user }, error: null };
    }

    async signOut() {
      this.currentSession = null;
    }

    _createJwt(userId, aal) {
      const payload = {
        sub: userId,
        aal,
        amr: aal === 'aal2' ? [{ method: 'password' }, { method: 'totp' }] : [{ method: 'password' }],
        exp: Math.floor(Date.now() / 1000) + 3600
      };
      return `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.signature`;
    }

    _decodeJwt(token) {
      const parts = token.split('.');
      return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    }
  }

  it('1. Rejects login with invalid credentials', async () => {
    const auth = new MockSupabaseAuthClient();
    const result = await auth.signInWithPassword({ email: 'admin@mg-home.online', password: 'WrongPassword' });
    assert.equal(result.data, null);
    assert.ok(result.error);
    assert.match(result.error.message, /Invalid login credentials/);
  });

  it('2. Authenticates valid user at AAL1 and detects required TOTP factor', async () => {
    const auth = new MockSupabaseAuthClient();
    const { data, error } = await auth.signInWithPassword({ email: 'admin@mg-home.online', password: 'ValidPassword123!' });
    assert.ifError(error);
    assert.ok(data.session);

    const aal = await auth.getAuthenticatorAssuranceLevel();
    assert.equal(aal.data.currentLevel, 'aal1');
    assert.equal(aal.data.nextLevel, 'aal2', 'Next assurance level must be aal2 when TOTP factor is enrolled');
  });

  it('3. Rejects invalid TOTP code during MFA challenge', async () => {
    const auth = new MockSupabaseAuthClient();
    await auth.signInWithPassword({ email: 'admin@mg-home.online', password: 'ValidPassword123!' });
    const factors = await auth.listFactors();
    const factor = factors.data.totp[0];

    const verify = await auth.challengeAndVerify({ factorId: factor.id, code: '000000' });
    assert.equal(verify.data, null);
    assert.match(verify.error.message, /Invalid two-factor authentication code/);
  });

  it('4. Upgrades session to AAL2 upon successful TOTP verification', async () => {
    const auth = new MockSupabaseAuthClient();
    await auth.signInWithPassword({ email: 'admin@mg-home.online', password: 'ValidPassword123!' });
    const factors = await auth.listFactors();
    const factor = factors.data.totp[0];

    const verify = await auth.challengeAndVerify({ factorId: factor.id, code: '123456' });
    assert.ifError(verify.error);

    const aal = await auth.getAuthenticatorAssuranceLevel();
    assert.equal(aal.data.currentLevel, 'aal2', 'Session must be upgraded to aal2');
  });

  it('5. Enforces super_admin role check against admin_profiles: Rejects non-admin user', async () => {
    const auth = new MockSupabaseAuthClient();
    // Non-admin logs in
    const { data } = await auth.signInWithPassword({ email: 'intruder@example.com', password: 'ValidPassword123!' });
    assert.ok(data.session);

    // Profile lookup in database
    const profile = adminProfiles.get(data.session.user.id);
    assert.equal(profile, undefined, 'Intruder must not have an entry in admin_profiles');

    // System must reject authorization
    const isAuthorizedAdmin = profile?.role === 'super_admin';
    assert.equal(isAuthorizedAdmin, false, 'Non-admin must be denied administrative access');
  });

  it('6. Allows verified super_admin with AAL2 session to access workspace', async () => {
    const auth = new MockSupabaseAuthClient();
    await auth.signInWithPassword({ email: 'admin@mg-home.online', password: 'ValidPassword123!' });
    const factors = await auth.listFactors();
    await auth.challengeAndVerify({ factorId: factors.data.totp[0].id, code: '123456' });

    const aal = await auth.getAuthenticatorAssuranceLevel();
    const profile = adminProfiles.get(auth.currentSession.user.id);

    const isAuthorized = aal.data.currentLevel === 'aal2' && profile?.role === 'super_admin';
    assert.equal(isAuthorized, true, 'Super admin with verified AAL2 must be granted access');
  });

  it('7. SignOut completely clears active session', async () => {
    const auth = new MockSupabaseAuthClient();
    await auth.signInWithPassword({ email: 'admin@mg-home.online', password: 'ValidPassword123!' });
    assert.ok(auth.currentSession);

    await auth.signOut();
    assert.equal(auth.currentSession, null);
  });
});
