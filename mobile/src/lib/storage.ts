import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'ge_token';          // JWT (Bearer do backend)
const SESSION_KEY = 'ge_session';      // token de sessão Better Auth
const COOKIE_KEY = 'ge_cookie';        // cookie bruto do Neon Auth
const ME_KEY = 'ge_me';

export const storage = {
  async getToken() { return SecureStore.getItemAsync(TOKEN_KEY); },
  async setToken(v: string) { return SecureStore.setItemAsync(TOKEN_KEY, v); },
  async clearToken() { return SecureStore.deleteItemAsync(TOKEN_KEY); },

  async getSession() { return SecureStore.getItemAsync(SESSION_KEY); },
  async setSession(v: string) { return SecureStore.setItemAsync(SESSION_KEY, v); },
  async clearSession() { return SecureStore.deleteItemAsync(SESSION_KEY); },

  async getCookie() { return SecureStore.getItemAsync(COOKIE_KEY); },
  async setCookie(v: string) { return SecureStore.setItemAsync(COOKIE_KEY, v); },
  async clearCookie() { return SecureStore.deleteItemAsync(COOKIE_KEY); },

  async getMe() {
    const s = await SecureStore.getItemAsync(ME_KEY);
    return s ? JSON.parse(s) : null;
  },
  async setMe(v: object) { return SecureStore.setItemAsync(ME_KEY, JSON.stringify(v)); },
  async clearMe() { return SecureStore.deleteItemAsync(ME_KEY); },

  async clearAll() {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(SESSION_KEY),
      SecureStore.deleteItemAsync(COOKIE_KEY),
      SecureStore.deleteItemAsync(ME_KEY),
    ]);
  },
};
