import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Uniwind, useUniwind } from 'uniwind';
import design from '@/lib/spk-design-theme';
import { loadTheme, onSignedIn, saveTheme } from '@/lib/preferences';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'spk:theme';
const declared = (value: unknown): value is Theme => (design.themes as readonly string[]).includes(String(value));
const Context = createContext<{ colorScheme: Theme; setColorScheme: (theme: Theme) => void }>({ colorScheme: design.defaultTheme, setColorScheme() {} });

/** DESIGN.md's default theme, or the person's saved choice when DESIGN.md declares both. */
export function DesignThemeProvider({ children }: { children: ReactNode }) {
  const { theme } = useUniwind();
  const [choice, setChoice] = useState<Theme | null>(null);
  // Once the person picks a look in this session, the account does not override it.
  const picked = useRef(false);
  useEffect(() => {
    let live = true;
    void AsyncStorage.getItem(STORAGE_KEY).then(saved => { if (live && declared(saved)) setChoice(saved); }).catch(() => undefined);
    // The account's choice wins: it follows the person to another phone. The
    // session can arrive after this screen exists, so it is read again then.
    const apply = () => {
      if (picked.current) return;
      void loadTheme().then(saved => { if (live && !picked.current && declared(saved)) setChoice(saved); }).catch(() => undefined);
    };
    apply();
    const off = onSignedIn(apply);
    return () => { live = false; off(); };
  }, []);
  const active = choice && declared(choice) ? choice : design.defaultTheme;
  useEffect(() => { Uniwind.setTheme(active); }, [active]);
  const setColorScheme = (next: Theme) => {
    if (!declared(next)) return;
    picked.current = true;
    setChoice(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
    void saveTheme(next).catch(() => undefined);
  };
  return <Context.Provider value={{ colorScheme: theme === 'dark' ? 'dark' : 'light', setColorScheme }}>{children}</Context.Provider>;
}
export const useDesignTheme = () => useContext(Context);
