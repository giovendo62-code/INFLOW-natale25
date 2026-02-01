-- AUTO-RESET CHECKIN ON MANUAL DECREMENT
-- If the Manager manually decrements the 'attended_days' in academy_enrollments,
-- we assume they are cancelling TODAY's attendance.
-- This trigger automatically deletes the daily_attendance row for today, allowing the student to scan again.

CREATE OR REPLACE FUNCTION public.handle_manual_attendance_decrement()
RETURNS TRIGGER AS $$
BEGIN
    -- If the new attended_days is LESS than the old one (Manual decrement)
    IF NEW.attended_days < OLD.attended_days THEN
        -- Delete any check-in record for TODAY for this student/course
        DELETE FROM public.academy_daily_attendance
        WHERE course_id = NEW.course_id 
        AND student_id = NEW.student_id 
        AND date = CURRENT_DATE;
        
        -- Optional: Log this implicit cancellation
        -- RAISE NOTICE 'Deleted daily attendance for student % course % due to manual decrement', NEW.student_id, NEW.course_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger
DROP TRIGGER IF EXISTS on_attendance_decrement ON public.academy_enrollments;
CREATE TRIGGER on_attendance_decrement
    AFTER UPDATE OF attended_days
    ON public.academy_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_manual_attendance_decrement();
