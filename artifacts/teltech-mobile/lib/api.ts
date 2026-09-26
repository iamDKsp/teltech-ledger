import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';
import * as SecureStore from 'expo-secure-store';

export const API_TOKEN_KEY = 'teltech_auth_token';

export async function getToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(API_TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(API_TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(API_TOKEN_KEY);
}

// Register the token getter with the API client
setAuthTokenGetter(getToken);

export function initializeApi(baseUrl: string) {
  setBaseUrl(baseUrl);
}
