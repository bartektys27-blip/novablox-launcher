import { translate } from '@shared/i18n'
import { loadState } from './store'

/** Tłumaczenie komunikatów procesu głównego na język ustawiony w launcherze */
export function L(key: string, args: unknown[] = []): string {
  let lang: 'pl' | 'en' = 'pl'
  try { lang = loadState().settings.language ?? 'pl' } catch { /* przed startem */ }
  return translate(lang, key, args)
}
