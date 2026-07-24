import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'ge_token';
const ME_KEY = 'ge_me';

export const storage = {
  async getToken() { return SecureStore.getItemAsync(TOKEN_KEY); },
  async setToken(v: string) { return SecureStore.setItemAsync(TOKEN_KEY, v); },
  async clearToken() { return SecureStore.deleteItemAsync(TOKEN_KEY); },
  async getMe() {
    const s = await SecureStore.getItemAsync(ME_KEY);
    return s ? JSON.parse(s) : null;
  },
  async setMe(v: object) { return SecureStore.setItemAsync(ME_KEY, JSON.stringify(v)); },
  async clearMe() { return SecureStore.deleteItemAsync(ME_KEY); },
};
