import { CheckCircle2, XCircle } from 'lucide-react';
import { ActionForm } from '@/components/painel/client';
import { Field, inputClass, PageHeader, Section } from '@/components/painel/ui';
import { MAX_RESULTS_LIMIT } from '@/lib/constants';
import { getSettings } from '@/lib/db/settings';
import { integrationStatus } from '@/lib/env';
import { saveSettingsAction } from './actions';

const DAYS = [
  ['1', 'Seg'],
  ['2', 'Ter'],
  ['3', 'Qua'],
  ['4', 'Qui'],
  ['5', 'Sex'],
  ['6', 'Sáb'],
  ['0', 'Dom'],
];

function Toggle({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 size-4 accent-emerald-700" />
      <span>
        <span className="block text-sm font-medium text-stone-800">{label}</span>
        {hint ? <span className="block text-xs text-stone-500">{hint}</span> : null}
      </span>
    </label>
  );
}

export default async function SettingsPage() {
  const settings = await getSettings();
  const integrations = integrationStatus();
  const activeDays = new Set(settings.windowDays.split(','));
  const templates = [...settings.messageTemplates, '', '', ''].slice(0, Math.max(3, settings.messageTemplates.length));

  return (
    <>
      <PageHeader title="Configurações" description="Sua agência, o ritmo dos envios e o que a IA pode dizer." />

      <ActionForm action={saveSettingsAction} submitLabel="Salvar configurações" className="space-y-6">
        <Section title="Sua agência" description="Aparece na faixa das prévias, nas mensagens e no botão &quot;Quero este site&quot;.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" hint="Como as empresas vão te chamar. Ex.: Sabrina Sites.">
              <input name="agencyName" defaultValue={settings.agencyName} maxLength={80} className={inputClass} />
            </Field>
            <Field label="Seu WhatsApp" hint="Celular com DDD. Recebe os pedidos das prévias e os avisos de interesse.">
              <input name="agencyWhatsapp" defaultValue={settings.agencyWhatsapp} inputMode="tel" placeholder="(19) 99999-0000" className={inputClass} />
            </Field>
          </div>
        </Section>

        <Section title="Busca">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Empresas por busca" hint={`Padrão do formulário de busca. Até ${MAX_RESULTS_LIMIT}.`}>
              <input name="defaultMaxResults" type="number" min={1} max={MAX_RESULTS_LIMIT} defaultValue={settings.defaultMaxResults} className={inputClass} />
            </Field>
            <div className="pt-6">
              <Toggle
                name="includeLandlines"
                label="Importar empresas só com telefone fixo"
                defaultChecked={settings.includeLandlines}
                hint="Fixo não recebe WhatsApp; servem só para contato manual."
              />
            </div>
          </div>
        </Section>

        <Section
          title="Envio pelo WhatsApp"
          description="As mensagens saem uma por vez, em horário comercial, com intervalos aleatórios. Ritmo lento protege o seu número."
        >
          <div className="space-y-5">
            <Toggle
              name="outreachEnabled"
              label="Envio automático ligado"
              defaultChecked={settings.outreachEnabled}
              hint="Desligado, nada sai da fila."
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Limite por dia" hint="Recomendado: até 20.">
                <input name="dailyLimit" type="number" min={1} max={100} defaultValue={settings.dailyLimit} className={inputClass} />
              </Field>
              <Field label="Das (hora)">
                <input name="windowStartHour" type="number" min={0} max={23} defaultValue={settings.windowStartHour} className={inputClass} />
              </Field>
              <Field label="Até (hora)">
                <input name="windowEndHour" type="number" min={1} max={24} defaultValue={settings.windowEndHour} className={inputClass} />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-stone-700">Dias de envio</legend>
              <div className="flex flex-wrap gap-3">
                {DAYS.map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-1.5 text-sm">
                    <input type="checkbox" name="windowDays" value={value} defaultChecked={activeDays.has(value)} className="accent-emerald-700" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Intervalo mínimo (minutos)">
                <input name="minIntervalMin" type="number" min={1} max={120} defaultValue={settings.minIntervalMin} className={inputClass} />
              </Field>
              <Field label="Intervalo máximo (minutos)">
                <input name="maxIntervalMin" type="number" min={1} max={240} defaultValue={settings.maxIntervalMin} className={inputClass} />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-stone-700">Primeira mensagem</legend>
              <p className="mb-3 text-xs text-stone-500">
                Uma variação é sorteada para cada empresa. Use {'{empresa}'}, {'{link}'} (obrigatório), {'{agencia}'},{' '}
                {'{cidade}'} e {'{ramo}'}. Deixe em branco para não usar.
              </p>
              <div className="space-y-3">
                {templates.map((template, i) => (
                  <textarea
                    key={i}
                    name="messageTemplates"
                    defaultValue={template}
                    rows={4}
                    aria-label={`Variação ${i + 1} da primeira mensagem`}
                    className={inputClass}
                  />
                ))}
              </div>
            </fieldset>
            <div className="space-y-3 rounded-lg bg-stone-50 p-4">
              <Toggle
                name="followUpEnabled"
                label="Mandar um lembrete para quem não respondeu"
                defaultChecked={settings.followUpEnabled}
                hint="Só um lembrete por empresa."
              />
              <Field label="Dias sem resposta até o lembrete">
                <input name="followUpAfterDays" type="number" min={1} max={30} defaultValue={settings.followUpAfterDays} className={`${inputClass} max-w-32`} />
              </Field>
              <Field label="Texto do lembrete">
                <textarea name="followUpTemplate" defaultValue={settings.followUpTemplate} rows={3} className={inputClass} />
              </Field>
            </div>
          </div>
        </Section>

        <Section
          title="Respostas com IA"
          description="Quando uma empresa responder, a IA conversa por você e te avisa quando houver interesse em fechar."
        >
          <div className="space-y-5">
            <Toggle name="aiRepliesEnabled" label="Respostas da IA ligadas" defaultChecked={settings.aiRepliesEnabled} />
            <Field label="Máximo de respostas da IA por conversa" hint="Depois disso, a conversa passa para você.">
              <input name="aiMaxReplies" type="number" min={1} max={30} defaultValue={settings.aiMaxReplies} className={`${inputClass} max-w-32`} />
            </Field>
            <Field
              label="Sua oferta"
              hint="Preço, o que está incluído, prazo e forma de pagamento. A IA só fala de preço com base neste texto."
            >
              <textarea
                name="offerText"
                defaultValue={settings.offerText}
                rows={6}
                maxLength={2000}
                placeholder="Ex.: Site de uma página com domínio próprio por R$ 497 à vista ou 3x de R$ 175. Entrega em 2 dias úteis. Inclui hospedagem por 12 meses."
                className={inputClass}
              />
            </Field>
          </div>
        </Section>
      </ActionForm>

      <div className="mt-6">
        <Section title="Integrações" description="Variáveis de ambiente cadastradas na Vercel. Depois de mudar, faça um novo deploy.">
          <ul className="divide-y divide-stone-100">
            {integrations.map((item) => (
              <li key={item.key} className="flex items-start gap-3 py-3 text-sm">
                {item.ok ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-label="Configurado" />
                ) : (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-red-500" aria-label="Falta configurar" />
                )}
                <div>
                  <p className="font-medium text-stone-800">{item.label}</p>
                  {item.missing.length ? (
                    <p className="text-stone-500">
                      Falta: <code className="rounded bg-stone-100 px-1">{item.missing.join(', ')}</code>
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}
