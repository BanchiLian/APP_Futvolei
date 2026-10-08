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
  /**
   * Shown when the user holds any one of these. Staff reach the same panel by
   * different routes: a professor through ATTENDANCE_MANAGE_OWN, whoever runs
   * the CT through ATTENDANCE_MANAGE_ANY.
   */
  anyOf?: readonly Permission[];
}

/** Shared by the phone bottom bar and the desktop sidebar so the two cannot drift apart. */
export const NAV_ITEMS: readonly NavItem[] = [
  { name: 'home', label: 'Início', icon: 'home' },
  { name: 'agenda', label: 'Agenda', icon: 'calendar' },
  {
    name: 'staff',
    label: 'Painel',
    icon: 'clipboard',
    anyOf: [PERMISSIONS.ATTENDANCE_MANAGE_OWN, PERMISSIONS.ATTENDANCE_MANAGE_ANY],
  },
  { name: 'venues', label: 'CTs', icon: 'pin', permission: PERMISSIONS.VENUE_VIEW },
  { name: 'feed', label: 'Feed', icon: 'camera', permission: PERMISSIONS.FEED_VIEW },
  { name: 'profile', label: 'Perfil', icon: 'user' },
];

export function useNavItems() {
  const { can, canAny } = useCan();

  return computed(() =>
    NAV_ITEMS.filter((item) => {
      if (item.permission && !can(item.permission)) return false;
      if (item.anyOf && !canAny([...item.anyOf])) return false;
      return true;
    }),
  );
}
