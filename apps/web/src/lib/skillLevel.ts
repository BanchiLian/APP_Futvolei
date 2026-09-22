import { SKILL_LEVELS, type SkillLevel } from '@futcheck/shared';

/** pt-BR labels for the skill level, used wherever a player is shown. */
export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  [SKILL_LEVELS.INICIANTE]: 'Iniciante',
  [SKILL_LEVELS.INTERMEDIARIO]: 'Intermediário',
  [SKILL_LEVELS.AVANCADO]: 'Avançado',
};

export const SKILL_LEVEL_OPTIONS = (Object.keys(SKILL_LEVEL_LABELS) as SkillLevel[]).map(
  (value) => ({ value, label: SKILL_LEVEL_LABELS[value] }),
);
