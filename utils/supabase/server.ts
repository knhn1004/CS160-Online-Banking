import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;


export const createClient = () => {
	return createServerClient(supabaseUrl!, supabaseKey!, {
		cookies: {
			get(name: string) {
				return (cookies() as any).get(name)?.value;
			},
			set(name: string, value: string, options: CookieOptions) {
				(cookies() as any).set({ name, value, ...options });
			},
			remove(name: string, options: CookieOptions) {
				(cookies() as any).set({ name, value: '', ...options });
			},
		},
	});
};
