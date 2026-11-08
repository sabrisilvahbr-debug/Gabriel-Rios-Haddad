'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  checkPassword,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth/session';
import { optionalEnv } from '@/lib/env';

export type LoginState = { error: string } | null;

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '';
  return /^\/painel(\/[\w\-/]*)?$/.test(next) ? next : '/painel';
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!optionalEnv('ADMIN_PASSWORD') || !optionalEnv('SESSION_SECRET')) {
    return { error: 'Configure ADMIN_PASSWORD e SESSION_SECRET nas variáveis de ambiente e faça um novo deploy.' };
  }
  const password = String(formData.get('password') ?? '');
  if (!checkPassword(password)) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { error: 'Senha incorreta.' };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect(safeNext(formData.get('next')));
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect('/login');
}
