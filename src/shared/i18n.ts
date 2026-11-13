import type { Language } from './types'
import en from './en.json'

// Klucze to polskie teksty źródłowe. {0}, {1}… to miejsca na wartości.
const DICT: Record<Language, Record<string, string>> = { pl: {}, en: en as Record<string, string> }

export function translate(lang: Language, key: string, args: unknown[] = []): string {
  const s = (lang !== 'pl' && DICT[lang][key]) || key
  return args.length ? s.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? '')) : s
}
