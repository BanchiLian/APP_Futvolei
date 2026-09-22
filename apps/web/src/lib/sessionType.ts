import { SESSION_TYPES, type SessionType } from '@futcheck/shared';

import type { IconName } from '@/components/icons';

/**
 * Visual identity of each session type. Colour, icon and label all differ so the
 * two kinds stay distinguishable for colour-blind users too (section 5).
 * Class strings are written out in full so Tailwind can see them.
 */
export interface SessionTypeMeta {
  label: string;
  icon: IconName;
  badge: string;
  accent: string;
  soft: string;
  text: string;
}

export const SESSION_TYPE_META: Record<SessionType, SessionTypeMeta> = {
  [SESSION_TYPES.AULA]: {
    label: 'Aula',
    icon: 'aula',
    badge: 'bg-aula-100 text-aula-700',
    accent: 'bg-aula-600',
    soft: 'bg-aula-50',
    text: 'text-aula-700',
  },
  [SESSION_TYPES.DAYUSE]: {
    label: 'Dayuse',
    icon: 'sun',
    badge: 'bg-dayuse-100 text-dayuse-800',
    accent: 'bg-dayuse-500',
    soft: 'bg-dayuse-50',
    text: 'text-dayuse-800',
  },
};
