<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Carbon;

class AcademicDataSeeder extends Seeder
{
    private const STUDY_WEEKS = 7;

    /**
     * Đúng theo DEFAULT_SUBJECTS trong page.jsx / page.tsx gốc.
     */
    private const DEFAULT_SUBJECTS = [
        ['code' => 'SSA101', 'full_name' => 'Soft Skills & Academic', 'color' => '#FF6B35'],
        ['code' => 'CSI106', 'full_name' => 'Computer Science Intro', 'color' => '#00C6FF'],
        ['code' => 'PRF192', 'full_name' => 'Programming Fundamentals', 'color' => '#A78BFA'],
        ['code' => 'MAE101', 'full_name' => 'Mathematics for Engineering', 'color' => '#34D399'],
        ['code' => 'CEA201', 'full_name' => 'Computer Engineering Architecture', 'color' => '#FBBF24'],
    ];

    /**
     * Đúng theo DEFAULT_SCHEDULE: day_of_week (1=T2..5=T6) -> danh sách mã môn theo thứ tự slot.
     */
    private const DEFAULT_SCHEDULE = [
        1 => ['SSA101', 'CSI106'],
        2 => ['PRF192', 'MAE101'],
        3 => ['CEA201', 'SSA101'],
        4 => ['MAE101', 'PRF192'],
        5 => ['CSI106', 'CEA201'],
    ];

    public function run(): void
    {
        // ── 1. User demo ────────────────────────────────────────────
        $userId = DB::table('users')->insertGetId([
            'name' => 'Sensei Demo',
            'email' => 'demo@fpt.edu.vn',
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // ── 2. Semester: Monday của tuần hiện tại ───────────────────
        $semesterId = DB::table('semesters')->insertGetId([
            'user_id' => $userId,
            'name' => 'Học kỳ Summer 2026',
            'start_date' => Carbon::now()->startOfWeek(Carbon::MONDAY)->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // ── 3. Subjects ──────────────────────────────────────────────
        $subjectIds = []; // code -> id
        foreach (self::DEFAULT_SUBJECTS as $subject) {
            $subjectIds[$subject['code']] = DB::table('subjects')->insertGetId([
                'semester_id' => $semesterId,
                'code' => $subject['code'],
                'full_name' => $subject['full_name'],
                'color' => $subject['color'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // ── 4. Schedule slots (lịch lặp lại theo thứ) ───────────────
        foreach (self::DEFAULT_SCHEDULE as $dayOfWeek => $codes) {
            foreach ($codes as $slotOrder => $code) {
                DB::table('schedule_slots')->insert([
                    'subject_id' => $subjectIds[$code],
                    'day_of_week' => $dayOfWeek,
                    'slot_order' => $slotOrder,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // ── 5. Online days (đúng logic buildDefaultOnline gốc) ──────
        // Tuần 1-2: toàn Offline (không insert dòng nào).
        // Tuần lẻ (3,5,7): Online vào Thứ 3 & Thứ 5 (day 2, 4).
        // Tuần chẵn (4,6): Online vào Thứ 2, Thứ 4, Thứ 6 (day 1, 3, 5).
        for ($week = 1; $week <= self::STUDY_WEEKS; $week++) {
            if ($week <= 2) {
                continue;
            }
            $onlineDays = $week % 2 === 1 ? [2, 4] : [1, 3, 5];
            foreach ($onlineDays as $day) {
                DB::table('online_days')->insert([
                    'semester_id' => $semesterId,
                    'week_number' => $week,
                    'day_of_week' => $day,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // ── 6. Vài dữ liệu mẫu để demo UI có nội dung ────────────────
        DB::table('notes')->insert([
            'subject_id' => $subjectIds['PRF192'],
            'content' => "Ôn lại con trỏ (pointer) và cấp phát động (malloc/free) trước buổi thực hành tuần sau.",
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('tasks')->insert([
            [
                'semester_id' => $semesterId,
                'subject_id' => $subjectIds['PRF192'],
                'text' => 'Hoàn thành bài tập lớn Product Management System',
                'deadline' => Carbon::now()->addDays(3)->setTime(23, 59),
                'done' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'semester_id' => $semesterId,
                'subject_id' => $subjectIds['MAE101'],
                'text' => 'Làm bài tập chương 2: Đạo hàm',
                'deadline' => Carbon::now()->addDay()->setTime(20, 0),
                'done' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'semester_id' => $semesterId,
                'subject_id' => null,
                'text' => 'Đăng ký học phần kỳ sau',
                'deadline' => null,
                'done' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('exam_entries')->insert([
            'subject_id' => $subjectIds['SSA101'],
            'week_number' => self::STUDY_WEEKS + 1, // tuần thi 1
            'exam_date' => Carbon::now()->addWeeks(2)->toDateString(),
            'exam_time' => '07:30',
            'room' => 'BE-301',
            'type' => 'Vấn đáp',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
