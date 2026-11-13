import type { Settings } from '@shared/types'

/** Ustawienia wyglądu przywracane przyciskiem „Przywróć domyślny wygląd” */
export const DEFAULT_SETTINGS_UI: Partial<Settings> = {
  theme: 'nova',
  accent: null,
  accent2: null,
  backgroundImage: null,
  backgroundBlur: 24,
  backgroundDim: 70,
  cardStyle: 'glass',
  cardSize: 'default',
  animations: 'full',
  effects: { glow: true, gradients: true, noise: true }
}
