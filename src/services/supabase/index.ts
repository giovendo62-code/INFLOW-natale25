import { supabase } from '../../lib/supabase';

import type { IRepository, AuthSession, User, Appointment, Client, Transaction, FinancialStats, CourseMaterial, StudentAttendance, ClientConsent, ArtistContract, PresenceLog, MarketingCampaign, WaitlistEntry, Course, Communication, CommunicationReply, ConsentTemplate, CourseEnrollment, AttendanceLog, UserRole, Studio } from '../types';

// Helper to identify the studio owner for Google Sync
const getStudioOwnerId = async (studioId: string): Promise<string | null> => {
    try {
        const { data } = await supabase
            .from('studio_memberships')
            .select('user_id')
            .eq('studio_id', studioId)
            .eq('role', 'owner')
            .limit(1)
            .maybeSingle();
        return data?.user_id || null;
    } catch (err) {
        console.error('Error fetching studio owner:', err);
        return null;
    }
};

export class SupabaseRepository implements IRepository {
    auth = {
        signIn: async (email: string, password: string): Promise<AuthSession> => {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            // Fetch user profile from 'users' table
            const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single();

            // Fetch active membership to get real role and studio_id
            const { data: membership } = await supabase
                .from('studio_memberships')
                .select('*')
                .eq('user_id', data.user.id)
                .maybeSingle();

            // Prioritize membership role/studio if exists, else fallback to user data or defaults
            const user: User = userData ? {
                ...userData,
                role: (membership?.role as UserRole) || userData.role || 'STUDENT',
                studio_id: membership?.studio_id || userData.studio_id || 'default',
                permissions: {
                    can_view_clients: membership?.can_view_clients ?? true,
                    can_view_others_financials: membership?.can_view_others_financials ?? false
                }
            } : {
                id: data.user.id,
                email: data.user.email!,
                full_name: data.user.user_metadata.full_name || 'User',
                role: (membership?.role as UserRole) || 'STUDENT',
                studio_id: membership?.studio_id || 'default'
            };

            console.log('SignIn Resolved User:', user);

            return {
                user,
                token: data.session.access_token
            };
        },
        signUp: async (email: string, password: string, redirectUrl?: string): Promise<AuthSession | null> => {
            const options = redirectUrl ? { emailRedirectTo: redirectUrl } : undefined;
            const { data, error } = await supabase.auth.signUp({ email, password, options });
            if (error) throw error;

            // If confirmation is required, session might be null
            if (!data.session) return null;

            // Prepare minimal user object
            const user: User = {
                id: data.user!.id,
                email: data.user!.email!,
                full_name: 'New User',
                role: 'STUDENT', // Default role
                studio_id: 'default'
            };

            return {
                user,
                token: data.session.access_token
            };
        },
        signOut: async (): Promise<void> => {
            await supabase.auth.signOut();
        },
        getCurrentUser: async (): Promise<User | null> => {
            console.log('[REPO] getCurrentUser: getting session...');
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
                console.log('[REPO] getCurrentUser: no session found.');
                return null;
            }
            console.log('[REPO] getCurrentUser: session found for', data.session.user.id);

            console.log('[REPO] getCurrentUser: fetching user profile...');
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.session.user.id)
                .single();
            if (userError) console.warn('[REPO] getCurrentUser: fetch user profile error (minor):', userError.message);

            console.log('[REPO] getCurrentUser: fetching membership...');
            const { data: membership, error: memError } = await supabase
                .from('studio_memberships')
                .select('*')
                .eq('user_id', data.session.user.id)
                .maybeSingle();
            if (memError) console.warn('[REPO] getCurrentUser: fetch membership error (minor):', memError.message);

            console.log('[REPO] getCurrentUser: fetching integrations...');
            // Fetch integrations separately (safer than join if FK is missing on public.users)
            const { data: integrations, error: intError } = await supabase
                .from('user_integrations')
                .select('*')
                .eq('user_id', data.session.user.id);
            if (intError) console.warn('[REPO] getCurrentUser: fetch integrations error (minor):', intError.message);

            const googleIntegration = integrations?.find((i: any) => i.provider === 'google');
            console.log('[REPO] getCurrentUser: integrations fetched.', googleIntegration ? 'Google connected' : 'No Google');

            // Merge membership info into user object
            if (userData) {
                return {
                    ...userData,
                    role: (membership?.role as UserRole) || userData.role || 'STUDENT',
                    studio_id: membership?.studio_id || userData.studio_id || 'default',
                    permissions: {
                        can_view_clients: membership?.can_view_clients ?? true,
                        can_view_others_financials: membership?.can_view_others_financials ?? false
                    },
                    integrations: {
                        google_calendar: {
                            is_connected: !!googleIntegration,
                            email: googleIntegration?.settings?.email,
                            last_sync: googleIntegration?.updated_at,
                            auto_sync: true,
                            calendar_mapping: googleIntegration?.settings?.calendar_mapping,
                            two_way_sync: googleIntegration?.settings?.two_way_sync,
                        }
                    }
                };
            }

            // Fallback if public.users record is missing (but Auth exists)
            console.log('[REPO] getCurrentUser: Fallback user (missing profile).');
            return {
                id: data.session.user.id,
                email: data.session.user.email!,
                full_name: 'User',
                role: (membership?.role as UserRole) || 'STUDENT',
                studio_id: membership?.studio_id || 'default',
                permissions: {
                    can_view_clients: membership?.can_view_clients ?? true,
                    can_view_others_financials: membership?.can_view_others_financials ?? false
                }
            };
        },
        resetPasswordForEmail: async (email: string, redirectTo: string): Promise<void> => {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: redirectTo
            });
            if (error) throw error;
        },
        updatePassword: async (password: string): Promise<void> => {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
        }
    };

    appointments = {
        list: async (start: Date, end: Date, artistId?: string, studioId?: string): Promise<Appointment[]> => {
            let query = supabase
                .from('appointments')
                .select('*, client:clients(*)')
                .gte('start_time', start.toISOString())
                .lte('start_time', end.toISOString());

            if (artistId) {
                query = query.eq('artist_id', artistId);
            }

            if (studioId) {
                query = query.eq('studio_id', studioId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as Appointment[];
        },
        get: async (id: string): Promise<Appointment | null> => {
            const { data, error } = await supabase
                .from('appointments')
                .select('*, client:clients(*)')
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error fetching appointment:', error);
                return null;
            }
            return data as Appointment;
        },
        create: async (data: Omit<Appointment, 'id'>): Promise<Appointment> => {
            console.log('[DEBUG] createAppointment called with:', JSON.stringify(data));
            const { data: newApt, error } = await supabase
                .from('appointments')
                .insert(data)
                .select()
                .single();
            if (error) {
                console.error('[DEBUG] createAppointment failed:', error);
                throw error;
            }
            console.log('[DEBUG] createAppointment success:', newApt);

            // Trigger Google Sync (Outbound)
            // Use Studio Owner ID for sync to ensure we access the correct integration/mappings
            const ownerId = await getStudioOwnerId(newApt.studio_id);
            const { data: { session: createSession } } = await supabase.auth.getSession();
            // Fallback to current user if owner not found (though unlikely for valid studio)
            const syncUserId = ownerId || createSession?.user?.id;

            if (syncUserId) {
                // Non-blocking call
                supabase.functions.invoke('push-to-google-calendar', {
                    body: {
                        action: 'create',
                        appointment: newApt,
                        user_id: syncUserId
                    }
                }).then(({ data, error: syncError }) => {
                    if (syncError) {
                        console.warn('Google Sync (Create) failed:', syncError);
                    } else if (data?.message) {
                        console.warn('Google Sync (Create) info:', data.message);
                        if (data.message === 'No calendar mapped') {
                            console.warn('--> ATTENZIONE: Nessun calendario mappato per questo artista.');
                        }
                    } else {
                        console.log('Google Sync (Create) success:', data);
                    }
                });
            }

            // Auto-generate transaction if created with COMPLETED status
            if (newApt.status === 'COMPLETED') {
                try {
                    console.log('[DEBUG] Auto-generating transaction for NEW appointment:', newApt.id);
                    const amount = Number(newApt.price || 0);

                    if (amount > 0) {
                        // Fetch Client Name for description
                        let clientName = 'Cliente';
                        if (newApt.client_id) {
                            const { data: clientData } = await supabase
                                .from('clients')
                                .select('full_name')
                                .eq('id', newApt.client_id)
                                .single();
                            if (clientData?.full_name) {
                                clientName = clientData.full_name;
                            }
                        }

                        const txData = {
                            studio_id: newApt.studio_id,
                            artist_id: newApt.artist_id,
                            amount: amount,
                            type: 'INCOME',
                            category: 'SERVICE',
                            date: new Date().toISOString(),
                            description: `${newApt.service_name || 'Servizio'} - ${clientName}`
                        };
                        console.log('[DEBUG] Inserting transaction data:', JSON.stringify(txData));

                        const { error: txError } = await supabase
                            .from('transactions')
                            .insert(txData);

                        if (txError) {
                            console.error('[DEBUG] Transaction Insert Error:', txError);
                        } else {
                            console.log('[DEBUG] Transaction created successfully during appointment creation');
                        }
                    }
                } catch (txError) {
                    console.error('[DEBUG] Failed to auto-create transaction (exception):', txError);
                }
            }

            return newApt;
        },
        update: async (id: string, data: Partial<Appointment>): Promise<Appointment> => {
            console.log('[DEBUG] updateAppointment called for:', id, 'with data:', JSON.stringify(data));

            // 1. Get current status to prevent duplicate transactions
            const { data: current, error: fetchError } = await supabase
                .from('appointments')
                .select('status, studio_id, artist_id, price, service_name, client_id')
                .eq('id', id)
                .single();

            if (fetchError) {
                console.error('[DEBUG] Failed to fetch current appointment:', fetchError);
                throw fetchError;
            }

            // 2. Perform Update
            const { data: updated, error } = await supabase
                .from('appointments')
                .update(data)
                .eq('id', id)
                .select()
                .single();
            if (error) {
                console.error('[DEBUG] Failed to update appointment:', error);
                throw error;
            }

            console.log('[DEBUG] Appointment updated. Status change:', current.status, '->', updated.status);

            // 3. Logic for Financial Transactions

            // CASE A: Status changed TO COMPLETED
            if (current.status !== 'COMPLETED' && updated.status === 'COMPLETED') {
                try {
                    console.log('[DEBUG] Appointment completed. Checking for existing transaction...');

                    // Check if transaction already exists for this appointment
                    const { data: existingTx } = await supabase
                        .from('transactions')
                        .select('id')
                        .eq('appointment_id', id)
                        .maybeSingle();

                    if (existingTx) {
                        console.log('[DEBUG] Transaction already exists for this appointment. Skipping creation.');
                        // Do not return here, as Google Sync still needs to run.
                    } else {
                        console.log('[DEBUG] Creating new transaction for appointment:', id);
                        const amount = Number(updated.price || 0);

                        if (amount > 0) {
                            // Fetch Client Name
                            let clientName = 'Cliente';
                            if (updated.client_id) {
                                const { data: clientData } = await supabase
                                    .from('clients')
                                    .select('full_name')
                                    .eq('id', updated.client_id)
                                    .single();
                                if (clientData?.full_name) {
                                    clientName = clientData.full_name;
                                }
                            }

                            const txData = {
                                studio_id: updated.studio_id,
                                artist_id: updated.artist_id,
                                appointment_id: id, // Link to appointment
                                amount: amount,
                                type: 'INCOME',
                                category: 'SERVICE',
                                date: new Date().toISOString(),
                                description: `${updated.service_name || 'Servizio'} - ${clientName}`
                            };

                            const { error: txError } = await supabase
                                .from('transactions')
                                .insert(txData);

                            if (txError) {
                                console.error('[DEBUG] Transaction Insert Error:', txError);
                            } else {
                                console.log('[DEBUG] Transaction created successfully.');
                            }
                        }
                    }
                } catch (txError) {
                    console.error('[DEBUG] Failed to handle transaction creation:', txError);
                }
            }

            // CASE B: Status changed FROM COMPLETED (Rollback)
            if (current.status === 'COMPLETED' && updated.status !== 'COMPLETED') {
                try {
                    console.log('[DEBUG] Appointment un-completed. Removing associated transaction...');

                    const { error: deleteError } = await supabase
                        .from('transactions')
                        .delete()
                        .eq('appointment_id', id);

                    if (deleteError) {
                        console.error('[DEBUG] Failed to delete transaction:', deleteError);
                    } else {
                        console.log('[DEBUG] Associated transaction passed to history.');
                    }
                } catch (err) {
                    console.error('[DEBUG] Error removing transaction:', err);
                }
            }

            // Trigger Google Sync (Outbound)
            // Use Studio Owner ID
            const ownerId = await getStudioOwnerId(updated.studio_id);
            const { data: { session: updateSession } } = await supabase.auth.getSession();
            const syncUserId = ownerId || updateSession?.user?.id;

            if (syncUserId) {
                // Non-blocking call
                supabase.functions.invoke('push-to-google-calendar', {
                    body: {
                        action: 'update',
                        appointment: updated,
                        user_id: syncUserId
                    }
                }).then(({ data, error: syncError }) => {
                    if (syncError) {
                        console.warn('Google Sync (Update) failed:', syncError);
                    } else if (data?.message) {
                        console.warn('Google Sync (Update) info:', data.message);
                        if (data.message === 'No calendar mapped') {
                            console.warn('--> ATTENZIONE: Nessun calendario mappato per questo artista.');
                        }
                    } else {
                        console.log('Google Sync (Update) success:', data);
                    }
                });
            }

            return updated;
        },
        delete: async (id: string): Promise<void> => {
            // Fetch appointment first to get google_event_id and artist_id
            const { data: apt } = await supabase.from('appointments').select('*').eq('id', id).maybeSingle();

            const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', id);
            if (error) throw error;

            // Trigger Google Sync (Outbound)
            if (apt) {
                const ownerId = await getStudioOwnerId(apt.studio_id);
                const { data: { session: deleteSession } } = await supabase.auth.getSession();
                const syncUserId = ownerId || deleteSession?.user?.id;

                if (syncUserId) {
                    supabase.functions.invoke('push-to-google-calendar', {
                        body: {
                            action: 'delete',
                            appointment: apt,
                            user_id: syncUserId
                        }
                    }).then(({ data, error: syncError }) => {
                        if (syncError) {
                            console.warn('Google Sync (Delete) failed:', syncError);
                        } else if (data?.message) {
                            console.log('Google Sync (Delete) response:', data.message);
                        }
                    });
                }
            }
        },
        listByClient: async (clientId: string): Promise<Appointment[]> => {
            const { data, error } = await supabase
                .from('appointments')
                .select('*, client:clients(*)')
                .eq('client_id', clientId)
                .order('start_time', { ascending: false });

            if (error) throw error;
            return data as Appointment[];
        }
    };

    clients = {
        list: async (search?: string, studioId?: string): Promise<Client[]> => {
            let query = supabase.from('clients').select('*');
            if (search) {
                query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
            }
            if (studioId) {
                query = query.eq('studio_id', studioId);
            }
            query = query.order('full_name', { ascending: true });
            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
        getById: async (id: string): Promise<Client | null> => {
            const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
            if (error) return null;
            return data;
        },
        getByContact: async (email: string, phone: string, studioId: string): Promise<string | null> => {
            try {
                // Timeout promise
                const timeout = new Promise<null>((resolve) => {
                    setTimeout(() => {
                        console.warn("SupabaseRepository: getByContact RPC timed out after 5000ms. Returning null (proceed as new).");
                        resolve(null);
                    }, 5000);
                });

                // RPC promise
                const rpcCall = (async () => {
                    const { data, error } = await supabase.rpc('get_client_by_contact_v2', {
                        p_email: email,
                        p_phone: phone,
                        p_studio_id: studioId
                    });

                    if (error) {
                        console.error('Error in getByContact RPC:', error);
                        return null;
                    }
                    return data;
                })();

                // Race them
                return await Promise.race([rpcCall, timeout]);
            } catch (e) {
                console.error("Unexpected error in getByContact:", e);
                return null;
            }
        },
        create: async (data: Omit<Client, 'id'>): Promise<Client> => {
            // Sanitize input: Convert empty strings to null for unique fields to avoid constraint violations
            const sanitizedData = {
                ...data,
                email: data.email?.trim() || null,
                phone: data.phone?.trim() || null,
                // Also helpful for other optional fields
                fiscal_code: data.fiscal_code?.trim() || null,
            };

            const { data: newClient, error } = await supabase.from('clients').insert(sanitizedData).select().single();
            if (error) throw error;

            // Google Sheets Auto-Sync
            if (newClient.studio_id) {
                // Fetch Studio Config
                const { data: studio } = await supabase
                    .from('studios')
                    .select('google_sheets_config')
                    .eq('id', newClient.studio_id)
                    .single();

                const config = studio?.google_sheets_config as any;

                if (config && config.auto_sync_enabled && config.spreadsheet_id && config.sheet_name) {
                    console.log('[Auto-Sync] Triggering append for client:', newClient.id);

                    let row: any[] = [];
                    const mapping = config.mapping as Record<string, string> | undefined;

                    if (mapping && Object.keys(mapping).length > 0) {
                        // Use configured mapping
                        const fields = Object.values(mapping);
                        row = fields.map(field => {
                            if (field === 'first_name') return (newClient.full_name || '').split(' ')[0] || '';
                            if (field === 'last_name') {
                                const parts = (newClient.full_name || '').split(' ');
                                return parts.length > 1 ? parts.slice(1).join(' ') : '';
                            }
                            if (field === 'created_at') return new Date().toLocaleDateString();
                            if (field === 'preferred_styles') return Array.isArray((newClient as any).preferred_styles) ? (newClient as any).preferred_styles.join(', ') : '';
                            return (newClient as any)[field] || '';
                        });
                    } else {
                        // Default Fallback
                        const [firstName, ...lastNameParts] = (newClient.full_name || '').split(' ');
                        const lastName = lastNameParts.join(' ');
                        row = [
                            firstName || '',
                            lastName || '',
                            newClient.email || '',
                            newClient.phone || '',
                            newClient.fiscal_code || '',
                            newClient.address || '',
                            newClient.city || '',
                            newClient.zip_code || '',
                            newClient.notes || '',
                            new Date().toLocaleDateString()
                        ];
                    }

                    // Non-blocking call
                    supabase.functions.invoke('fetch-google-sheets', {
                        body: {
                            action: 'append_data',
                            spreadsheetId: config.spreadsheet_id,
                            sheetName: config.sheet_name,
                            values: [row]
                        }
                    }).then(({ data, error }) => {
                        if (error) console.error('[Auto-Sync] Edge Function Error:', error);
                        else if (data?.error) console.error('[Auto-Sync] Sheet Error:', data.error);
                        else console.log('[Auto-Sync] Success:', data);
                    }).catch(err => {
                        console.error('[Auto-Sync] Unexpected Error:', err);
                    });
                }
            }

            return newClient;
        },
        createPublic: async (data: Omit<Client, 'id'>): Promise<Pick<Client, 'id' | 'full_name' | 'email'>> => {
            const { data: newClient, error } = await supabase.rpc('create_client_public', {
                p_studio_id: data.studio_id,
                p_full_name: data.full_name,
                p_email: data.email?.trim() || null,
                p_phone: data.phone?.trim() || null,
                p_fiscal_code: data.fiscal_code,
                p_address: data.address,
                p_city: data.city,
                p_zip_code: data.zip_code,
                p_preferred_styles: data.preferred_styles,
                p_whatsapp_broadcast_opt_in: data.whatsapp_broadcast_opt_in
            });
            if (error) throw error;

            // Google Sheets Auto-Sync (Public)
            if (data.studio_id) {
                // Fetch Studio Config
                const { data: studio } = await supabase
                    .from('studios')
                    .select('google_sheets_config')
                    .eq('id', data.studio_id)
                    .single();

                const config = studio?.google_sheets_config as any;

                if (config && config.auto_sync_enabled && config.spreadsheet_id && config.sheet_name) {
                    // console.log('[Auto-Sync] Triggering append for public client');

                    let row: any[] = [];
                    const mapping = config.mapping as Record<string, string> | undefined;

                    if (mapping && Object.keys(mapping).length > 0) {
                        const fields = Object.values(mapping);
                        row = fields.map(field => {
                            // Note: use 'data' object which has all fields
                            if (field === 'first_name') return (data.full_name || '').split(' ')[0] || '';
                            if (field === 'last_name') {
                                const parts = (data.full_name || '').split(' ');
                                return parts.length > 1 ? parts.slice(1).join(' ') : '';
                            }
                            if (field === 'created_at') return new Date().toLocaleDateString();
                            if (field === 'preferred_styles') return Array.isArray((data as any).preferred_styles) ? (data as any).preferred_styles.join(', ') : '';
                            return (data as any)[field] || '';
                        });
                    } else {
                        const [firstName, ...lastNameParts] = (data.full_name || '').split(' ');
                        const lastName = lastNameParts.join(' ');
                        row = [
                            firstName || '',
                            lastName || '',
                            data.email || '',
                            data.phone || '',
                            data.fiscal_code || '',
                            data.address || '',
                            data.city || '',
                            data.zip_code || '',
                            data.notes || '',
                            new Date().toLocaleDateString()
                        ];
                    }

                    supabase.functions.invoke('fetch-google-sheets', {
                        body: {
                            action: 'append_data',
                            spreadsheetId: config.spreadsheet_id,
                            sheetName: config.sheet_name,
                            values: [row]
                        }
                    }).catch(err => console.error('[Auto-Sync Public] Error:', err));
                }
            }

            // The RPC returns { id: ..., full_name: ..., email: ... }
            return newClient as Pick<Client, 'id' | 'full_name' | 'email'>;
        },
        update: async (id: string, data: Partial<Client>): Promise<Client> => {
            const { data: updated, error } = await supabase.from('clients').update(data).eq('id', id).select().single();
            if (error) throw error;
            return updated;
        },
        delete: async (id: string): Promise<void> => {
            const { error } = await supabase.from('clients').delete().eq('id', id);
            if (error) throw error;
        }
    };

    financials = {
        listTransactions: async (startDate: Date, endDate: Date, studioId?: string): Promise<Transaction[]> => {
            let query = supabase
                .from('transactions')
                .select('*')
                .gte('date', startDate.toISOString())
                .lte('date', endDate.toISOString());

            if (studioId) {
                query = query.eq('studio_id', studioId);
            }

            query = query.order('date', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
        createTransaction: async (data: Omit<Transaction, 'id'>): Promise<Transaction> => {
            const { data: newTx, error } = await supabase
                .from('transactions')
                .insert(data)
                .select()
                .single();
            if (error) throw error;
            return newTx;
        },
        deleteTransaction: async (id: string): Promise<void> => {
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        getStats: async (month: Date, studioId?: string): Promise<FinancialStats> => {
            const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
            const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).toISOString();
            const todayStart = new Date().toISOString().split('T')[0];

            let query = supabase
                .from('transactions')
                .select('*')
                .gte('date', startOfMonth)
                .lte('date', endOfMonth);

            if (studioId) {
                query = query.eq('studio_id', studioId);
            }

            const { data: transactions, error } = await query;

            if (error) throw error;

            const stats = {
                revenue_today: 0,
                revenue_month: 0,
                expenses_month: 0
            };

            transactions?.forEach(t => {
                const amount = Number(t.amount);
                const isToday = t.date.startsWith(todayStart);

                if (t.type === 'INCOME') {
                    stats.revenue_month += amount;
                    if (isToday) stats.revenue_today += amount;
                } else if (t.type === 'EXPENSE') {
                    stats.expenses_month += amount;
                }
            });

            return stats;
        },
        listRecurringExpenses: async (studioId: string): Promise<any[]> => {
            const { data, error } = await supabase
                .from('recurring_expenses')
                .select('*')
                .eq('studio_id', studioId);
            if (error) throw error;
            return data;
        },
        createRecurringExpense: async (data: any): Promise<any> => {
            const { data: newRec, error } = await supabase
                .from('recurring_expenses')
                .insert(data)
                .select()
                .single();
            if (error) throw error;
            return newRec;
        },
        deleteRecurringExpense: async (id: string): Promise<void> => {
            const { error } = await supabase
                .from('recurring_expenses')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        generateRecurringTransactions: async (studioId: string, month: Date): Promise<void> => {
            // 1. Get all recurring expenses
            const { data: recurring, error } = await supabase
                .from('recurring_expenses')
                .select('*')
                .eq('studio_id', studioId);

            if (error) throw error;
            if (!recurring || recurring.length === 0) return;

            // 2. Generate transactions for this month
            // Note: Ideally check if already generated to avoid dupes (maybe use idempotency key or check logs)
            // For MVP, we entrust the user not to click twice or we can check simple duplicate.

            const transactions = recurring.map(r => {
                // Construct date: YYYY-MM-DD
                const day = Math.min(r.day_of_month || 1, 28); // Safe day
                const date = new Date(month.getFullYear(), month.getMonth(), day);

                return {
                    studio_id: studioId,
                    amount: r.amount,
                    type: 'EXPENSE',
                    category: r.category || 'FIXED',
                    date: date.toISOString(),
                    description: `${r.name} (Spesa Fissa)`
                };
            });

            const { error: insertError } = await supabase
                .from('transactions')
                .insert(transactions);

            if (insertError) throw insertError;
        }
    };

    // Old academy block removed


    settings = {
        updateProfile: async (userId: string, data: Partial<User>): Promise<User> => {
            const { data: updated, error } = await supabase.from('users').update(data).eq('id', userId).select().single();
            if (error) throw error;
            return updated;
        },
        listTeamMembers: async (studioId: string): Promise<User[]> => {
            console.log('[DEBUG] listTeamMembers (v3) called for studio:', studioId);

            // 1. Fetch memberships
            const { data: memberships, error: memberError } = await supabase
                .from('studio_memberships')
                .select('*')
                .eq('studio_id', studioId);

            if (memberError) {
                console.error('[DEBUG] Failed to fetch memberships:', memberError);
                throw memberError;
            }

            const memberUserIds = (memberships || []).map(m => m.user_id);

            // 2. Fetch users by IDs (from memberships)
            let usersById: User[] = [];
            if (memberUserIds.length > 0) {
                const { data } = await supabase.from('users').select('*').in('id', memberUserIds);
                usersById = data || [];
            }

            // 3. Fetch users by studio_id (orphans)
            const { data: usersByStudio } = await supabase.from('users').select('*').eq('studio_id', studioId);

            // Deduplicate
            const rawUsers = [...usersById, ...(usersByStudio || [])];
            const uniqueMap = new Map<string, User>();
            rawUsers.forEach(u => uniqueMap.set(u.id, u));
            const users = Array.from(uniqueMap.values());

            if (users.length === 0) return [];

            // 3. Merge data
            const mergedUsers = users.map(user => {
                const membership = memberships?.find(m => m.user_id === user.id);
                // Prioritize membership role, fallback to user.role
                let finalRole = membership?.role || user.role;

                // Normalization
                if (finalRole) finalRole = finalRole.toLowerCase();

                return {
                    ...user,
                    role: finalRole as any,
                    permissions: {
                        can_view_clients: membership?.can_view_clients ?? true,
                        can_view_others_financials: membership?.can_view_others_financials ?? false
                    }
                };
            });

            return mergedUsers;
        },

        inviteMember: async (email: string, role: UserRole, studioId: string): Promise<User> => {
            // Generate a token
            const token = crypto.randomUUID();

            // Get current user ID for invited_by
            const { data: { session } } = await supabase.auth.getSession();
            const invitedBy = session?.user?.id;

            // Create invitation record
            const { error } = await supabase.from('studio_invitations').insert({
                email,
                role,
                studio_id: studioId,
                token,
                invited_by: invitedBy
            });

            if (error) throw error;

            // Return a placeholder user for the UI
            return {
                id: `invite-${token}`,
                email,
                full_name: `${email.split('@')[0]} (Invited)`,
                role,
                studio_id: studioId
            } as User;
        },
        getMyPendingInvitations: async () => {
            const { data, error } = await supabase.rpc('get_my_pending_invitations');
            if (error) {
                console.error('Error fetching pending invitations:', error);
                return [];
            }
            return data as { token: string; studio_name: string; role: string; created_at: string }[];
        },
        recoverOrphanedOwner: async () => {
            const { data, error } = await supabase.rpc('recover_orphaned_owner');
            if (error) {
                console.error('Error recovering orphaned owner:', error);
                return null;
            }
            if (data && data.length > 0) {
                return data[0].recovered_studio_name;
            }
            return null;
        },
        removeMember: async (userId: string, studioId: string): Promise<void> => {
            console.log('[DEBUG] Removing member (RPC):', userId, 'from studio:', studioId);

            const { error } = await supabase.rpc('delete_team_member', {
                target_user_id: userId,
                studio_id_input: studioId
            });

            if (error) {
                console.error('[DEBUG] Failed to delete member via RPC:', error);
                throw error;
            }
        },
        getStudio: async (studioId: string): Promise<Studio | null> => {
            // Validate UUID to prevent Postgres errors
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studioId);
            if (!isUUID) {
                console.warn('getStudio called with invalid UUID:', studioId);
                return null;
            }

            const { data, error } = await supabase.from('studios').select('*').eq('id', studioId).single();
            if (error) return null;
            return data as Studio;
        },
        updateStudio: async (studioId: string, data: Partial<Studio>): Promise<Studio> => {
            const { data: updated, error } = await supabase.from('studios').update(data).eq('id', studioId).select().single();
            if (error) throw error;
            return updated as Studio;
        },
        registerStudio: async (name: string, _userId: string): Promise<Studio> => {
            // Get session to ensure created_by matches auth.uid()
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) throw sessionError;
            if (!session || !session.user?.id) {
                throw new Error('Not authenticated');
            }

            const authUserId = session.user.id;

            // 1. Create Studio
            const { data: studio, error: studioError } = await supabase
                .from('studios')
                .insert({ name, created_by: authUserId })
                .select()
                .single();

            if (studioError) throw studioError;

            // 2. Create Membership (Owner)
            const { error: memberError } = await supabase
                .from('studio_memberships')
                .insert({
                    studio_id: studio.id,
                    user_id: authUserId, // Use authUserId here too for safety
                    role: 'owner' // Explicitly 'owner' as requested
                });

            if (memberError) {
                // Ideally rollback studio creation here, but basic implementation for now
                console.error('Failed to create membership, studio orphaned:', studio.id);
                throw memberError;
            }

            return studio as Studio;
        },
        checkMembership: async (userId: string): Promise<boolean> => {
            const { count, error } = await supabase
                .from('studio_memberships')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId);

            if (error) {
                console.error('Error checking membership:', error);
                return false;
            }
            return (count || 0) > 0;
        },
        createInvitation: async (studioId: string, email: string, role: UserRole, token: string, invitedBy: string): Promise<void> => {
            const { error } = await supabase
                .from('studio_invitations')
                .insert({
                    studio_id: studioId,
                    email,
                    role,
                    token,
                    invited_by: invitedBy
                });

            if (error) throw error;
        },
        getInvitation: async (token: string) => {
            console.log('[DEBUG] getInvitation calling RPC (v2) with token:', token);
            // Use v2 RPC to ensure clean slate
            const { data, error } = await supabase
                .rpc('get_invitation_by_token_v2', { token_input: token });

            if (error) {
                console.error('[DEBUG] RPC Error:', JSON.stringify(error, null, 2));
                throw error;
            }

            console.log('[DEBUG] RPC Success. Data:', data);
            // RPC returns an array of rows, we expect single or empty
            const invite = data && data.length > 0 ? data[0] : null;
            return invite;
        },
        acceptInvitation: async (token: string, userId: string, studioId: string, role: string) => {
            // 1. Create Membership
            const { error: memberError } = await supabase
                .from('studio_memberships')
                .insert({
                    studio_id: studioId,
                    user_id: userId,
                    role: role
                });

            // If user is already member, proceed 
            if (memberError && memberError.code !== '23505') throw memberError;

            // 2. Update User Profile (Crucial for visibility in lists)
            const { error: userError } = await supabase
                .from('users')
                .update({
                    studio_id: studioId,
                    role: role
                })
                .eq('id', userId);

            if (userError) throw userError;

            // 3. Mark Invitation as Used
            const { error: inviteError } = await supabase
                .from('studio_invitations')
                .update({ used_at: new Date().toISOString() })
                .eq('token', token);

            if (inviteError) {
                console.error('Failed to mark invitation as used:', token);
            }
        },
        updateMemberPermissions: async (studioId: string, userId: string, permissions: { can_view_clients?: boolean; can_view_others_financials?: boolean }): Promise<void> => {
            const { error } = await supabase
                .from('studio_memberships')
                .update(permissions)
                .eq('studio_id', studioId)
                .eq('user_id', userId);

            if (error) throw error;
        }
    };


    artists = {
        list: async (studioId: string): Promise<User[]> => {
            // 1. Fetch memberships first (Same logic as listTeamMembers)
            const { data: memberships, error: memberError } = await supabase
                .from('studio_memberships')
                .select('*')
                .eq('studio_id', studioId);

            if (memberError) throw memberError;
            if (!memberships || memberships.length === 0) return [];

            const userIds = memberships.map(m => m.user_id);

            // 2. Fetch users details
            const { data: users, error: userError } = await supabase
                .from('users')
                .select('*')
                .in('id', userIds);

            if (userError) throw userError;

            // 3. Fetch integrations
            const { data: integrations } = await supabase
                .from('user_integrations')
                .select('*')
                .in('user_id', userIds);

            // 4. Merge data
            return users.map((user: any) => {
                const membership = memberships.find(m => m.user_id === user.id);
                // Prioritize membership role
                const finalRole = membership?.role || user.role;

                return {
                    ...user,
                    role: finalRole,
                    integrations: {
                        google_calendar: {
                            is_connected: !!integrations?.find((i: any) => i.user_id === user.id && i.provider === 'google'),
                            email: integrations?.find((i: any) => i.user_id === user.id && i.provider === 'google')?.settings?.email,
                            last_sync: integrations?.find((i: any) => i.user_id === user.id && i.provider === 'google')?.updated_at,
                            auto_sync: true
                        }
                    }
                };
            });
        },
        getContract: async (artistId: string): Promise<ArtistContract | null> => {
            const { data, error } = await supabase
                .from('artist_contracts')
                .select('*')
                .eq('artist_id', artistId)
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        updateContract: async (artistId: string, data: Partial<ArtistContract>): Promise<ArtistContract> => {
            // Check if exists first
            const { data: existing } = await supabase
                .from('artist_contracts')
                .select('id')
                .eq('artist_id', artistId)
                .maybeSingle();

            if (existing) {
                const { data: updated, error } = await supabase
                    .from('artist_contracts')
                    .update({ ...data, updated_at: new Date().toISOString() })
                    .eq('artist_id', artistId)
                    .select()
                    .single();
                if (error) throw error;
                return updated;
            } else {
                const { data: created, error } = await supabase
                    .from('artist_contracts')
                    .insert({
                        ...data,
                        artist_id: artistId,
                        // studio_id should be passed or we assume it matches artist's studio. 
                        // data is Partial, so might be missing.
                        // Ideally we should get artist's studio_id first.
                        updated_at: new Date().toISOString()
                    })
                    .select()
                    .single();
                if (error) throw error;
                return created;
            }
        },
        addPresence: async (artistId: string, studioId: string, userId: string): Promise<void> => {
            // 1. Get contract to check limits
            const { data: contract, error: contractError } = await supabase
                .from('artist_contracts')
                .select('*')
                .eq('artist_id', artistId)
                .single();

            if (contractError) throw contractError;
            if (contract.rent_type !== 'PRESENCES') throw new Error('Not a presence contract');

            // Check limit
            if (contract.presence_package_limit && contract.used_presences >= contract.presence_package_limit) {
                throw new Error('Presence limit reached');
            }

            // 2. Increment presence
            const { error: updateError } = await supabase
                .from('artist_contracts')
                .update({ used_presences: (contract.used_presences || 0) + 1 })
                .eq('id', contract.id);

            if (updateError) throw updateError;

            // 3. Log it
            await supabase.from('presence_logs').insert({
                studio_id: studioId,
                artist_id: artistId,
                action: 'ADD',
                created_by: userId
            });
        },
        resetPresences: async (artistId: string, studioId: string, userId: string, note?: string): Promise<void> => {
            const { error: updateError } = await supabase
                .from('artist_contracts')
                .update({
                    used_presences: 0,
                    presence_cycle_start: new Date().toISOString()
                })
                .eq('artist_id', artistId);

            if (updateError) throw updateError;

            await supabase.from('presence_logs').insert({
                studio_id: studioId,
                artist_id: artistId,
                action: 'RESET',
                created_by: userId,
                note
            });
        },
        getPresenceLogs: async (artistId: string): Promise<PresenceLog[]> => {
            const { data, error } = await supabase
                .from('presence_logs')
                .select('*')
                .eq('artist_id', artistId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        }
    };

    waitlist = {
        list: async (studioId: string): Promise<WaitlistEntry[]> => {
            const { data, error } = await supabase
                .from('waitlist_entries')
                .select('id, studio_id, client_id, email, phone, client_name, preferred_artist_id, styles, description, status, created_at, interest_type, notes, images')
                .eq('studio_id', studioId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        addToWaitlist: async (data: Omit<WaitlistEntry, 'id' | 'created_at' | 'status'>, _signatureData?: string, _templateVersion?: number): Promise<WaitlistEntry> => {
            // Note: signatureData handling depends on implementation (if storing consent).
            // For now, just insert the entry.
            const { data: entry, error } = await supabase
                .from('waitlist_entries')
                .insert({
                    ...data,
                })
                .select()
                .single();
            if (error) throw error;
            return entry;
        },
        addToWaitlistPublic: async (data: Omit<WaitlistEntry, 'id' | 'created_at' | 'status'>, _signatureData?: string, _templateVersion?: number): Promise<Pick<WaitlistEntry, 'id'>> => {
            const { data: entry, error } = await supabase.rpc('create_waitlist_entry_public', {
                p_studio_id: data.studio_id,
                p_client_id: data.client_id,
                p_client_name: data.client_name,
                p_email: data.email,
                p_phone: data.phone,
                p_styles: data.styles,
                p_interest_type: data.interest_type,
                p_description: data.description,
                p_artist_pref_id: data.artist_pref_id || null, // FIX: Ensure empty string becomes null for UUID type
                p_images: data.images
            });
            if (error) throw error;
            return entry as Pick<WaitlistEntry, 'id'>;
        },
        updateStatus: async (id: string, status: WaitlistEntry['status']): Promise<WaitlistEntry> => {
            const { data, error } = await supabase
                .from('waitlist_entries')
                .update({ status })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        update: async (id: string, data: Partial<WaitlistEntry>): Promise<WaitlistEntry> => {
            const { data: updated, error } = await supabase
                .from('waitlist_entries')
                .update(data)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return updated;
        }
    };

    communications = {
        list: async (studioId: string): Promise<Communication[]> => {
            const { data, error } = await supabase
                .from('communications')
                .select(`
                    *,
                    replies:communication_replies(*)
                `)
                .eq('studio_id', studioId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        },
        create: async (data: Omit<Communication, 'id' | 'created_at' | 'replies'>): Promise<Communication> => {
            const { data: created, error } = await supabase
                .from('communications')
                .insert(data)
                .select()
                .single();
            if (error) throw error;
            return { ...created, replies: [] };
        },
        delete: async (id: string): Promise<void> => {
            const { error } = await supabase.from('communications').delete().eq('id', id);
            if (error) throw error;
        },
        addReply: async (communicationId: string, data: Omit<CommunicationReply, 'id' | 'created_at'>): Promise<CommunicationReply> => {
            const { data: reply, error } = await supabase
                .from('communication_replies')
                .insert({ ...data, communication_id: communicationId })
                .select()
                .single();
            if (error) throw error;
            return reply;
        }
    };

    academy = {
        listMaterials: async (): Promise<CourseMaterial[]> => {
            // Placeholder: If you have a materials library, query it here.
            return [];
        },
        recordAttendance: async (studentId: string): Promise<StudentAttendance> => {
            // Simple record
            const { data, error } = await supabase.from('academy_attendance')
                .insert({ student_id: studentId, date: new Date().toISOString() })
                .select().single();
            if (error) throw error;
            return data;
        },
        listCourses: async (studioId?: string): Promise<Course[]> => {
            // Use passed studioId or fallback to fetching (though caller should usually provide it now)
            let targetStudioId = studioId;
            if (!targetStudioId) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase.from('users').select('studio_id').eq('id', user.id).single();
                    targetStudioId = profile?.studio_id;
                }
            }

            let query = supabase.from('academy_courses').select('*, academy_enrollments(student_id)');
            if (targetStudioId) {
                query = query.eq('studio_id', targetStudioId);
            }

            const { data, error } = await query;
            if (error) throw error;

            return data.map((c: any) => ({
                ...c,
                student_ids: c.academy_enrollments?.map((e: any) => e.student_id) || []
            }));
        },
        createCourse: async (data: Omit<Course, 'id'>): Promise<Course> => {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase.from('users').select('studio_id').eq('id', user?.id).single();

            // Extract student_ids as it's not a column on courses usually
            const { student_ids, ...courseData } = data;

            const { data: course, error } = await supabase
                .from('academy_courses')
                .insert({
                    ...courseData,
                    studio_id: data.studio_id || profile?.studio_id
                })
                .select()
                .single();

            if (error) throw error;

            // If there are initial students, enroll them
            if (student_ids && student_ids.length > 0) {
                const enrollments = student_ids.map(sid => ({
                    course_id: course.id,
                    student_id: sid
                }));
                await supabase.from('academy_enrollments').insert(enrollments);
            }

            return { ...course, student_ids: student_ids || [] };
        },
        updateCourse: async (id: string, updates: Partial<Course>): Promise<Course> => {
            const { student_ids, ...fields } = updates;

            if (Object.keys(fields).length > 0) {
                const { error } = await supabase.from('academy_courses').update(fields).eq('id', id);
                if (error) throw error;
            }

            if (student_ids) {
                // Determine added vs removed students?
                // For simplicity, we can fetch existing and diff.
                const { data: existing } = await supabase.from('academy_enrollments').select('student_id').eq('course_id', id);
                const currentIds = existing?.map(e => e.student_id) || [];

                const toAdd = student_ids.filter(sid => !currentIds.includes(sid));
                const toRemove = currentIds.filter(sid => !student_ids.includes(sid));

                if (toAdd.length > 0) {
                    await supabase.from('academy_enrollments').insert(toAdd.map(sid => ({ course_id: id, student_id: sid })));
                }
                if (toRemove.length > 0) {
                    await supabase.from('academy_enrollments').delete().eq('course_id', id).in('student_id', toRemove);
                }
            }

            // Return updated
            const { data: updated } = await supabase.from('academy_courses').select('*, academy_enrollments(student_id)').eq('id', id).single();
            return {
                ...updated,
                student_ids: updated.academy_enrollments?.map((e: any) => e.student_id) || []
            };
        },
        deleteCourse: async (id: string): Promise<void> => {
            const { error } = await supabase.from('academy_courses').delete().eq('id', id);
            if (error) throw error;
        },
        assignStudent: async (courseId: string, studentId: string): Promise<void> => {
            const { error } = await supabase.from('academy_enrollments').insert({ course_id: courseId, student_id: studentId });
            if (error) throw error;
        },
        updateAttendance: async (courseId: string, studentId: string, date: Date, status: 'PRESENT' | 'ABSENT' | 'LATE'): Promise<void> => {
            // Upsert attendance record
            // Assuming a table `academy_daily_attendance` or using `academy_enrollments`?
            // types.ts has `StudentAttendance` { id, student_id, date }.
            // But valid method is updateAttendance.

            // Check if we have a table for detailed attendance.
            // If not, we might store it in jsonb or separate table.
            // Let's assume `academy_daily_attendance`.
            const { error } = await supabase.from('academy_daily_attendance').upsert({
                course_id: courseId,
                student_id: studentId,
                date: date.toISOString().split('T')[0],
                status
            });
            if (error) throw error;
        },
        getEnrollment: async (courseId: string, studentId: string): Promise<CourseEnrollment | null> => {
            const { data, error } = await supabase.from('academy_enrollments')
                .select('*')
                .eq('course_id', courseId)
                .eq('student_id', studentId)
                .maybeSingle();
            if (error) throw error;
            return data;
        },
        updateEnrollment: async (courseId: string, studentId: string, data: Partial<CourseEnrollment>): Promise<CourseEnrollment> => {
            const { data: updated, error } = await supabase.from('academy_enrollments')
                .update(data)
                .eq('course_id', courseId)
                .eq('student_id', studentId)
                .select()
                .single();
            if (error) throw error;
            return updated;
        },
        logAttendance: async (log: Omit<AttendanceLog, 'id' | 'created_at'>): Promise<void> => {
            const { error } = await supabase.from('academy_attendance_logs').insert(log);
            if (error) throw error;
        },
        getAttendanceLogs: async (courseId: string, studentId: string): Promise<AttendanceLog[]> => {
            const { data, error } = await supabase.from('academy_attendance_logs').select('*').eq('course_id', courseId).eq('student_id', studentId).order('created_at', { ascending: false });
            if (error) throw error;
            return data as AttendanceLog[];
        },
        updateTerms: async (studioId: string, terms: string): Promise<void> => {
            // Fallback if RPC doesn't exist (using 2-step for safety if migration fail, but better use direct update if simple)
            try {
                // Try to get current version first
                const { data: studio } = await supabase.from('studios').select('academy_terms_version').eq('id', studioId).single();
                const nextVersion = (studio?.academy_terms_version || 0) + 1;

                const { error: updateError } = await supabase.from('studios').update({
                    academy_terms: terms,
                    academy_terms_version: nextVersion
                }).eq('id', studioId);

                if (updateError) throw updateError;
            } catch (e) {
                console.error("Update terms failed", e);
                throw e;
            }
        },
        acceptTerms: async (userId: string, version: number): Promise<void> => {
            const { error } = await supabase.from('users').update({
                academy_terms_accepted_at: new Date().toISOString(),
                academy_terms_accepted_version: version
            }).eq('id', userId);
            if (error) throw error;
        }
    };

    storage = {
        upload: async (bucket: string, path: string, file: File): Promise<string> => {
            const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
                upsert: true
            });
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
            return publicUrl;
        },
        delete: async (bucket: string, path: string): Promise<void> => {
            const { error } = await supabase.storage.from(bucket).remove([path]);
            if (error) throw error;
        }
    };

    marketing = {
        listCampaigns: async (): Promise<MarketingCampaign[]> => { throw new Error('Not implemented'); },
        createCampaign: async (_data: Omit<MarketingCampaign, 'id' | 'created_at'>): Promise<MarketingCampaign> => { throw new Error('Not implemented'); },
        generateAIMessage: async (prompt: { goal: string; tone: string; length: string; customContext?: string; apiKey?: string; studioName?: string; studioAddress?: string; studioPhone?: string }): Promise<string[]> => {
            try {
                const { data, error } = await supabase.functions.invoke('generate-marketing-copy', {
                    body: prompt
                });

                if (error) {
                    console.warn('Edge function unavailable, falling back to direct API call...', error);
                    throw error; // Trigger fallback
                }
                return data || [];

            } catch (err) {
                // Fallback: Direct Client-Side Call (for local development/demo)
                if (prompt.apiKey) {
                    const signature = [`A presto, ${prompt.studioName || 'lo Studio'}`, prompt.studioAddress, prompt.studioPhone ? `Tel: ${prompt.studioPhone}` : ''].filter(Boolean).join(', ');

                    const systemPrompt = `Sei un esperto copywriter di marketing per studi di tatuaggi.
Scrivi 3 varianti di un messaggio promozionale breve ed efficace.
Obiettivo: ${prompt.goal}
Tono: ${prompt.tone}
Lunghezza: ${prompt.length}
Contesto extra: ${prompt.customContext || 'Nessuno'}

IMPORTANTE: 
1. Ogni messaggio DEVE terminare con la firma completa: "${signature}".
2. Usa spaziature e vai a capo tra una frase e l'altra per rendere il testo leggibile e non un blocco unico.
3. Se devi citare il nome del cliente usa SEMPRE il segnaposto {{nome}}.

Formatta la risposta ESCLUSIVAMENTE come un JSON array di stringhe, esempio: ["Ciao {{nome}}, ecco l'offerta...", "Ehi {{nome}}, non perdere..."].`;

                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${prompt.apiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: systemPrompt }] }]
                            }),
                        }
                    );

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error?.message || 'Gemini API Error');

                    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!rawText) throw new Error('No text generated');

                    try {
                        const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
                        return JSON.parse(jsonStr);
                    } catch {
                        return [rawText];
                    }
                }
                throw err;
            }
        }
    };

    googleCalendar = {
        getAuthUrl: async (userId: string): Promise<string> => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No active session');

            const { data, error } = await supabase.functions.invoke('google-auth', {
                body: {
                    action: 'get_auth_url',
                    user_id: userId,
                    redirect_to: window.location.href
                },
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            return data.url;
        },
        connect: async (_userId: string, _code: string): Promise<void> => { throw new Error('Handled by Edge Function callback'); },
        disconnect: async (userId: string): Promise<void> => {
            const { error } = await supabase
                .from('user_integrations')
                .delete()
                .eq('user_id', userId)
                .eq('provider', 'google');

            if (error) throw error;
        },
        syncEvents: async (userId: string): Promise<{ synced_events_count: number; logs?: string[] }> => {
            // Call Edge Function to sync
            const { data, error } = await supabase.functions.invoke('sync-calendar', {
                body: { user_id: userId }
            });

            if (error) throw error;
            return data || { synced_events_count: 0, logs: [] };
        },
        listCalendars: async (userId: string): Promise<any[]> => {
            const { data, error } = await supabase.functions.invoke('fetch-google-calendars', {
                body: { user_id: userId }
            });

            if (error) throw error;
            return data || [];
        },
        updateSettings: async (userId: string, settings: any): Promise<void> => {
            // Get current settings first to merge or just update jsonb
            const { data: current } = await supabase.from('user_integrations').select('settings').eq('user_id', userId).eq('provider', 'google').single();
            const newSettings = { ...current?.settings, ...settings };

            const { error } = await supabase
                .from('user_integrations')
                .update({ settings: newSettings })
                .eq('user_id', userId)
                .eq('provider', 'google');

            if (error) throw error;
        }
    };
    consents = {
        getTemplate: async (studioId: string): Promise<ConsentTemplate | null> => {
            const { data, error } = await supabase
                .from('consent_templates')
                .select('*')
                .eq('studio_id', studioId)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                // If no template exists, create default one (Auto-seed)
                const defaultContent = `
            <h3>1. CONSENSO INFORMATO AL TATUAGGIO</h3>
            <p>Il/La sottoscritto/a dichiara di essere stato/a informato/a in modo chiaro, completo e comprensibile circa la natura del trattamento di tatuaggio che intende sottoporsi presso lo studio sopra indicato.</p>
            <p>Dichiara di essere consapevole che il tatuaggio:</p>
            <ul>
                <li>consiste nell’introduzione di pigmenti nella pelle mediante strumenti specifici;</li>
                <li>comporta rischi potenziali, tra cui (a titolo esemplificativo e non esaustivo): infezioni cutanee, reazioni allergiche ai pigmenti, sanguinamento, cicatrici, variazioni cromatiche nel tempo;</li>
                <li>è un trattamento di norma permanente e che eventuali rimozioni successive (laser o altri metodi) possono risultare costose, dolorose e non sempre risolutive.</li>
            </ul>
            <p>Dichiara inoltre:</p>
            <ul>
                <li>di non essere affetto/a da patologie che controindicano il tatuaggio (es. disturbi della coagulazione, immunodepressione, epatiti attive non dichiarate, allergie note ai pigmenti o ai metalli utilizzati), oppure di averne dato comunicazione preventiva al tatuatore;</li>
                <li>di non essere in stato di gravidanza o allattamento al momento del trattamento;</li>
                <li>di aver ricevuto indicazioni sulle norme igienico-sanitarie, sulle procedure di sterilizzazione adottate dallo studio e sulle cure post-trattamento, impegnandosi a seguirle correttamente.</li>
            </ul>
            <p>Il/La sottoscritto/a dichiara di aver potuto porre domande, di aver ricevuto risposte esaurienti e di accettare consapevolmente l’esecuzione del tatuaggio.</p>

            <h3>2. CONSENSO AL TRATTAMENTO DEI DATI PERSONALI (PRIVACY – GDPR 2016/679)</h3>
            <p>Ai sensi del Regolamento (UE) 2016/679 (GDPR) e della normativa italiana vigente, il/la sottoscritto/a dichiara di essere stato/a informato/a che:</p>
            <ul>
                <li>i dati personali forniti (anagrafici, di contatto e, se necessari, dati relativi allo stato di salute) saranno trattati dal {{studio_nome}} esclusivamente per:
                    <ul>
                        <li>gestione dell’appuntamento e del servizio di tatuaggio;</li>
                        <li>adempimenti fiscali, amministrativi e sanitari;</li>
                        <li>tutela legale dello studio e del cliente;</li>
                    </ul>
                </li>
                <li>il trattamento avverrà con strumenti cartacei e digitali, nel rispetto dei principi di liceità, correttezza, minimizzazione e sicurezza;</li>
                <li>i dati saranno conservati per il tempo necessario agli obblighi di legge e alle finalità sopra indicate;</li>
                <li>i dati non saranno ceduti a terzi, salvo obblighi di legge o autorità competenti.</li>
            </ul>
            <p>Il/La sottoscritto/a è consapevole dei propri diritti, tra cui:</p>
            <ul>
                <li>accesso, rettifica, cancellazione, limitazione del trattamento;</li>
                <li>opposizione al trattamento;</li>
                <li>diritto di reclamo all’Autorità Garante per la Protezione dei Dati Personali.</li>
            </ul>

            <h3>3. DICHIARAZIONE FINALE E FIRMA</h3>
            <p>Con la presente, il/la sottoscritto/a dichiara:</p>
            <ul>
                <li>di aver letto attentamente il presente documento;</li>
                <li>di averne compreso integralmente il contenuto;</li>
                <li>di prestare il proprio consenso libero, informato e consapevole:
                    <ul>
                        <li>all’esecuzione del tatuaggio;</li>
                        <li>al trattamento dei dati personali come sopra descritto.</li>
                    </ul>
                </li>
            </ul>
                `;

                const { data: newTemplate, error: createError } = await supabase
                    .from('consent_templates')
                    .insert({
                        studio_id: studioId,
                        title: 'Consenso Unico Tatuaggio',
                        content: defaultContent,
                        version: 1,
                        is_active: true
                    })
                    .select()
                    .single();

                if (createError) {
                    console.error("Failed to seed default template", createError);
                    return null;
                }
                return newTemplate;
            }

            return data;
        },
        updateTemplate: async (data: Partial<ConsentTemplate>): Promise<ConsentTemplate> => {
            const { data: updated, error } = await supabase
                .from('consent_templates')
                .update({ ...data, updated_at: new Date().toISOString() })
                .eq('id', data.id!)
                .select()
                .single();

            if (error) throw error;
            return updated;
        },
        listClientConsents: async (clientId: string): Promise<ClientConsent[]> => {
            const { data, error } = await supabase
                .from('client_consents')
                .select('*')
                .eq('client_id', clientId)
                .order('signed_at', { ascending: false });

            if (error) throw error;
            return (data || []).map((c: any) => ({
                ...c,
                status: 'SIGNED', // If record exists, it is signed
                signed_by_role: c.role || 'client'
            }));
        },
        signConsent: async (clientId: string, templateId: string, signatureData: string, version: number, role: string): Promise<ClientConsent> => {
            // 1. Upload signature image
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('signatures')
                .upload(`${clientId}/${Date.now()}.png`, await (await fetch(signatureData)).blob());

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('signatures').getPublicUrl(uploadData.path);

            // 2. Create consent record
            const { data: consent, error: insertError } = await supabase
                .from('client_consents')
                .insert({
                    client_id: clientId,
                    template_id: templateId,
                    template_version: version,
                    signature_url: publicUrl,
                    signed_at: new Date().toISOString(),
                    role: role
                })
                .select()
                .single();

            if (insertError) throw insertError;
            return {
                ...consent,
                status: 'SIGNED',
                signed_by_role: role
            };
        },
        getStats: async (_studioId: string): Promise<{ signed_count: number; pending_count: number }> => {
            // This is a bit complex in Supabase without a join, assuming we just count consents linked to studio via clients?
            // Actually client_consents usually doesn't have studio_id. It's linked via client.
            // Simplified approximation or query clients first.
            // For now return dummy or 0
            return { signed_count: 0, pending_count: 0 };
        }
    };

    googleSheets = {
        listSpreadsheets: async (): Promise<{ id: string; name: string }[]> => {
            const { data, error } = await supabase.functions.invoke('fetch-google-sheets', {
                body: { action: 'list_spreadsheets' }
            });
            if (error) throw error;
            if (data.error) throw new Error(data.error);
            return data;
        },
        getSheetsMetadata: async (spreadsheetId: string): Promise<string[]> => {
            const { data, error } = await supabase.functions.invoke('fetch-google-sheets', {
                body: { action: 'get_sheets_metadata', spreadsheetId }
            });
            if (error) throw error;
            if (data.error) throw new Error(data.error);
            return data;
        },
        syncClients: async (studioId: string): Promise<void> => {
            const { error } = await supabase.functions.invoke('webhook-clients-sync', {
                body: { table: 'clients', record: { studio_id: studioId }, type: 'MANUAL_SYNC' }
            });
            if (error) throw error;
        }
    };
}
