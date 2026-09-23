import { readonly, ref } from 'vue';

/**
 * Navigation state that makes the app feel native: which tab is "home" for the
 * screen on top, and where each tab was scrolled to when the user left it.
 */

export type TabName = 'home' | 'agenda' | 'venues' | 'feed' | 'profile';
export type PageTransition = 'tab' | 'push' | 'pop';

/** The tab a pushed screen (e.g. a session opened from Agenda) belongs to. */
const lastTab = ref<TabName>('home');

export function rememberTab(tab: TabName | undefined): void {
  if (tab) lastTab.value = tab;
}

export const currentTab = readonly(lastTab);

// Window scroll per route, recorded before leaving, so a tab comes back where it was.
const scrollPositions = new Map<string, number>();

export function saveScroll(routeKey: string): void {
  scrollPositions.set(routeKey, window.scrollY);
}

export function savedScroll(routeKey: string): number | undefined {
  return scrollPositions.get(routeKey);
}

/**
 * The router scrolls as soon as navigation is confirmed, but the new page only
 * renders once the old one has faded out. Scrolling waits for this signal so it
 * lands on the new page, not the leaving one.
 */
let pendingEnter: (() => void) | null = null;

export function waitForPageEnter(timeoutMs = 400): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(done, timeoutMs);
    function done(): void {
      window.clearTimeout(timer);
      pendingEnter = null;
      resolve();
    }
    pendingEnter = done;
  });
}

export function notifyPageEnter(): void {
  pendingEnter?.();
}

/** Title a pushed screen sets once it knows what it is showing (a CT's name). */
const dynamicTitle = ref<string | null>(null);

export const pageTitle = readonly(dynamicTitle);

export function setPageTitle(title: string | null): void {
  dynamicTitle.value = title;
}
