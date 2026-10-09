import { computed } from 'vue';

import { PERMISSIONS, type Permission } from '@futcheck/shared';

import type { RouteLocationRaw } from 'vue-router';

import type { IconName } from '@/components/icons';
import { useCan } from '@/composables/useCan';
import { useAuthStore } from '@/stores/auth';
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

/**
 * The management screens, for the sidebar.
 *
 * Separate from the tabs above because they are not tabs: they are the screens
 * behind the Painel tab, and on a wide screen there is room to reach them
 * directly instead of going through the panel first.
 *
 * Every entry is hidden unless the person holds the permission that the route
 * and the API also check — three places, one matrix.
 */
export interface StaffNavItem {
  key: string;
  label: string;
  icon: IconName;
  to: RouteLocationRaw;
}

export function useStaffNavItems() {
  const { can } = useCan();
  const store = useAuthStore();

  return computed<StaffNavItem[]>(() => {
    const items: StaffNavItem[] = [];

    // The CT whose screens the sidebar points at. Someone staff at several sees
    // the first; the panel's picker is where they switch.
    const venue = store.user?.staffVenues[0] ?? null;

    if (venue && can(PERMISSIONS.VENUE_PEOPLE_VIEW)) {
      items.push({
        key: 'people',
        label: 'Alunos',
        icon: 'users',
        to: { name: 'staff-people', params: { venueId: venue.id } },
      });
    }

    if (venue && can(PERMISSIONS.VENUE_MANAGE)) {
      items.push({
        key: 'venue',
        label: 'Meu CT',
        icon: 'pin',
        to: { name: 'staff-venue', params: { venueId: venue.id } },
      });
    }

    if (venue && can(PERMISSIONS.SCHEDULE_MANAGE)) {
      items.push({
        key: 'schedule',
        label: 'Grade',
        icon: 'calendar',
        to: { name: 'staff-schedule', params: { venueId: venue.id } },
      });
    }

    if (venue && can(PERMISSIONS.VENUE_STAFF_MANAGE)) {
      items.push({
        key: 'team',
        label: 'Equipe',
        icon: 'aula',
        to: { name: 'staff-team', params: { venueId: venue.id } },
      });
    }

    // Network-wide, so they need no CT and appear for the super admin alone.
    if (can(PERMISSIONS.ADMIN_MANAGE)) {
      items.push({ key: 'network', label: 'Rede', icon: 'list', to: { name: 'staff-network' } });
    }

    if (can(PERMISSIONS.AUDIT_VIEW)) {
      items.push({ key: 'audit', label: 'Auditoria', icon: 'lock', to: { name: 'staff-audit' } });
    }

    return items;
  });
}
