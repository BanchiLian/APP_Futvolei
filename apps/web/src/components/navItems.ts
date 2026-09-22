import { computed } from 'vue';

import { PERMISSIONS, type Permission } from '@futcheck/shared';

import type { IconName } from '@/components/icons';
import { useCan } from '@/composables/useCan';
import type { TabName } from '@/router/navigation';

export interface NavItem {
  /** Route name of the tab root; equal to its `TabName`. */
  name: TabName;
  label: string;
  icon: IconName;
  /** Hidden (not just disabled) when the user lacks it. */
  permission?: Permission;
}

/** Shared by the phone bottom bar and the desktop sidebar so the two cannot drift apart. */
export const NAV_ITEMS: readonly NavItem[] = [
  { name: 'home', label: 'Início', icon: 'home' },
  { name: 'agenda', label: 'Agenda', icon: 'calendar' },
  { name: 'venues', label: 'CTs', icon: 'pin', permission: PERMISSIONS.VENUE_VIEW },
  { name: 'community', label: 'Comunidade', icon: 'users', permission: PERMISSIONS.COMMUNITY_VIEW },
  { name: 'profile', label: 'Perfil', icon: 'user' },
];

export function useNavItems() {
  const { can } = useCan();
  return computed(() => NAV_ITEMS.filter((item) => !item.permission || can(item.permission)));
}
