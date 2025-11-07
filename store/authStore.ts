import { create } from 'zustand';

interface AuthState {
  userId?: string;
  setUserId: (id?: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: undefined,
  setUserId: (userId) => set({ userId }),
}));