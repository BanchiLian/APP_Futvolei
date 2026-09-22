export interface NavItem {
  name: 'home' | 'agenda' | 'my-sessions' | 'profile';
  label: string;
  /** Inline SVG path data, so the app needs no icon dependency. */
  icon: string;
}

/** Shared by the phone bottom bar and the desktop sidebar so the two cannot drift apart. */
export const NAV_ITEMS: readonly NavItem[] = [
  { name: 'home', label: 'Início', icon: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10' },
  { name: 'agenda', label: 'Agenda', icon: 'M4 7h16v13H4zM4 7V5h16v2M8 3v4M16 3v4M8 12h8M8 16h5' },
  { name: 'my-sessions', label: 'Minhas', icon: 'M5 12l4.5 4.5L19 7M5 19h14' },
  {
    name: 'profile',
    label: 'Perfil',
    icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  },
];
