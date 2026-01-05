-- Esegui questo script nell'Editor SQL di Supabase per confermare manualmente l'utente
-- Questo serve se l'email di conferma non arriva o è finita nello spam.

UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'giounifi92@gmail.com';

-- DOPO AVER ESEGUITO QUESTO SCRIPT:
-- 1. Torna alla pagina di Login dell'app
-- 2. Effettua l'accesso con email e password
-- 3. L'invito pendente verrà processato automaticamente
