import type { APIRoute } from 'astro';
import { AUTH_COOKIE_NAME } from '../../lib/auth';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
  return redirect('/');
};

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
  return redirect('/');
};
