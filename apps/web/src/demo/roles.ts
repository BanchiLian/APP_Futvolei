/**
 * Which kind of user the demo is showing.
 *
 * Kept apart from `server.ts` on purpose: the banner needs these few bytes, and
 * importing them from the server would drag the whole snapshot — a sixth of a
 * megabyte — into the real build, which must contain none of it.
 */

export const DEMO_ROLES = ['ALUNO', 'PROFESSOR', 'OWNER', 'SUPER_ADMIN'] as const;

export type DemoRole = (typeof DEMO_ROLES)[number];

export const DEMO_ROLE_LABELS: Record<DemoRole, string> = {
  ALUNO: 'Aluno',
  PROFESSOR: 'Professor',
  OWNER: 'Dono do CT',
  SUPER_ADMIN: 'Super admin',
};

/** What each role is worth looking at, shown next to the picker. */
export const DEMO_ROLE_HINTS: Record<DemoRole, string> = {
  ALUNO: 'agenda, CTs, feed',
  PROFESSOR: 'painel com os alunos do CT',
  OWNER: 'painel, grade, equipe e alunos',
  SUPER_ADMIN: 'a rede inteira e a auditoria',
};

const ROLE_KEY = 'futcheck:demo:role';

/** Opens as the owner, because that is the view with the most to look at. */
export function currentDemoRole(): DemoRole {
  try {
    const stored = sessionStorage.getItem(ROLE_KEY);
    return DEMO_ROLES.includes(stored as DemoRole) ? (stored as DemoRole) : 'OWNER';
  } catch {
    // Private windows and blocked site data throw rather than return null.
    return 'OWNER';
  }
}

export function setDemoRole(role: DemoRole): void {
  try {
    sessionStorage.setItem(ROLE_KEY, role);
  } catch {
    // Nothing to do: the demo simply stays on the role it opened with.
  }
}
