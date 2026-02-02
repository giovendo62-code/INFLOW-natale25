import type { IRepository, AuthSession, User, Appointment, Client, Transaction, FinancialStats, CourseMaterial, StudentAttendance, ClientConsent, ArtistContract, PresenceLog, MarketingCampaign, WaitlistEntry, Course, Communication, CommunicationReply, ConsentTemplate, Studio, CourseEnrollment, AttendanceLog, RecurringExpense, AttendanceRecord } from '../types';

const MOCK_STUDIOS: Studio[] = [
    {
        id: 'studio-1',
        name: 'InkFlow Milano',
        address: 'Via Tortona, 15',
        city: 'Milano (MI)',
        phone: '+39 02 12345678',
        website: 'https://inkflow.it',
        logo_url: 'https://ui-avatars.com/api/?name=InkFlow&background=0D8ABC&color=fff&size=128'
    }
];

const MOCK_MATERIALS: CourseMaterial[] = [
    { id: '1', title: 'Hygiene & Safety Basics', type: 'PDF', url: '#' },
    { id: '2', title: 'Needle Depth Technique', type: 'VIDEO', url: '#' },
    { id: '3', title: 'Color Theory', type: 'PDF', url: '#' },
];

const MOCK_ENROLLMENTS: CourseEnrollment[] = [];
const MOCK_ATTENDANCE_LOGS: AttendanceLog[] = [];

const MOCK_COURSES: Course[] = [
    {
        id: 'c1',
        title: 'Corso Base Tatuaggio',
        description: 'Dal disegno alla pelle, i fondamenti del mestiere.',
        duration: '3 Mesi',
        materials: [MOCK_MATERIALS[0], MOCK_MATERIALS[1]],
        student_ids: ['user-student']
    },
    {
        id: 'c2',
        title: 'Masterclass Realistico',
        description: 'Tecniche avanzate per ritratti e chiaroscuro.',
        duration: '2 Giorni',
        materials: [MOCK_MATERIALS[2]],
        student_ids: []
    }
];

const MOCK_COMMUNICATIONS: Communication[] = [
    {
        id: 'comm-1',
        studio_id: 'studio-1',
        author_id: 'user-admin',
        author_name: 'Studio Owner',
        content: 'Benvenuti nel nuovo CRM! 🚀\nUtilizzate la sezione Academy per i corsi.',
        is_important: true,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        replies: [
            {
                id: 'rep-1',
                author_id: 'user-artist',
                author_name: 'Tattoo Artist',
                content: 'Grandissimo! Ho già dato un\'occhiata.',
                created_at: new Date(Date.now() - 80000000).toISOString()
            }
        ]
    }
];

const MOCK_TRANSACTIONS: Transaction[] = [
    { id: 'tx-1', studio_id: 'studio-1', amount: 150, type: 'INCOME', category: 'Tattoo Service', date: new Date().toISOString() },
    { id: 'tx-2', studio_id: 'studio-1', amount: 50, type: 'EXPENSE', category: 'Supplies', date: new Date().toISOString() },
    { id: 'tx-3', studio_id: 'studio-1', amount: 300, type: 'INCOME', category: 'Tattoo Service', date: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString() },
];

let MOCK_CLIENTS: Client[] = [];

const savedClients = localStorage.getItem('inkflow_mock_clients');
if (savedClients) {
    MOCK_CLIENTS = JSON.parse(savedClients);
} else {
    MOCK_CLIENTS = [
        {
            id: 'client-1',
            full_name: 'Mario Rossi',
            email: 'user-artist@inkflow.com',
            phone: '123123123',
            studio_id: 'studio-1',
            images: [
                { id: 'i1', url: 'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&q=80', uploaded_at: '2023-01-15' },
                { id: 'img-2', url: 'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?auto=format&fit=crop&q=80&w=400', uploaded_at: '2023-02-20' }
            ],
            whatsapp_broadcast_opt_in: true,
            preferred_styles: ['Realistico', 'Blackwork'],
            fiscal_code: 'RSSMRA80A01H501U',
            address: 'Via Roma 10',
            city: 'Milano',
            zip_code: '20100'
        },
        {
            id: 'client-2',
            full_name: 'Luigi Verdi',
            email: 'luigi@test.com',
            phone: '3339876543',
            studio_id: 'studio-1',
            images: [],
            whatsapp_broadcast_opt_in: false,
            preferred_styles: ['Old School'],
            fiscal_code: 'VRDLGU85B02H501Z',
            address: 'Corso Italia 45',
            city: 'Roma',
            zip_code: '00100'
        },
        {
            id: 'client-3',
            full_name: 'Giulia Bianchi',
            email: 'giulia@test.com',
            phone: '3335556666',
            studio_id: 'studio-1',
            images: [],
            whatsapp_broadcast_opt_in: true,
            preferred_styles: ['Fine Line', 'Watercolor'],
            fiscal_code: 'BNCGLI90C03H501X',
            address: 'Via Garibaldi 3',
            city: 'Napoli',
            zip_code: '80100'
        },
    ];
    // Save defaults
    localStorage.setItem('inkflow_mock_clients', JSON.stringify(MOCK_CLIENTS));
}

const MOCK_USERS: User[] = [
    {
        id: 'user-admin',
        email: 'admin@inkflow.com',
        full_name: 'Studio Owner',
        role: 'STUDIO_ADMIN',
        studio_id: 'studio-1',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin'
    },
    {
        id: 'user-manager',
        email: 'user-manager@inkflow.com',
        phone: '321321321',
        full_name: 'Shop Manager',
        role: 'MANAGER',
        studio_id: 'studio-1',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=manager'
    },
    {
        id: 'user-artist',
        email: 'artist@inkflow.com',
        full_name: 'Tattoo Artist',
        role: 'ARTIST',
        studio_id: 'studio-1',
        phone: '3331234567',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=artist'
    },
    {
        id: 'user-student',
        email: 'student@inkflow.com',
        full_name: 'Academy Student',
        role: 'STUDENT',
        studio_id: 'studio-1',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=student'
    }
];

const MOCK_APPOINTMENTS: Appointment[] = [
    {
        id: 'apt-1',
        studio_id: 'studio-1',
        artist_id: 'user-artist',
        client_id: 'client-1',
        start_time: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(), // Today 10:00
        end_time: new Date(new Date().setHours(13, 0, 0, 0)).toISOString(),   // Today 13:00
        service_name: 'Custom Designing',
        status: 'CONFIRMED',
        client: { id: 'client-1', full_name: 'Mario Rossi', email: 'mario@test.com', phone: '3331234567', studio_id: 'studio-1' },
        images: ['https://images.unsplash.com/photo-1598371839696-5c5bb7161438?auto=format&fit=crop&q=80&w=400']
    },
    {
        id: 'apt-2',
        studio_id: 'studio-1',
        artist_id: 'user-artist',
        client_id: 'client-2',
        start_time: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(), // Tomorrow
        end_time: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(),
        service_name: 'Touch up',
        status: 'PENDING',
        client: { id: 'client-2', full_name: 'Luigi Verdi', email: 'luigi@test.com', phone: '3339876543', studio_id: 'studio-1' },
        price: 80,
        deposit: 20
    },
    {
        id: 'apt-3',
        studio_id: 'studio-1',
        artist_id: 'user-artist',
        client_id: 'client-3',
        start_time: new Date(new Date().setDate(new Date().getDate() + 8)).toISOString(), // Next week
        end_time: new Date(new Date().setDate(new Date().getDate() + 8)).toISOString(),
        service_name: 'Full Sleeve Session',
        status: 'CONFIRMED',
        client: { id: 'client-3', full_name: 'Giulia Bianchi', email: 'giulia@test.com', phone: '3335556666', studio_id: 'studio-1' },
        price: 500,
        deposit: 100
    }
];

const MOCK_CONTRACTS: ArtistContract[] = [
    {
        id: 'contr-1',
        studio_id: 'studio-1',
        artist_id: 'user-artist',
        commission_rate: 0.5,
        rent_type: 'PERCENTAGE',
        used_presences: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

const MOCK_PRESENCE_LOGS: PresenceLog[] = [];

const MOCK_WAITLIST: WaitlistEntry[] = [
    {
        id: 'wl-1',
        studio_id: 'studio-1',
        client_id: 'client-1',
        client_name: 'Mario Rossi',
        description: 'Tattoo realistico braccio',
        styles: ['Realistico'],
        preferred_artist_id: 'user-artist',
        status: 'PENDING',
        created_at: new Date().toISOString(),
        email: 'mario@test.com'
    }
];

// Marketing Mock Data
const MOCK_CAMPAIGNS: MarketingCampaign[] = [
    {
        id: 'camp-1',
        studio_id: 'studio-1',
        title: 'Promo Natale',
        channel: 'WHATSAPP',
        message_text: 'Ciao {{nome}}, auguri di Buon Natale da {{studio_nome}}! Per te uno sconto speciale...',
        ai_used: true,
        filters: { broadcast_status: 'IN_BROADCAST' },
        recipients_count: 50,
        status: 'SENT',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        sent_at: new Date(Date.now() - 86000000).toISOString()
    }
];

export class MockRepository implements IRepository {
    storage = {
        upload: async (_bucket: string, _path: string, _file: File): Promise<string> => {
            await new Promise(resolve => setTimeout(resolve, 800));
            // Return a dummy image
            return `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`;
        },
        delete: async (_bucket: string, _path: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 400));
        }
    };
    // ... (previous implementations)

    marketing = {
        listCampaigns: async (): Promise<MarketingCampaign[]> => {
            await new Promise(resolve => setTimeout(resolve, 400));
            return [...MOCK_CAMPAIGNS].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        },
        createCampaign: async (data: Omit<MarketingCampaign, 'id' | 'created_at'>): Promise<MarketingCampaign> => {
            await new Promise(resolve => setTimeout(resolve, 500));
            const newCampaign: MarketingCampaign = {
                ...data,
                id: `camp-${Date.now()}`,
                created_at: new Date().toISOString()
            };
            MOCK_CAMPAIGNS.push(newCampaign);
            return newCampaign;
        },
        generateAIMessage: async (prompt: { goal: string; tone: string; length: string; customContext?: string }): Promise<string[]> => {
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate AI processing

            const contextText = prompt.customContext ? ` (Basato su: "${prompt.customContext}")` : '';

            const templates = [
                `Ciao {{nome}}, qui ${prompt.tone === 'Amichevole' ? 'i tuoi amici di' : 'lo staff di'} {{studio_nome}}. ${prompt.goal === 'Promo' ? 'Abbiamo una sorpresa per te!' : 'Volevamo sentirti.'}${contextText}.`,
                `Ehi {{nome}}! 🌟 È tempo di un nuovo tattoo? ${prompt.goal === 'Promo' ? 'Approfitta della promo!' : 'Passa a trovarci.'} ${prompt.customContext || ''}`,
                `Gentile {{nome}}, ${prompt.tone === 'Professionale' ? 'la informiamo che' : 'ti scriviamo perché'} ${prompt.goal}. ${prompt.customContext || ''} Saluti, {{studio_nome}}.`
            ];

            return templates;
        }
    };

    // ... (auth, appointments, etc. - ensure existing implementations are preserved)
    auth = {
        signIn: async (email: string, _password?: string): Promise<AuthSession> => {
            // Simula latenza network
            await new Promise(resolve => setTimeout(resolve, 800));

            const user = MOCK_USERS.find(u => u.email === email);

            if (user) {
                const session = {
                    user,
                    token: 'mock-jwt-token-123'
                };
                localStorage.setItem('inkflow_mock_session', JSON.stringify(session));
                return session;
            }

            throw new Error('Invalid credentials');
        },

        signOut: async (): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 400));
            localStorage.removeItem('inkflow_mock_session');
        },

        resetPasswordForEmail: async (email: string, redirectTo: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log(`[MOCK] Reset password email sent to ${email} with redirect ${redirectTo}`);
        },

        updatePassword: async (password: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log(`[MOCK] Password updated to ${password}`);
        },

        getCurrentUser: async (): Promise<User | null> => {
            const sessionStr = localStorage.getItem('inkflow_mock_session');
            if (!sessionStr) return null;
            try {
                const session = JSON.parse(sessionStr) as AuthSession;
                // Just return the user from session
                return session.user;
            } catch {
                return null;
            }
        },

        signUp: async (email: string, _password: string, _redirectUrl?: string): Promise<AuthSession | null> => {
            await new Promise(resolve => setTimeout(resolve, 800));
            // In mock, auto-login after signup
            const newUser: User = {
                id: `u-${Date.now()}`,
                email,
                full_name: email.split('@')[0],
                role: 'STUDENT', // Default
                studio_id: 'default',
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
            };
            MOCK_USERS.push(newUser);

            const session = {
                user: newUser,
                token: 'mock-jwt-token-new'
            };
            localStorage.setItem('inkflow_mock_session', JSON.stringify(session));
            return session;
        }
    };

    appointments = {
        list: async (start: Date, end: Date, artistId?: string, studioId?: string): Promise<Appointment[]> => {
            await new Promise(resolve => setTimeout(resolve, 500));

            let apts = MOCK_APPOINTMENTS.filter(a => {
                const apptStart = new Date(a.start_time);
                let matches = apptStart >= start && apptStart <= end;

                if (artistId) {
                    matches = matches && a.artist_id === artistId;
                }

                if (studioId) {
                    matches = matches && a.studio_id === studioId;
                }

                return matches;
            });

            return apts;
        },
        get: async (id: string): Promise<Appointment | null> => {
            await new Promise(resolve => setTimeout(resolve, 200));
            return MOCK_APPOINTMENTS.find(a => a.id === id) || null;
        },
        create: async (data: Omit<Appointment, 'id'>): Promise<Appointment> => {
            const newApt: Appointment = { ...data, id: `apt-${Date.now()}` };
            MOCK_APPOINTMENTS.push(newApt);
            return newApt;
        },
        update: async (id: string, data: Partial<Appointment>): Promise<Appointment> => {
            const idx = MOCK_APPOINTMENTS.findIndex(a => a.id === id);
            if (idx === -1) throw new Error('Not found');
            MOCK_APPOINTMENTS[idx] = { ...MOCK_APPOINTMENTS[idx], ...data };
            return MOCK_APPOINTMENTS[idx];
        },
        delete: async (id: string): Promise<void> => {
            const idx = MOCK_APPOINTMENTS.findIndex(a => a.id === id);
            if (idx === -1) throw new Error('Not found');
            MOCK_APPOINTMENTS.splice(idx, 1);
        },
        listByClient: async (clientId: string): Promise<Appointment[]> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            return MOCK_APPOINTMENTS
                .filter(a => a.client_id === clientId)
                .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
        }
    };

    clients = {
        list: async (search?: string): Promise<Client[]> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            if (!search) return MOCK_CLIENTS;
            const lowerSearch = search.toLowerCase();
            return MOCK_CLIENTS.filter(c =>
                c.full_name.toLowerCase().includes(lowerSearch) ||
                c.email.toLowerCase().includes(lowerSearch) ||
                c.phone.includes(search)
            );
        },
        getById: async (id: string): Promise<Client | null> => {
            await new Promise(resolve => setTimeout(resolve, 200));
            return MOCK_CLIENTS.find(c => c.id === id) || null;
        },
        getByContact: async (email: string, phone: string, studioId: string): Promise<string | null> => {
            await new Promise(resolve => setTimeout(resolve, 200));
            const found = MOCK_CLIENTS.find(c =>
                (c.email.toLowerCase() === email.toLowerCase() || c.phone === phone) &&
                c.studio_id === studioId
            );
            return found ? found.id : null;
        },
        create: async (data: Omit<Client, 'id'>): Promise<Client> => {
            const newClient = { ...data, id: `client-${Date.now()}` };
            MOCK_CLIENTS.push(newClient);
            localStorage.setItem('inkflow_mock_clients', JSON.stringify(MOCK_CLIENTS));
            return newClient;
        },
        createPublic: async (data: Omit<Client, 'id'>): Promise<Pick<Client, 'id' | 'full_name' | 'email'>> => {
            const newClient = { ...data, id: `client-${Date.now()}` };
            MOCK_CLIENTS.push(newClient);
            localStorage.setItem('inkflow_mock_clients', JSON.stringify(MOCK_CLIENTS));
            return { id: newClient.id, full_name: newClient.full_name, email: newClient.email };
        },
        update: async (id: string, data: Partial<Client>): Promise<Client> => {
            const idx = MOCK_CLIENTS.findIndex(c => c.id === id);
            if (idx === -1) throw new Error('Not found');
            MOCK_CLIENTS[idx] = { ...MOCK_CLIENTS[idx], ...data };
            localStorage.setItem('inkflow_mock_clients', JSON.stringify(MOCK_CLIENTS));
            return MOCK_CLIENTS[idx];
        },
        delete: async (id: string): Promise<void> => {
            const idx = MOCK_CLIENTS.findIndex(c => c.id === id);
            if (idx !== -1) {
                MOCK_CLIENTS.splice(idx, 1);
                localStorage.setItem('inkflow_mock_clients', JSON.stringify(MOCK_CLIENTS));
            }
        }
    };

    financials = {
        listTransactions: async (startDate: Date, endDate: Date, studioId?: string): Promise<Transaction[]> => {
            await new Promise(resolve => setTimeout(resolve, 400));
            return MOCK_TRANSACTIONS.filter(t => {
                const d = new Date(t.date).getTime();
                const dateMatch = d >= startDate.getTime() && d <= endDate.getTime();
                if (studioId) return dateMatch && t.studio_id === studioId;
                return dateMatch;
            });
        },
        createTransaction: async (data: Omit<Transaction, 'id'>): Promise<Transaction> => {
            await new Promise(resolve => setTimeout(resolve, 400));
            const newTx = { ...data, id: `tx-${Date.now()}` };
            MOCK_TRANSACTIONS.push(newTx);
            return newTx;
        },
        updateTransaction: async (id: string, data: Partial<Transaction>): Promise<Transaction> => {
            const idx = MOCK_TRANSACTIONS.findIndex(t => t.id === id);
            if (idx === -1) throw new Error('Transaction not found');
            MOCK_TRANSACTIONS[idx] = { ...MOCK_TRANSACTIONS[idx], ...data };
            return MOCK_TRANSACTIONS[idx];
        },
        deleteTransaction: async (id: string): Promise<void> => {
            const idx = MOCK_TRANSACTIONS.findIndex(t => t.id === id);
            if (idx !== -1) MOCK_TRANSACTIONS.splice(idx, 1);
        },
        getStats: async (_month: Date, _studioId?: string): Promise<FinancialStats> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            return {
                revenue_today: 150,
                revenue_month: 4200,
                expenses_month: 1200
            };
        },
        listRecurringExpenses: async (_studioId: string): Promise<RecurringExpense[]> => {
            return [];
        },
        createRecurringExpense: async (data: Omit<RecurringExpense, 'id'>): Promise<RecurringExpense> => {
            return { ...data, id: 'mock-rec-1' };
        },
        deleteRecurringExpense: async (_id: string): Promise<void> => {
            return;
        },
        generateRecurringTransactions: async (_studioId: string, _month: Date): Promise<void> => {
            return;
        }
    };

    academy = {
        listMaterials: async (): Promise<CourseMaterial[]> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            return MOCK_MATERIALS;
        },
        recordAttendance: async (studentId: string): Promise<StudentAttendance> => {
            await new Promise(resolve => setTimeout(resolve, 500));
            return {
                id: `att-${Date.now()}`,
                student_id: studentId,
                date: new Date().toISOString()
            };
        },
        listCourses: async (_studioId?: string): Promise<Course[]> => {
            await new Promise(resolve => setTimeout(resolve, 400));
            return MOCK_COURSES;
        },
        createCourse: async (data: Omit<Course, 'id'>): Promise<Course> => {
            await new Promise(resolve => setTimeout(resolve, 600));
            const newCourse: Course = {
                ...data,
                id: `course-${Date.now()}`
            };
            MOCK_COURSES.push(newCourse);
            return newCourse;
        },
        updateCourse: async (id: string, data: Partial<Course>): Promise<Course> => {
            await new Promise(resolve => setTimeout(resolve, 400));
            const idx = MOCK_COURSES.findIndex(c => c.id === id);
            if (idx === -1) throw new Error('Course not found');
            MOCK_COURSES[idx] = { ...MOCK_COURSES[idx], ...data };
            return MOCK_COURSES[idx];
        },
        deleteCourse: async (id: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            const idx = MOCK_COURSES.findIndex(c => c.id === id);
            if (idx === -1) throw new Error('Course not found');
            MOCK_COURSES.splice(idx, 1);
        },
        assignStudent: async (courseId: string, studentId: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 400));
            const course = MOCK_COURSES.find(c => c.id === courseId);
            if (!course) throw new Error('Course not found');
            if (!course.student_ids.includes(studentId)) {
                course.student_ids.push(studentId);
            }
        },
        updateAttendance: async (courseId: any, studentId: any, date: any, status: any) => {
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log(`[MOCK] Attendance for ${studentId} in course ${courseId} on ${date.toISOString()}: ${status}`);
        },
        getEnrollment: async (courseId: any, studentId: any) => {
            await new Promise(resolve => setTimeout(resolve, 300));
            let enrollment = MOCK_ENROLLMENTS.find(e => e.course_id === courseId && e.student_id === studentId);
            if (!enrollment) {
                // Auto-create default enrollment if not exists for enrolled student
                const course = MOCK_COURSES.find(c => c.id === courseId);
                if (course && course.student_ids.includes(studentId)) {
                    enrollment = {
                        course_id: courseId,
                        student_id: studentId,
                        allowed_days: 20, // Default mock limit
                        attended_days: 0
                    };
                    MOCK_ENROLLMENTS.push(enrollment);
                }
            }
            return enrollment || null;
        },
        updateEnrollment: async (courseId: any, studentId: any, data: any) => {
            await new Promise(resolve => setTimeout(resolve, 400));
            const idx = MOCK_ENROLLMENTS.findIndex(e => e.course_id === courseId && e.student_id === studentId);
            if (idx === -1) {
                // Create if not exists
                const newEnrollment: CourseEnrollment = {
                    course_id: courseId,
                    student_id: studentId,
                    allowed_days: data.allowed_days ?? 20,
                    attended_days: data.attended_days ?? 0,
                    ...data
                };
                MOCK_ENROLLMENTS.push(newEnrollment);
                return newEnrollment;
            } else {
                MOCK_ENROLLMENTS[idx] = { ...MOCK_ENROLLMENTS[idx], ...data };
                return MOCK_ENROLLMENTS[idx];
            }
        },
        logAttendance: async (logData: any) => {
            await new Promise(resolve => setTimeout(resolve, 200));
            MOCK_ATTENDANCE_LOGS.unshift({
                ...logData,
                id: `log-${Date.now()}`,
                created_at: new Date().toISOString()
            });
        },
        getAttendanceLogs: async (courseId: any, studentId: any) => {
            await new Promise(resolve => setTimeout(resolve, 300));
            return MOCK_ATTENDANCE_LOGS.filter(l => l.course_id === courseId && l.student_id === studentId);
        },
        updateTerms: async (_studioId: string, _terms: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 300));
        },
        acceptTerms: async (_userId: string, _version: number): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 300));
        },
        getAttendanceHistory: async (_userId: string): Promise<AttendanceRecord[]> => {
            // Mock empty attendance history
            return [];
        },
        // NEW: Specific for students
        getStudentAttendanceHistory: async (studentId: string): Promise<AttendanceRecord[]> => {
            await new Promise(resolve => setTimeout(resolve, 400));
            // Return dummy data
            return MOCK_ATTENDANCE_LOGS
                .filter(l => l.student_id === studentId && l.action === 'CHECKIN_QR')
                .map(l => ({
                    id: l.id,
                    student_id: l.student_id,
                    course_id: l.course_id,
                    check_in_time: l.created_at,
                    method: 'MANUAL',
                    confidence: 'HIGH'
                }));
        },
        deleteStudentAttendance: async (_id: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            // No-op mock
        },
        performCheckIn: async (_courseId: string, _studentId: string): Promise<{ success: boolean; message: string }> => {
            await new Promise(resolve => setTimeout(resolve, 500));
            // Simulate Check-in success
            return { success: true, message: 'Check-in (MOCK) effettuato con successo!' };
        }
    };

    attendance = {
        checkIn: async (userId: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log(`[MOCK] User ${userId} checked in`);
        },
        delete: async (attendanceId: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            console.log(`[MOCK] Deleted attendance ${attendanceId}`);
        }
    };

    communications = {
        list: async (studioId: string): Promise<Communication[]> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            return MOCK_COMMUNICATIONS
                .filter(c => c.studio_id === studioId)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        },
        create: async (data: Omit<Communication, 'id' | 'created_at' | 'replies'>): Promise<Communication> => {
            await new Promise(resolve => setTimeout(resolve, 500));
            const newComm: Communication = {
                ...data,
                id: `comm-${Date.now()}`,
                created_at: new Date().toISOString(),
                replies: []
            };
            MOCK_COMMUNICATIONS.unshift(newComm);
            return newComm;
        },
        delete: async (id: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            const idx = MOCK_COMMUNICATIONS.findIndex(c => c.id === id);
            if (idx === -1) throw new Error('Not found');
            MOCK_COMMUNICATIONS.splice(idx, 1);
        },
        addReply: async (communicationId: string, data: Omit<CommunicationReply, 'id' | 'created_at'>): Promise<CommunicationReply> => {
            await new Promise(resolve => setTimeout(resolve, 400));
            const comm = MOCK_COMMUNICATIONS.find(c => c.id === communicationId);
            if (!comm) throw new Error('Communication not found');

            const newReply: CommunicationReply = {
                ...data,
                id: `rep-${Date.now()}`,
                created_at: new Date().toISOString()
            };
            comm.replies.push(newReply);
            return newReply;
        }
    };

    settings = {
        updateProfile: async (userId: string, data: Partial<User>): Promise<User> => {
            await new Promise(resolve => setTimeout(resolve, 500));
            const idx = MOCK_USERS.findIndex(u => u.id === userId);
            if (idx === -1) throw new Error('User not found');

            MOCK_USERS[idx] = { ...MOCK_USERS[idx], ...data };

            // Sync with local storage session if matches
            const sessionStr = localStorage.getItem('inkflow_mock_session');
            if (sessionStr) {
                const session = JSON.parse(sessionStr);
                if (session.user?.id === userId) {
                    session.user = MOCK_USERS[idx];
                    localStorage.setItem('inkflow_mock_session', JSON.stringify(session));
                }
            }

            return MOCK_USERS[idx];
        },
        listTeamMembers: async (studioId: string): Promise<User[]> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            return MOCK_USERS.filter(u => u.studio_id === studioId);
        },
        inviteMember: async (email: string, role: any, studioId: string): Promise<User> => {
            await new Promise(resolve => setTimeout(resolve, 600));
            const newUser: User = {
                id: `u-${Date.now()}`,
                email,
                full_name: email.split('@')[0],
                role,
                studio_id: studioId,
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
            };
            MOCK_USERS.push(newUser);
            return newUser;
        },
        getMyPendingInvitations: async () => {
            await new Promise(resolve => setTimeout(resolve, 300));
            return []; // Default empty for mock
        },
        recoverOrphanedOwner: async () => {
            await new Promise(resolve => setTimeout(resolve, 300));
            return null;
        },
        removeMember: async (userId: string, _studioId: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 400));
            const idx = MOCK_USERS.findIndex(u => u.id === userId);
            if (idx !== -1) MOCK_USERS.splice(idx, 1);
        },
        getStudio: async (studioId: string): Promise<Studio | null> => {
            await new Promise(resolve => setTimeout(resolve, 200));
            return MOCK_STUDIOS.find(s => s.id === studioId) || null;
        },
        updateStudio: async (studioId: string, data: Partial<Studio>): Promise<Studio> => {
            await new Promise(resolve => setTimeout(resolve, 400));
            const idx = MOCK_STUDIOS.findIndex(s => s.id === studioId);
            if (idx === -1) throw new Error('Studio not found');
            MOCK_STUDIOS[idx] = { ...MOCK_STUDIOS[idx], ...data };
            return MOCK_STUDIOS[idx];
        },
        registerStudio: async (name: string, userId: string): Promise<Studio> => {
            await new Promise(resolve => setTimeout(resolve, 800));
            const newStudio: Studio = {
                id: `studio-${Date.now()}`,
                name,
                address: '',
                city: '',
                phone: '',
                logo_url: ''
            };
            MOCK_STUDIOS.push(newStudio);

            // Update user to be owner of this studio
            const userIdx = MOCK_USERS.findIndex(u => u.id === userId);
            if (userIdx !== -1) {
                MOCK_USERS[userIdx].studio_id = newStudio.id;
                MOCK_USERS[userIdx].role = 'owner';
                // Update session if exists
                const sessionStr = localStorage.getItem('inkflow_mock_session');
                if (sessionStr) {
                    const session = JSON.parse(sessionStr);
                    if (session.user?.id === userId) {
                        session.user = MOCK_USERS[userIdx];
                        localStorage.setItem('inkflow_mock_session', JSON.stringify(session));
                    }
                }
            }
            return newStudio;
        },
        checkMembership: async (userId: string): Promise<boolean> => {
            await new Promise(resolve => setTimeout(resolve, 200));
            const user = MOCK_USERS.find(u => u.id === userId);
            return !!(user && user.studio_id && user.studio_id !== 'default');
        },
        createInvitation: async (studioId: string, email: string, role: string, token: string, invitedBy: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            console.log('[MOCK] Created invitation:', { studioId, email, role, token, invitedBy });
            // Store in localStorage for persistence in mock
            const invites = JSON.parse(localStorage.getItem('inkflow_mock_invites') || '[]');
            invites.push({ studioId, email, role, token, invitedBy, usedAt: null });
            localStorage.setItem('inkflow_mock_invites', JSON.stringify(invites));
        },
        getInvitation: async (token: string): Promise<any> => {
            await new Promise(resolve => setTimeout(resolve, 200));
            const invites = JSON.parse(localStorage.getItem('inkflow_mock_invites') || '[]');
            const invite = invites.find((i: any) => i.token === token && !i.usedAt);
            if (!invite) throw new Error('Invalid token');
            return {
                studio_id: invite.studioId,
                email: invite.email,
                role: invite.role, // This should be consistently cased
                token: invite.token
            };
        },
        acceptInvitation: async (token: string, userId: string, studioId: string, role: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 500));
            const invites = JSON.parse(localStorage.getItem('inkflow_mock_invites') || '[]');
            const idx = invites.findIndex((i: any) => i.token === token);
            if (idx !== -1) {
                invites[idx].usedAt = new Date().toISOString();
                localStorage.setItem('inkflow_mock_invites', JSON.stringify(invites));
            }

            // Update user role and studio
            const userIdx = MOCK_USERS.findIndex(u => u.id === userId);
            if (userIdx !== -1) {
                MOCK_USERS[userIdx].studio_id = studioId;
                MOCK_USERS[userIdx].role = role as any; // Role passed from invitation

                // Update session
                const sessionStr = localStorage.getItem('inkflow_mock_session');
                if (sessionStr) {
                    const session = JSON.parse(sessionStr);
                    if (session.user?.id === userId) {
                        session.user = MOCK_USERS[userIdx];
                        localStorage.setItem('inkflow_mock_session', JSON.stringify(session));
                    }
                }
            }
        },
        setPrivacyPin: async (userId: string, pin: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            console.log(`[MOCK] Privacy PIN set for ${userId}: ${pin}`);
        },
        updateMemberPermissions: async (_studioId: string, _userId: string, _permissions: { can_view_clients: boolean; can_view_others_financials: boolean }): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            // No-op for mock
            console.log('[MOCK] updateMemberPermissions', { _studioId, _userId, _permissions });
        },
        listStudioInvitations: async (studioId: string): Promise<any[]> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            const invites = JSON.parse(localStorage.getItem('inkflow_mock_invites') || '[]');
            return invites.filter((i: any) => i.studioId === studioId && !i.usedAt).map((i: any) => ({
                id: `inv-${i.token.substring(0, 8)}`,
                studio_id: i.studioId,
                email: i.email,
                role: i.role,
                token: i.token,
                invited_by: i.invitedBy,
                created_at: new Date().toISOString()
            }));
        }
    };

    consents = {
        getTemplate: async (studioId: string): Promise<ConsentTemplate | null> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            // Mock default template if none exists
            return {
                id: 'template-default',
                studio_id: studioId,
                version: 1,
                title: 'Consenso Unico Tatuaggio',
                content: `
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
        `,
                is_active: true,
                required_resign: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        },
        updateTemplate: async (data: Partial<ConsentTemplate>): Promise<ConsentTemplate> => {
            await new Promise(resolve => setTimeout(resolve, 600));
            return {
                id: data.id || 'template-default',
                studio_id: 'studio-1',
                version: (data.version || 1) + 1,
                title: data.title || 'Consenso Unico',
                content: data.content || '',
                is_active: true,
                required_resign: data.required_resign || false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            } as ConsentTemplate;
        },
        listClientConsents: async (clientId: string): Promise<ClientConsent[]> => {
            await new Promise(resolve => setTimeout(resolve, 400));

            // DEMO: Return a mock signed consent for Mario Rossi (client-1)
            if (clientId === 'client-1') {
                return [{
                    id: 'consent-demo-1',
                    client_id: 'client-1',
                    template_id: 'template-default',
                    template_version: 1,
                    signed_at: new Date().toISOString(),
                    status: 'SIGNED',
                    signed_by_role: 'CLIENT',
                    // Simple base64 signature (black dot/line)
                    signature_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAAAyCAYAAACbgQS6AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABiSURBVHgB7c6xCQAgDAVB95/6s4Uj2IhYCNt4cPDqmXne9xhfCpYCA0uBgaXAwFJgYCkwsBQYWAoMLAUGlgIDS4GBpcDAUmBgKTCwFBhYCgwsBQaWAgNLgYGjwMBSeF/w3B130xZBMpI92wAAAABJRU5ErkJggg=='
                }];
            }

            return [];
        },
        signConsent: async (clientId: string, templateId: string, signatureData: string, version: number, role: string): Promise<ClientConsent> => {
            await new Promise(resolve => setTimeout(resolve, 800));
            return {
                id: `sc-${Date.now()}`,
                client_id: clientId,
                template_id: templateId,
                template_version: version,
                signed_at: new Date().toISOString(),
                status: 'SIGNED',
                signature_url: signatureData, // In mock we just echo content
                pdf_url: `mock_consent_${clientId}.pdf`,
                signed_by_role: role
            };
        },
        getStats: async (_studioId: string): Promise<any> => {
            return { total: 100, signed: 80, pending: 20 };
        }
    };

    artists = {
        list: async (studioId: string): Promise<User[]> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            return MOCK_USERS.filter(u => u.role.toUpperCase() === 'ARTIST' && u.studio_id === studioId);
        },
        getContract: async (artistId: string): Promise<ArtistContract | null> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            return MOCK_CONTRACTS.find(c => c.artist_id === artistId) || null;
        },
        updateContract: async (artistId: string, data: Partial<ArtistContract>): Promise<ArtistContract> => {
            await new Promise(resolve => setTimeout(resolve, 500));
            let contractIndex = MOCK_CONTRACTS.findIndex(c => c.artist_id === artistId);

            if (contractIndex >= 0) {
                MOCK_CONTRACTS[contractIndex] = { ...MOCK_CONTRACTS[contractIndex], ...data, updated_at: new Date().toISOString() };
                return MOCK_CONTRACTS[contractIndex];
            } else {
                const newContract: ArtistContract = {
                    id: `contr-${Date.now()}`,
                    studio_id: 'studio-1', // Default for mock
                    artist_id: artistId,
                    commission_rate: 0,
                    rent_type: 'FIXED',
                    used_presences: 0,
                    updated_at: new Date().toISOString(),
                    ...data
                } as ArtistContract;
                MOCK_CONTRACTS.push(newContract);
                return newContract;
            }
        },
        addPresence: async (artistId: string, studioId: string, userId: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 400));
            const contract = MOCK_CONTRACTS.find(c => c.artist_id === artistId);
            if (!contract) throw new Error('Contract not found');

            if (contract.rent_type !== 'PRESENCES') throw new Error('Not a presence contract');
            if (contract.presence_package_limit && contract.used_presences >= contract.presence_package_limit) {
                throw new Error('Presence limit reached');
            }

            contract.used_presences++;

            MOCK_PRESENCE_LOGS.unshift({
                id: `log-${Date.now()}`,
                studio_id: studioId,
                artist_id: artistId,
                action: 'ADD',
                created_by: userId,
                created_at: new Date().toISOString()
            });
        },
        resetPresences: async (artistId: string, studioId: string, userId: string, note?: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 400));
            const contract = MOCK_CONTRACTS.find(c => c.artist_id === artistId);
            if (!contract) throw new Error('Contract not found');

            contract.used_presences = 0;
            contract.presence_cycle_start = new Date().toISOString();

            MOCK_PRESENCE_LOGS.unshift({
                id: `log-${Date.now()}`,
                studio_id: studioId,
                artist_id: artistId,
                action: 'RESET',
                created_by: userId,
                created_at: new Date().toISOString(),
                note
            });
        },
        getPresenceLogs: async (artistId: string): Promise<PresenceLog[]> => {
            await new Promise(resolve => setTimeout(resolve, 300));
            return MOCK_PRESENCE_LOGS.filter(l => l.artist_id === artistId);
        }
    };

    googleCalendar = {
        getAuthUrl: async (_userId: string): Promise<string> => {
            // Simulate Google OAuth URL
            await new Promise(resolve => setTimeout(resolve, 300));
            return 'https://accounts.google.com/o/oauth2/v2/auth?client_id=mock&redirect_uri=mock&response_type=code&scope=calendar';
        },
        connect: async (userId: string, _code: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate token exchange
            const user = MOCK_USERS.find(u => u.id === userId);
            if (!user) throw new Error('User not found');

            user.integrations = {
                google_calendar: {
                    is_connected: true,
                    email: user.email.replace('@inkflow.com', '@gmail.com'), // Simulate Gmail
                    calendar_id: 'primary',
                    last_sync: new Date().toISOString(),
                    auto_sync: true
                }
            };
        },
        disconnect: async (userId: string): Promise<void> => {
            await new Promise(resolve => setTimeout(resolve, 500));
            const user = MOCK_USERS.find(u => u.id === userId);
            if (!user) throw new Error('User not found');

            if (user.integrations?.google_calendar) {
                user.integrations.google_calendar.is_connected = false;
                delete user.integrations.google_calendar.email;
            }
        },
        updateSettings: async () => { },
        listCalendars: async () => [],
        syncEvents: async (userId: string): Promise<{ synced_events_count: number; logs?: string[] }> => {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate syncing
            const user = MOCK_USERS.find(u => u.id === userId);
            if (user?.integrations?.google_calendar) {
                user.integrations.google_calendar.last_sync = new Date().toISOString();
            }
            return {
                synced_events_count: Math.floor(Math.random() * 5) + 1,
                logs: ['[Mock] Synced some events']
            };
        }
    };



    waitlist = {
        list: async (studioId: string): Promise<WaitlistEntry[]> => {
            await new Promise(resolve => setTimeout(resolve, 400));
            return MOCK_WAITLIST.filter(w => w.studio_id === studioId);
        },
        addToWaitlist: async (data: Omit<WaitlistEntry, 'id' | 'created_at' | 'status'>, signatureData?: string, templateVersion?: number): Promise<WaitlistEntry> => {
            await new Promise(resolve => setTimeout(resolve, 800));

            // 1. Check if client exists (Mock logic: check by email in MOCK_CLIENTS)
            // In real app, we would query DB. Here we simulate "New Client" creation if not found.
            // But wait, the form passed 'client_id: new'. 
            // We should try to find by email/name if possible or just create new.

            // Let's create a NEW client for now to support the flow
            let clientId = data.client_id;
            if (clientId === 'new') {
                const newClient: Client = {
                    id: 'client-wl-' + Date.now(),
                    full_name: data.client_name,
                    email: data.email,
                    phone: data.phone || '123123123',
                    studio_id: 'studio-1',
                    fiscal_code: '', // Missing in WaitlistEntry data, but collected in Form
                    created_at: new Date().toISOString(),
                    last_appointment: null,
                    total_spent: 0,
                    notes: data.description,
                    tags: data.styles,
                    images: [],
                    consent_status: 'PENDING'
                };
                MOCK_CLIENTS.push(newClient);
                localStorage.setItem('inkflow_mock_clients', JSON.stringify(MOCK_CLIENTS));
                clientId = newClient.id;
            }

            // 2. If signature provided, sign consent
            if (signatureData && templateVersion) {
                await this.consents.signConsent(clientId, 'template-default', signatureData, templateVersion, 'CLIENT_FORM');
            }

            // 3. Create Waitlist Entry
            const newEntry: WaitlistEntry = {
                ...data,
                client_id: clientId,
                id: `wl - ${Date.now()} `,
                status: 'PENDING',
                created_at: new Date().toISOString()
            };
            MOCK_WAITLIST.push(newEntry);
            return newEntry;
        },
        addToWaitlistPublic: async (data: Omit<WaitlistEntry, 'id' | 'created_at' | 'status'>, signatureData?: string, templateVersion?: number): Promise<Pick<WaitlistEntry, 'id'>> => {
            // Re-use logic for simplicity, just return ID
            const entry = await this.waitlist.addToWaitlist(data, signatureData, templateVersion);
            return { id: entry.id };
        },
        updateStatus: async (id: string, status: WaitlistEntry['status']): Promise<WaitlistEntry> => {
            await new Promise(resolve => setTimeout(resolve, 400));
            const idx = MOCK_WAITLIST.findIndex(w => w.id === id);
            if (idx === -1) throw new Error('Not found');
            MOCK_WAITLIST[idx] = { ...MOCK_WAITLIST[idx], status };
            return MOCK_WAITLIST[idx];
        },
        update: async (id: string, data: Partial<WaitlistEntry>): Promise<WaitlistEntry> => {
            const idx = MOCK_WAITLIST.findIndex(w => w.id === id);
            if (idx === -1) throw new Error('Not found');
            MOCK_WAITLIST[idx] = { ...MOCK_WAITLIST[idx], ...data };
            return MOCK_WAITLIST[idx];
        },
        delete: async (id: string): Promise<void> => {
            const idx = MOCK_WAITLIST.findIndex(w => w.id === id);
            if (idx !== -1) MOCK_WAITLIST.splice(idx, 1);
        }
    };
}


