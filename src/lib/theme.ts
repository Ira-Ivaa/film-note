/**
 * Theme and density preferences. Client-safe by design: imported by the
 * switcher, by the library browser and by the inline bootstrap script in the
 * root layout, so it must not pull in anything server-only.
 *
 * These are viewing preferences, not account data, so they live in
 * localStorage rather than the database: no round trip, no schema, and each
 * device can differ.
 */

export const ACCENTS = [
  { id: 'gold', label: 'Золото' },
  { id: 'emerald', label: 'Изумруд' },
  { id: 'sapphire', label: 'Сапфир' },
  { id: 'amethyst', label: 'Аметист' },
  { id: 'ruby', label: 'Рубин' },
  { id: 'turquoise', label: 'Бирюза' },
  { id: 'copper', label: 'Медь' },
] as const;

export type Accent = (typeof ACCENTS)[number]['id'];
export type Density = 'grid' | 'list';

export const DEFAULT_ACCENT: Accent = 'gold';
export const DEFAULT_DENSITY: Density = 'grid';

export const ACCENT_KEY = 'fn-accent';
export const DENSITY_KEY = 'fn-density';

/** Hex per accent, needed where a swatch is drawn rather than themed by CSS. */
export const ACCENT_HEX: Record<Accent, string> = {
  gold: '#f7c85c',
  emerald: '#35e3a8',
  sapphire: '#6d9dff',
  amethyst: '#bb8cff',
  ruby: '#ff6485',
  turquoise: '#3adfe8',
  copper: '#ff9459',
};

export function isAccent(value: unknown): value is Accent {
  return ACCENTS.some((a) => a.id === value);
}

export function readAccent(): Accent {
  try {
    const stored = localStorage.getItem(ACCENT_KEY);
    return isAccent(stored) ? stored : DEFAULT_ACCENT;
  } catch {
    // Private mode or blocked storage: the app still works, it just forgets.
    return DEFAULT_ACCENT;
  }
}

export function readDensity(): Density {
  try {
    return localStorage.getItem(DENSITY_KEY) === 'list' ? 'list' : DEFAULT_DENSITY;
  } catch {
    return DEFAULT_DENSITY;
  }
}

export function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* nothing to do — the preference just will not survive a reload */
  }
}

/**
 * Runs before first paint from the document head, so the chosen accent is on
 * <html> when the first pixels are drawn. Without it every visit would flash
 * gold before the client bundle hydrates.
 *
 * Kept as a string because it has to be inlined, and deliberately tiny: it is
 * blocking script in the critical path.
 */
export const THEME_BOOTSTRAP = `try{var a=localStorage.getItem('${ACCENT_KEY}');
var ok=${JSON.stringify(ACCENTS.map((a) => a.id))}.indexOf(a)>=0;
document.documentElement.dataset.accent=ok?a:'${DEFAULT_ACCENT}';}catch(e){}`.replace(/\n/g, '');
