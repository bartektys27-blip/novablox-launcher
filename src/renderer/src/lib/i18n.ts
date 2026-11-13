import type { Language } from '@shared/types'
import { translate } from '@shared/i18n'

// Język wczytujemy z localStorage przy starcie (zmiana języka przeładowuje okno),
// dzięki czemu t() działa synchronicznie w każdym miejscu, także poza Reactem.
let lang: Language = 'pl'
try { lang = (localStorage.getItem('nova-lang') as Language) || 'pl' } catch { /* brak */ }

export const getLang = (): Language => lang
export const locale = (): string => (lang === 'en' ? 'en-US' : 'pl-PL')

export function setLang(l: Language): void {
  lang = l
  try { localStorage.setItem('nova-lang', l) } catch { /* brak */ }
}

/** t('Tekst po polsku {0}', [wartość]) */
export function t(key: string, args: unknown[] = []): string {
  return translate(lang, key, args)
}

/** Opis sposobu połączenia konta */
export function accountModeLabel(mode: 'oauth' | 'public' | 'cookie'): string {
  return mode === 'cookie' ? t('Zalogowano przez Roblox') : mode === 'oauth' ? t('Zalogowano przez OAuth') : t('Profil publiczny')
}
