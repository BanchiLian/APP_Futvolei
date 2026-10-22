/**
 * Which kind of user the demo is showing.
 *
 * Kept apart from `server.ts` on purpose: the login needs these few bytes, and
 * importing them from the server would drag the whole snapshot — a sixth of a
 * megabyte — into the real build, which must contain none of it.
 *
 * Nobody picks their own role. As in the real product, the role belongs to the
 * account: each snapshot account enters as what the super admin made it, and
 * anyone else enters as a plain player.
 */

export const DEMO_ROLES = ['ALUNO', 'PROFESSOR', 'OWNER', 'SUPER_ADMIN'] as const;

export type DemoRole = (typeof DEMO_ROLES)[number];

/** The accounts the snapshot was captured with, by e-mail and by its local part. */
const DEMO_ACCOUNTS: Record<string, DemoRole> = {
  'ana.aluna@futcheck.local': 'ALUNO',
  'juliana.professor@futcheck.local': 'PROFESSOR',
  'carlos.professor@futcheck.local': 'OWNER',
  'dono@futcheck.local': 'SUPER_ADMIN',
};

const ROLE_KEY = 'futcheck:demo:role';

export function demoRoleForLogin(login: unknown): DemoRole {
  if (typeof login !== 'string') return 'ALUNO';

  const wanted = login.trim().toLowerCase();
  const match = Object.entries(DEMO_ACCOUNTS).find(
    ([email]) => email === wanted || email.split('@')[0] === wanted,
  );

  return match?.[1] ?? 'ALUNO';
}

/** Whoever signed in last; a fresh visitor is a plain player. */
export function currentDemoRole(): DemoRole {
  try {
    const stored = sessionStorage.getItem(ROLE_KEY);
    return DEMO_ROLES.includes(stored as DemoRole) ? (stored as DemoRole) : 'ALUNO';
  } catch {
    // Private windows and blocked site data throw rather than return null.
    return 'ALUNO';
  }
}

export function setDemoRole(role: DemoRole): void {
  try {
    sessionStorage.setItem(ROLE_KEY, role);
  } catch {
    // Nothing to do: the demo simply stays on the role it opened with.
  }
}
