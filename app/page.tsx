import { createClient } from '@/utils/supabase/server';

export default async function Page() {
	const supabase = await createClient();

	return (
		<h1>CS 160 Online Banking</h1>
	);
}
