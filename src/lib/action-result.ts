/** Resultado de uma ação do painel, mostrado ao lado do formulário. */
export type ActionResult = { ok: boolean; message: string } | null;

export const ok = (message: string): ActionResult => ({ ok: true, message });
export const fail = (message: string): ActionResult => ({ ok: false, message });
