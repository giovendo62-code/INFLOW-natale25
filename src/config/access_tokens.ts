export const REGISTRATION_ACCESS_TOKENS = [
    'INK-2026-A',
    'INK-2026-B',
    'INK-2026-C',
    'INK-2026-D',
    'INK-2026-E',
    'INK-2026-F',
    'INK-2026-G',
    'INK-2026-H',
    'INK-2026-I',
    'INK-2026-J'
];

export const isValidRegistrationToken = (token: string): boolean => {
    return REGISTRATION_ACCESS_TOKENS.includes(token.trim());
};
