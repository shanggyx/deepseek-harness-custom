/**
 * The DeepSeek desktop pet: a transparent always-on-top chibi docked to the
 * screen's right edge — the community 蓝发女仆 DeepSeek 娘 (twin-tails, maid
 * headdress, whale-blue dress; sprite from JAdpp/dsh-whale-galgame). Idle she
 * just bobs; hovering the card plays the hop animation and pops a bubble with
 * the account's remaining balance (DeepSeek meters per token, so the
 * remaining token budget IS the account balance, polled from /user/balance
 * by the main process).
 * @module @deepseek-ai/dsh-desktop/pet
 */

/** One pet render state, produced by the main process's balance poller. */
export interface PetBalanceState {
  kind: 'ok' | 'nokey' | 'error'
  /** Account currency (ok state). */
  currency?: string
  /** Total remaining balance in the account currency (ok state). */
  total?: number
  /** Why no balance is shown (nokey/error states). */
  message?: string | undefined
}

/** The pet stage window size (bubble airspace above the girl included). */
export const PET_WIDTH = 210
export const PET_HEIGHT = 250

/**
 * The page-side call the main process makes after every state change: the
 * pet page defines `window.__updatePet(state)` as its only consumer surface.
 * @param state - the latest balance state to paint.
 * @returns the script body to evaluate in the pet page.
 */
export function petStateScript(state: PetBalanceState): string {
  return `window.__updatePet(${JSON.stringify(state)})`
}
