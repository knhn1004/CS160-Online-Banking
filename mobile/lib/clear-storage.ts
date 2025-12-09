/**
 * Utility to clear all app storage (useful for debugging/resetting app state)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/**
 * Clear all AsyncStorage data
 */
export async function clearAllStorage(): Promise<void> {
	try {
		await AsyncStorage.clear();
		console.log('✅ All AsyncStorage data cleared');
	} catch (error) {
		console.error('❌ Error clearing AsyncStorage:', error);
		throw error;
	}
}

/**
 * Clear only Supabase auth storage
 */
export async function clearAuthStorage(): Promise<void> {
	try {
		// Sign out from Supabase (this clears auth storage)
		await supabase.auth.signOut();

		// Also clear any Supabase-related keys manually
		const keys = await AsyncStorage.getAllKeys();
		const supabaseKeys = keys.filter(
			key => key.startsWith('sb-') || key.includes('supabase')
		);

		if (supabaseKeys.length > 0) {
			await AsyncStorage.multiRemove(supabaseKeys);
		}

		console.log('✅ Auth storage cleared');
	} catch (error) {
		console.error('❌ Error clearing auth storage:', error);
		throw error;
	}
}

/**
 * Reset app to clean state (clear all storage and sign out)
 */
export async function resetApp(): Promise<void> {
	try {
		await clearAuthStorage();
		await clearAllStorage();
		console.log('✅ App reset complete');
	} catch (error) {
		console.error('❌ Error resetting app:', error);
		throw error;
	}
}
