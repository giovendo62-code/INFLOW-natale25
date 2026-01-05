-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ACADEMY TABLES

CREATE TABLE IF NOT EXISTS public.academy_courses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    studio_id UUID NOT NULL, 
    title TEXT NOT NULL,
    description TEXT,
    duration TEXT,
    price NUMERIC(10,2) DEFAULT 0, -- Added price column
    materials JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.academy_enrollments (
    course_id UUID REFERENCES public.academy_courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    allowed_days INTEGER DEFAULT 0,
    attended_days INTEGER DEFAULT 0,
    attendance_updated_at TIMESTAMPTZ,
    attendance_updated_by UUID,
    total_cost NUMERIC(10,2) DEFAULT 0,
    deposits JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (course_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.academy_daily_attendance (
    course_id UUID REFERENCES public.academy_courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    date DATE NOT NULL,
    status TEXT CHECK (status IN ('PRESENT', 'ABSENT', 'LATE')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (course_id, student_id, date)
);

CREATE TABLE IF NOT EXISTS public.academy_attendance_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    course_id UUID REFERENCES public.academy_courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    action TEXT NOT NULL,
    previous_value INTEGER,
    new_value INTEGER,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMMUNICATIONS TABLES

CREATE TABLE IF NOT EXISTS public.communications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    studio_id UUID NOT NULL,
    author_id UUID NOT NULL,
    author_name TEXT,
    content TEXT NOT NULL,
    is_important BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.communication_replies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    communication_id UUID REFERENCES public.communications(id) ON DELETE CASCADE,
    author_id UUID NOT NULL,
    author_name TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WAITLIST TABLES

CREATE TABLE IF NOT EXISTS public.waitlist_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    studio_id UUID NOT NULL,
    client_id UUID,
    email TEXT,
    phone TEXT,
    client_name TEXT,
    preferred_artist_id UUID,
    styles TEXT[],
    description TEXT,
    images TEXT[],
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONTACTED', 'IN_PROGRESS', 'BOOKED', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS POLICIES
ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_daily_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write for now (Development Mode)
CREATE POLICY "Enable all access for authenticated users" ON public.academy_courses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.academy_enrollments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.academy_daily_attendance FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.academy_attendance_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.communications FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.communication_replies FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.waitlist_entries FOR ALL USING (auth.role() = 'authenticated');
