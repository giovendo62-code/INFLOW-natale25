import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export const useLayoutStore = create<LayoutState>()(
    persist(
        (set) => ({
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
        }),
        {
            name: 'layout-storage', // unique name
            partialize: (state) => ({ theme: state.theme, accentColor: state.accentColor }), // only persist theme and color
        }
    )
);
