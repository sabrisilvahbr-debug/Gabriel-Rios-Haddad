import { ActionForm } from '@/components/painel/client';
import { enqueueReadyAction } from './actions';

/** Coloca na fila de envio todas as prévias prontas. */
export function EnqueueReadyForm({ ready }: { ready: number }) {
  if (ready === 0) return null;
  return (
    <ActionForm
      action={enqueueReadyAction}
      submitLabel={`Colocar na fila as prévias prontas (${ready})`}
      pendingLabel="Colocando na fila…"
      confirmMessage={`Colocar ${ready} empresa(s) na fila de envio? As mensagens saem aos poucos, no ritmo das Configurações.`}
    />
  );
}
