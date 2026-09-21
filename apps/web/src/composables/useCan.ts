import { storeToRefs } from 'pinia';

import type { Permission } from '@futcheck/shared';

import { useAuthStore } from '@/stores/auth';

/**
 * `can()` for templates — hides actions the user cannot perform.
 *
 * This is presentation only. Every one of these permissions is checked again on
 * the server, which is the single source of truth (section 4).
 *
 *   const { can } = useCan();
 *   <button v-if="can(PERMISSIONS.SESSION_MANAGE)">Nova sessão</button>
 */
export function useCan() {
  const store = useAuthStore();
  const { permissions } = storeToRefs(store);

  return {
    permissions,
    can: (permission: Permission) => store.can(permission),
    canAll: (required: Permission[]) => store.canAll(required),
    canAny: (required: Permission[]) => store.canAny(required),
  };
}
