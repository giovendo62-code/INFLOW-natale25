import { create } from 'zustand';

interface LayoutState {
    isSidebarVisible: boolean;
    setSidebarVisible: (visible: boolean) => void;
    toggleSidebar: () => void;
    isPrivacyMode: boolean;
    togglePrivacyMode: () => void;
    isMobileFullscreen: boolean;
    toggleMobileFullscreen: () => void;
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
    accentColor: string;
    setAccentColor: (color: string) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
    isSidebarVisible: true,
    setSidebarVisible: (visible) => set({ isSidebarVisible: visible }),
    toggleSidebar: () => set((state) => ({ isSidebarVisible: !state.isSidebarVisible })),
    isPrivacyMode: false,
    togglePrivacyMode: () => set((state) => ({ isPrivacyMode: !state.isPrivacyMode })),
    isMobileFullscreen: false,
    toggleMobileFullscreen: () => set((state) => ({ isMobileFullscreen: !state.isMobileFullscreen })),
    theme: 'dark',
    setTheme: (theme) => set({ theme }),
    accentColor: '#FF6B35', // Default Orange
    setAccentColor: (color) => set({ accentColor: color }),
}));
