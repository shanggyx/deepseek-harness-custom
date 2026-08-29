/**
 * The DeepSeek desktop pet: a transparent always-on-top card docked to the
 * screen's right edge. DeepSeek meters per token, so the remaining token
 * budget of the configured API key IS the account balance — the card wears
 * it (polled from `/user/balance` by the main process) the way ccpet wears
 * session usage: face by remaining headroom, amount front and center.
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

/** The pet card window size. */
export const PET_WIDTH = 176
export const PET_HEIGHT = 148

/** Inline pet page: the card face plus the state projector the main process calls. */
export const PET_HTML = String.raw`<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; background: transparent; overflow: hidden; }
  .card { width: 100%; box-sizing: border-box; border-radius: 14px;
    background: rgba(24, 26, 32, 0.92); color: #e8eaf0;
    font: 12px/18px 'Segoe UI', 'Microsoft YaHei', sans-serif;
    padding: 10px 12px; border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35); user-select: none;
    -webkit-app-region: drag; }
  .face { font-size: 34px; line-height: 42px; text-align: center; }
  .amount { font-size: 20px; font-weight: 600; text-align: center;
    font-variant-numeric: tabular-nums; }
  .label { text-align: center; opacity: 0.72; font-size: 11px; }
  .sub { text-align: center; opacity: 0.55; font-size: 10px; margin-top: 2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style></head><body><div class="card">
  <div class="face" id="face">🐳</div>
  <div class="amount" id="amount">—</div>
  <div class="label">DeepSeek 剩余用量</div>
  <div class="sub" id="sub"></div>
</div><script>
  window.__updatePet = function (state) {
    var face = document.getElementById('face')
    var amount = document.getElementById('amount')
    var sub = document.getElementById('sub')
    if (state.kind === 'ok') {
      var low = state.total !== undefined && state.total < 20
      face.textContent = low ? '😟' : '🐳'
      amount.textContent = (state.currency === 'CNY' ? '¥ ' : state.currency === 'USD' ? '$ ' : '') +
        (state.total !== undefined ? state.total.toFixed(2) : '—')
      sub.textContent = low ? '余额偏低，记得充值' : '账户可用'
    } else if (state.kind === 'nokey') {
      face.textContent = '😴'
      amount.textContent = '—'
      sub.textContent = state.message ?? '未检测到 API KEY'
    } else {
      face.textContent = '💔'
      amount.textContent = '—'
      sub.textContent = state.message ?? '余额查询失败'
    }
  }
</script></body></html>`

/** The page-side call the main process makes after every state change. */
export function petStateScript(state: PetBalanceState): string {
  return `window.__updatePet(${JSON.stringify(state)})`
}
