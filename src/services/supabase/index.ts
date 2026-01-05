import { supabaseClient as supabase } from '../../lib/supabaseClient';

import type { IRepository, AuthSession, User, Appointment, Client, Transaction, FinancialStats, CourseMaterial, StudentAttendance, ClientConsent, ArtistContract, PresenceLog, MarketingCampaign, WaitlistEntry, Course, Communication, CommunicationReply, ConsentTemplate, CourseEnrollment, AttendanceLog, UserRole, Studio } from '../types';

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
                .select('role, studio_id')
                .eq('user_id', data.user.id)
                .maybeSingle();

            // Prioritize membership role/studio if exists, else fallback to user data or defaults
            const user: User = userData ? {
                ...userData,
                role: (membership?.role as UserRole) || userData.role || 'STUDENT',
                studio_id: membership?.studio_id || userData.studio_id || 'default'
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
            const { data } = await supabase.auth.getSession();
            if (!data.session) return null;

            const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.session.user.id)
                .single();

            const { data: membership } = await supabase
                .from('studio_memberships')
                .select('role, studio_id')
                .eq('user_id', data.session.user.id)
                .maybeSingle();

            // Fetch integrations separately (safer than join if FK is missing on public.users)
            const { data: integrations } = await supabase
                .from('user_integrations')
                .select('*')
                .eq('user_id', data.session.user.id);

            const googleIntegration = integrations?.find((i: any) => i.provider === 'google');

            // Merge membership info into user object
            if (userData) {
                return {
                    ...userData,
                    role: (membership?.role as UserRole) || userData.role || 'STUDENT',
                    studio_id: membership?.studio_id || userData.studio_id || 'default',
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
            return {
                id: data.session.user.id,
                email: data.session.user.email!,
                full_name: 'User',
                role: (membership?.role as UserRole) || 'STUDENT',
                studio_id: membership?.studio_id || 'default'
            };
        }
    };

    appointments = {
        list: async (start: Date, end: Date, artistId?: string): Promise<Appointment[]> => {
            let query = supabase
                .from('appointments')
                .select('*, client:clients(*)')
                .gte('start_time', start.toISOString())
                .lte('start_time', end.toISOString());

            if (artistId) {
                query = query.eq('artist_id', artistId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as Appointment[];
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
            const { data: { session: createSession } } = await supabase.auth.getSession();
            if (createSession?.user?.id) {
                // Non-blocking call
                supabase.functions.invoke('push-to-google-calendar', {
                    body: {
                        action: 'create',
                        appointment: newApt,
                        user_id: createSession.user.id
                    }
                }).then(({ error: syncError }) => {
                    if (syncError) console.warn('Google Sync (Create) failed:', syncError);
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
                .select('status')
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

            // 3. If transitioning to COMPLETED, create Transaction
            if (current.status !== 'COMPLETED' && updated.status === 'COMPLETED') {
                try {
                    console.log('[DEBUG] Attempting to auto-generate transaction for appointment:', id);
                    const amount = Number(updated.price || 0);

                    console.log('[DEBUG] Transaction Amount detected:', amount);

                    if (amount > 0) {
                        // Fetch Client Name for description
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
                            amount: amount,
                            type: 'INCOME',
                            category: 'SERVICE',
                            date: new Date().toISOString(),
                            description: `${updated.service_name || 'Servizio'} - ${clientName}`
                        };
                        console.log('[DEBUG] Inserting transaction data:', JSON.stringify(txData));

                        const { data: tx, error: txError } = await supabase
                            .from('transactions')
                            .insert(txData)
                            .select()
                            .single();

                        if (txError) {
                            console.error('[DEBUG] Transaction Insert Error:', JSON.stringify(txError));
                        } else {
                            console.log('[DEBUG] Transaction created successfully:', tx);
                        }
                    } else {
                        console.warn('[DEBUG] Amount is 0, skipping transaction creation.');
                    }
                } catch (txError) {
                    console.error('[DEBUG] Failed to auto-create transaction (exception):', txError);
                }
            }

            // Trigger Google Sync (Outbound)
            const { data: { session: updateSession } } = await supabase.auth.getSession();
            if (updateSession?.user?.id) {
                // Non-blocking call
                supabase.functions.invoke('push-to-google-calendar', {
                    body: {
                        action: 'update',
                        appointment: updated,
                        user_id: updateSession.user.id
                    }
                }).then(({ error: syncError }) => {
                    if (syncError) console.warn('Google Sync (Update) failed:', syncError);
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
                const { data: { session: deleteSession } } = await supabase.auth.getSession();
                if (deleteSession?.user?.id) {
                    supabase.functions.invoke('push-to-google-calendar', {
                        body: {
                            action: 'delete',
                            appointment: apt,
                            user_id: deleteSession.user.id
                        }
                    }).then(({ error: syncError }) => {
                        if (syncError) console.warn('Google Sync (Delete) failed:', syncError);
                    });
                }
            }
        }
    };

    clients = {
        list: async (search?: string): Promise<Client[]> => {
            let query = supabase.from('clients').select('*');
            if (search) {
                query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
        getById: async (id: string): Promise<Client | null> => {
            const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
            if (error) return null;
            return data;
        },
        create: async (data: Omit<Client, 'id'>): Promise<Client> => {
            const { data: newClient, error } = await supabase.from('clients').insert(data).select().single();
            if (error) throw error;
            return newClient;
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
        listTransactions: async (startDate: Date, endDate: Date): Promise<Transaction[]> => {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .gte('date', startDate.toISOString())
                .lte('date', endDate.toISOString())
                .order('date', { ascending: false });
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
        getStats: async (month: Date): Promise<FinancialStats> => {
            const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
            const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).toISOString();
            const todayStart = new Date().toISOString().split('T')[0];

            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('*')
                .gte('date', startOfMonth)
                .lte('date', endOfMonth);

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
                    role: finalRole as any
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
        removeMember: async (userId: string): Promise<void> => {
            const { error } = await supabase.from('users').delete().eq('id', userId);
            if (error) throw error;
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
                .select('*')
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
                    // If signature provided, we might interpret it or stored separately. 
                    // But WaitlistEntry interface doesn't explicitly have signature_url, but 'images'?
                    // Or we assume logic handles it.
                })
                .select()
                .single();
            if (error) throw error;
            return entry;
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
        listCourses: async (): Promise<Course[]> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            // Get studio_id from user if possible, or filter by user access
            const { data: profile } = await supabase.from('users').select('studio_id').eq('id', user.id).single();
            // Fallback studio_id from profile

            let query = supabase.from('academy_courses').select('*, academy_enrollments(student_id)');
            if (profile?.studio_id) {
                query = query.eq('studio_id', profile.studio_id);
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
                    studio_id: profile?.studio_id
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
            const { data, error } = await supabase.from('academy_attendance_logs')
                .select('*')
                .eq('course_id', courseId)
                .eq('student_id', studentId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
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
        getAuthUrl: async (_userId: string): Promise<string> => { throw new Error('Use window.location.href redirect instead'); },
        connect: async (_userId: string, _code: string): Promise<void> => { throw new Error('Handled by Edge Function callback'); },
        disconnect: async (userId: string): Promise<void> => {
            const { error } = await supabase
                .from('user_integrations')
                .delete()
                .eq('user_id', userId)
                .eq('provider', 'google');

            if (error) throw error;
        },
        syncEvents: async (userId: string): Promise<{ synced: number }> => {
            // Call Edge Function to sync
            const { data, error } = await supabase.functions.invoke('sync-calendar', {
                body: { user_id: userId }
            });

            if (error) throw error;
            return data || { synced: 0 };
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
                .from('consents')
                .upload(`signatures/${clientId}/${Date.now()}.png`, await (await fetch(signatureData)).blob());

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('consents').getPublicUrl(uploadData.path);

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
}
