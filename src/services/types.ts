export type UserRole = 'owner' | 'manager' | 'artist' | 'student' | 'studio_admin' | 'STUDIO_ADMIN' | 'MANAGER' | 'ARTIST' | 'STUDENT';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  studio_id?: string; // If user belongs to a specific studio (Artist/Manager)
  phone?: string;
  calendar_color?: string; // Color for calendar events
  integrations?: {
    google_calendar?: {
      is_connected: boolean;
      email?: string; // Connected Google Email
      calendar_id?: string;
      last_sync?: string;
      auto_sync: boolean;
      calendar_mapping?: Record<string, string>;
      two_way_sync?: boolean;
    };
  };
}

export interface AuthSession {
  user: User | null;
  token: string | null;
}

export interface ClientImage {
  id: string;
  url: string;
  description?: string;
  uploaded_at: string;
}

export interface Client {
  id: string;
  created_at?: string;
  full_name: string;
  email: string;
  phone: string;
  studio_id: string;
  images?: ClientImage[];
  whatsapp_broadcast_opt_in?: boolean;
  preferred_styles?: string[];
  fiscal_code?: string;
  address?: string;
  city?: string;
  zip_code?: string;
  last_appointment?: string | null;
  total_spent?: number;
  notes?: string;
  tags?: string[];
  consent_status?: 'SIGNED' | 'PENDING' | 'EXPIRED' | 'NONE';
}

export type AppointmentStatus = 'CONFIRMED' | 'PENDING' | 'COMPLETED' | 'NO_SHOW';

export interface Appointment {
  id: string;
  studio_id: string;
  artist_id: string;
  client_id: string;
  start_time: string; // ISO string
  end_time: string; // ISO string
  service_name: string;
  status: AppointmentStatus;
  notes?: string;
  client?: Client; // Joined data
  images?: string[]; // URLs of reference images
  price?: number; // Preventivo
  deposit?: number; // Acconto
  google_event_id?: string; // ID Google Calendar synced event
}


export interface Transaction {
  id: string;
  studio_id: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  date: string; // ISO
  description?: string;
  artist_id?: string; // If commission related
}

export interface FinancialStats {
  revenue_today: number;
  revenue_month: number;
  expenses_month: number;
}

export interface CourseMaterial {
  id: string;
  title: string;
  type: 'PDF' | 'VIDEO' | 'LINK';
  url: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  duration: string;
  price?: number;
  materials: CourseMaterial[];
  student_ids: string[];
}

export interface CommunicationReply {
  id: string;
  author_id: string;
  author_name: string; // Denormalized for display
  content: string;
  created_at: string;
}

export interface Communication {
  id: string;
  studio_id: string;
  author_id: string;
  author_name: string; // Denormalized for display
  content: string;
  is_important: boolean;
  created_at: string;
  replies: CommunicationReply[];
}

export interface StudentAttendance {
  id: string;
  student_id: string;
  date: string;
  confirmed_by?: string;
}

export interface ConsentTemplate {
  id: string;
  studio_id: string;
  version: number;
  content: string; // HTML
  title: string;
  is_active: boolean;
  required_resign: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientConsent {
  id: string;
  client_id: string;
  template_id: string;
  template_version: number;
  signed_at: string;
  signature_url?: string; // Internal signature data or URL
  pdf_url?: string; // Path to generated PDF
  status: 'SIGNED' | 'PENDING' | 'EXPIRED';
  signed_by_role: string;
}

export interface AttendanceLog {
  id: string;
  student_id: string;
  course_id: string;
  action: 'INCREMENT' | 'DECREMENT' | 'SET' | 'RESET' | 'LIMIT_CHANGE';
  previous_value: number;
  new_value: number;
  created_by: string;
  created_at: string;
}

export interface CourseEnrollment {
  course_id: string;
  student_id: string;
  allowed_days: number;
  attended_days: number;
  attendance_updated_at?: string;
  attendance_updated_by?: string;
  total_cost?: number;
  deposits?: {
    id: string;
    amount: number;
    date: string;
    note?: string;
  }[];
}

// Recurring Expenses
export interface RecurringExpense {
  id: string;
  studio_id: string;
  name: string;
  amount: number;
  category: string;
  day_of_month: number;
}

export interface IRepository {
  auth: {
    signIn(email: string, password: string): Promise<AuthSession>;
    signUp(email: string, password: string, redirectUrl?: string): Promise<AuthSession | null>; // null if confirmation required
    signOut(): Promise<void>;
    getCurrentUser(): Promise<User | null>;
  };
  appointments: {
    list(start: Date, end: Date, artistId?: string): Promise<Appointment[]>;
    create(data: Omit<Appointment, 'id'>): Promise<Appointment>;
    update(id: string, data: Partial<Appointment>): Promise<Appointment>;
    delete(id: string): Promise<void>;
  };
  clients: {
    list(search?: string): Promise<Client[]>;
    getById(id: string): Promise<Client | null>;
    create(data: Omit<Client, 'id'>): Promise<Client>;
    update(id: string, data: Partial<Client>): Promise<Client>;
    delete(id: string): Promise<void>;
  };
  financials: {
    listTransactions(startDate: Date, endDate: Date): Promise<Transaction[]>;
    createTransaction(data: Omit<Transaction, 'id'>): Promise<Transaction>;
    deleteTransaction(id: string): Promise<void>;
    getStats(month: Date): Promise<FinancialStats>;
    // Recurring
    listRecurringExpenses(studioId: string): Promise<RecurringExpense[]>;
    createRecurringExpense(data: Omit<RecurringExpense, 'id'>): Promise<RecurringExpense>;
    deleteRecurringExpense(id: string): Promise<void>;
    generateRecurringTransactions(studioId: string, month: Date): Promise<void>;
  };
  academy: {
    listMaterials(): Promise<CourseMaterial[]>;
    recordAttendance(studentId: string): Promise<StudentAttendance>;
    listCourses(): Promise<Course[]>;
    createCourse(data: Omit<Course, 'id'>): Promise<Course>;
    updateCourse(id: string, data: Partial<Course>): Promise<Course>;
    deleteCourse(id: string): Promise<void>;
    assignStudent(courseId: string, studentId: string): Promise<void>;
    updateAttendance(courseId: string, studentId: string, date: Date, status: 'PRESENT' | 'ABSENT' | 'LATE'): Promise<void>;
    getEnrollment(courseId: string, studentId: string): Promise<CourseEnrollment | null>;
    updateEnrollment(courseId: string, studentId: string, data: Partial<CourseEnrollment>): Promise<CourseEnrollment>;
    logAttendance(log: Omit<AttendanceLog, 'id' | 'created_at'>): Promise<void>;
    getAttendanceLogs(courseId: string, studentId: string): Promise<AttendanceLog[]>;
  };
  communications: {
    list(studioId: string): Promise<Communication[]>;
    create(data: Omit<Communication, 'id' | 'created_at' | 'replies'>): Promise<Communication>;
    delete(id: string): Promise<void>;
    addReply(communicationId: string, data: Omit<CommunicationReply, 'id' | 'created_at'>): Promise<CommunicationReply>;
  };
  settings: {
    updateProfile(userId: string, data: Partial<User>): Promise<User>;
    listTeamMembers(studioId: string): Promise<User[]>;
    inviteMember(email: string, role: UserRole, studioId: string): Promise<User>;
    removeMember(userId: string): Promise<void>;
    getStudio(studioId: string): Promise<Studio | null>;
    updateStudio(studioId: string, data: Partial<Studio>): Promise<Studio>;
    registerStudio(name: string, userId: string): Promise<Studio>;
    checkMembership(userId: string): Promise<boolean>;
    createInvitation(studioId: string, email: string, role: string, token: string, invitedBy: string): Promise<void>;
    getInvitation(token: string): Promise<any>;
    acceptInvitation(token: string, userId: string, studioId: string, role: string): Promise<void>;
  };
  consents: {
    getTemplate(studioId: string): Promise<ConsentTemplate | null>;
    updateTemplate(data: Partial<ConsentTemplate>): Promise<ConsentTemplate>;
    listClientConsents(clientId: string): Promise<ClientConsent[]>;
    signConsent(clientId: string, templateId: string, signatureData: string, version: number, role: string): Promise<ClientConsent>;
    getStats(studioId: string): Promise<{ signed_count: number; pending_count: number }>;
  };
  artists: {
    list(studioId: string): Promise<User[]>;
    getContract(artistId: string): Promise<ArtistContract | null>;
    updateContract(artistId: string, data: Partial<ArtistContract>): Promise<ArtistContract>;
    addPresence(artistId: string, studioId: string, userId: string): Promise<void>;
    resetPresences(artistId: string, studioId: string, userId: string, note?: string): Promise<void>;
    getPresenceLogs(artistId: string): Promise<PresenceLog[]>;
  };
  marketing: {
    listCampaigns(): Promise<MarketingCampaign[]>;
    createCampaign(data: Omit<MarketingCampaign, 'id' | 'created_at'>): Promise<MarketingCampaign>;
    generateAIMessage(prompt: { goal: string; tone: string; length: string; customContext?: string; apiKey?: string; studioName?: string; studioAddress?: string; studioPhone?: string }): Promise<string[]>;
  };
  googleCalendar: {
    getAuthUrl(userId: string): Promise<string>;
    connect(userId: string, code: string): Promise<void>;
    disconnect(userId: string): Promise<void>;
    updateSettings(userId: string, settings: any): Promise<void>;
    syncEvents(userId: string): Promise<{ synced: number }>;
    listCalendars(userId: string): Promise<any[]>;
  };
  waitlist: {
    list(studioId: string): Promise<WaitlistEntry[]>;
    addToWaitlist(data: Omit<WaitlistEntry, 'id' | 'created_at' | 'status'>, signatureData?: string, templateVersion?: number): Promise<WaitlistEntry>;
    updateStatus(id: string, status: WaitlistEntry['status']): Promise<WaitlistEntry>;
  };
  storage: {
    upload(bucket: string, path: string, file: File): Promise<string>; // Returns public URL
    delete(bucket: string, path: string): Promise<void>;
  };
}

export type RentType = 'FIXED' | 'PERCENTAGE' | 'PRESENCES';

export interface ArtistDocument {
  id: string;
  name: string;
  url: string;
  uploaded_at: string;
}

export interface ArtistContract {
  id: string;
  studio_id: string;
  artist_id: string;
  commission_rate?: number; // % (0-100)
  rent_type: RentType;
  rent_fixed_amount?: number;
  rent_percent_rate?: number;
  presence_price?: number;
  presence_package_limit?: number;
  used_presences: number; // For package tracking
  presence_cycle_start?: string; // Date of package purchase/reset
  presence_cycle_end?: string;
  vat_number?: string;
  fiscal_code?: string;
  address?: string;
  iban?: string;
  documents?: ArtistDocument[];
  created_at?: string;
  updated_at?: string;
}

export interface PresenceLog {
  id: string;
  studio_id: string;
  artist_id: string;
  action: 'ADD' | 'RESET';
  created_by: string;
  created_at: string; // ISO
  note?: string;
}

// Marketing
export interface MarketingCampaign {
  id: string;
  studio_id: string;
  title: string;
  channel: 'WHATSAPP' | 'EMAIL' | 'SMS';
  message_text: string;
  ai_used: boolean;
  filters: {
    search?: string;
    broadcast_status?: 'ALL' | 'IN_BROADCAST' | 'NOT_IN_BROADCAST';
    styles?: string[];
  };
  recipients_count: number;
  status: 'DRAFT' | 'SENT';
  created_at: string;
  sent_at?: string;
}

export interface WaitlistEntry {
  id: string;
  studio_id: string;
  client_id: string;
  email: string;
  phone?: string;
  client_name: string; // Joined for display
  preferred_artist_id?: string;
  artist_pref_id?: string;
  styles: string[];
  description?: string;
  images?: string[];
  status: 'PENDING' | 'CONTACTED' | 'IN_PROGRESS' | 'BOOKED' | 'REJECTED';
  created_at: string;
}

export interface Studio {
  id: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  logo_url?: string;
  website?: string;
  vat_number?: string;
  fiscal_code?: string;
  company_name?: string;
}
