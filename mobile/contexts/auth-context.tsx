import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
	user: User | null;
	session: Session | null;
	loading: boolean;
	signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
	signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
	signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const queryClient = useQueryClient();
	const [user, setUser] = useState<User | null>(null);
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Get initial session
		supabase.auth
			.getSession()
			.then(({ data: { session }, error }) => {
				// If there's an error (e.g., invalid refresh token), clear the session
				if (error) {
					console.debug('Session restore error:', error.message);
					setSession(null);
					setUser(null);
				} else {
					setSession(session);
					setUser(session?.user ?? null);
					// Update API client with initial session
					api.setSession(session);
				}
				setLoading(false);
			})
			.catch(error => {
				// Handle any unexpected errors during session restoration
				console.debug('Session restore failed:', error);
				setSession(null);
				setUser(null);
				setLoading(false);
			});

		// Listen for auth changes including token refresh
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event, session) => {
			// Handle different auth events
			// Only log important events, not every token refresh (too noisy)
			if (event === 'SIGNED_OUT') {
				console.debug('User signed out');
				// Clear all cached queries when user signs out
				queryClient.clear();
			} else if (event === 'SIGNED_IN') {
				console.debug('User signed in');
			} else if (event === 'TOKEN_REFRESHED') {
				// Token was refreshed - session is updated automatically
				console.debug('Token refreshed');
			}

			// Update local state
			setSession(session);
			setUser(session?.user ?? null);

			// Update API client with current session
			// This ensures API client always has the latest session
			api.setSession(session);

			setLoading(false);
		});

		return () => subscription.unsubscribe();
	}, [queryClient]);

	const signIn = async (email: string, password: string) => {
		try {
			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) {
				return { error: new Error(error.message) };
			}

			// Update session immediately from the response
			// This ensures session is available before redirect
			if (data.session) {
				// Verify session has access_token before setting
				if (!data.session.access_token) {
					console.error('Session from signIn missing access_token');
					return { error: new Error('Invalid session: missing access token') };
				}

				setSession(data.session);
				setUser(data.session.user);
				// Update API client immediately to avoid race conditions
				api.setSession(data.session);
				setLoading(false);
			} else {
				console.warn('signIn succeeded but no session returned');
			}

			return { error: null };
		} catch (error) {
			return {
				error: error instanceof Error ? error : new Error('Sign in failed'),
			};
		}
	};

	const signUp = async (email: string, password: string) => {
		try {
			const { data, error } = await supabase.auth.signUp({
				email,
				password,
			});

			if (error) {
				return { error: new Error(error.message) };
			}

			// Update session if available (may not be available if email confirmation is required)
			if (data.session) {
				setSession(data.session);
				setUser(data.session.user);
				// Update API client immediately if session is available
				api.setSession(data.session);
				setLoading(false);
			}

			return { error: null };
		} catch (error) {
			return {
				error: error instanceof Error ? error : new Error('Sign up failed'),
			};
		}
	};

	const signOut = async () => {
		// Clear local state immediately to ensure UI updates
		setUser(null);
		setSession(null);
		// Clear API client session immediately
		api.setSession(null);

		// Clear all TanStack Query cache to remove user-specific data
		// This ensures profile and other cached data is cleared on logout
		queryClient.clear();

		// Sign out from Supabase (best effort - state already cleared)
		try {
			await supabase.auth.signOut();
			// Clear any remaining auth storage
			const { clearAuthStorage } = await import('@/lib/clear-storage');
			await clearAuthStorage().catch(() => {
				// Ignore errors - state is already cleared
			});
		} catch {
			// Ignore errors - local state is already cleared
			// The auth state change listener will handle any remaining cleanup
		}
	};

	return (
		<AuthContext.Provider
			value={{ user, session, loading, signIn, signUp, signOut }}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
}
