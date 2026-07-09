<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use App\Models\MilestoneSurvey;
use App\Models\Semester;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    private const MILESTONES = ['day1', 'day7', 'day30'];

    public function index(): Response
    {
        $totalUsers = User::count();
        $newUsersThisWeek = User::where('created_at', '>=', Carbon::now()->subDays(7))->count();
        $activeUsers = $this->activeUserIds()->count();

        $feedbackCount = Feedback::count();
        $feedbackAvgRating = round((float) Feedback::avg('rating'), 2);

        $surveyCount = MilestoneSurvey::count();
        $surveyAvgRating = round((float) MilestoneSurvey::avg('rating'), 2);

        $surveyByMilestone = collect(self::MILESTONES)->map(function (string $milestone) {
            $query = MilestoneSurvey::where('milestone', $milestone);

            return [
                'milestone' => $milestone,
                'count' => (clone $query)->count(),
                'avgRating' => round((float) (clone $query)->avg('rating'), 2),
            ];
        })->values();

        $recentFeedback = Feedback::with('user:id,name,email')
            ->latest()
            ->take(15)
            ->get()
            ->map(fn ($f) => [
                'id' => $f->id,
                'rating' => $f->rating,
                'content' => $f->content,
                'userName' => optional($f->user)->name ?? '(đã xoá)',
                'createdAt' => $f->created_at->toIso8601String(),
            ]);

        $recentSurveys = MilestoneSurvey::with('user:id,name,email')
            ->latest()
            ->take(15)
            ->get()
            ->map(fn ($s) => [
                'id' => $s->id,
                'milestone' => $s->milestone,
                'rating' => $s->rating,
                'feedback' => $s->feedback,
                'userName' => optional($s->user)->name ?? '(đã xoá)',
                'createdAt' => $s->created_at->toIso8601String(),
            ]);

        return Inertia::render('admin/dashboard', [
            'stats' => [
                'totalUsers' => $totalUsers,
                'newUsersThisWeek' => $newUsersThisWeek,
                'totalSemesters' => Semester::count(),
                'totalTasks' => Task::count(),
                'feedbackCount' => $feedbackCount,
                'feedbackAvgRating' => $feedbackAvgRating,
                'surveyCount' => $surveyCount,
                'surveyAvgRating' => $surveyAvgRating,
                'activeUsers' => $activeUsers,
                'realUsageRate' => $totalUsers > 0 ? round($activeUsers / $totalUsers * 100) : 0,
            ],
            'surveyByMilestone' => $surveyByMilestone,
            'recentFeedback' => $recentFeedback,
            'recentSurveys' => $recentSurveys,
        ]);
    }

    /**
     * "Dùng thật" = có ít nhất 1 dấu hiệu tương tác thực sự với app, KHÔNG tính việc chỉ
     * đăng nhập — vì hệ thống tự tạo Semester (kèm môn/lịch demo) ngay lần đăng nhập đầu
     * tiên, nên "có Semester" không phân biệt được user thật với user chỉ ghé qua 1 lần.
     * Coi là "dùng thật" nếu user có ít nhất MỘT trong các hành động sau:
     *   - Tạo task
     *   - Viết ghi chú (theo môn hoặc theo ngày)
     *   - Thêm ca làm
     *   - Có buổi học gắn ngày cụ thể (tự thêm tay hoặc nhập từ file .ics — khác với lịch
     *     lặp hàng tuần mặc định, vốn có sẵn ngay từ lúc tạo tài khoản)
     *   - Gửi feedback hoặc đánh giá mốc thời gian
     *
     * @return Collection<int, int>
     */
    private function activeUserIds()
    {
        $ids = collect();

        $ids = $ids->merge(
            DB::table('tasks')->join('semesters', 'semesters.id', '=', 'tasks.semester_id')->pluck('semesters.user_id')
        );

        $ids = $ids->merge(
            DB::table('day_notes')->join('semesters', 'semesters.id', '=', 'day_notes.semester_id')->pluck('semesters.user_id')
        );

        $ids = $ids->merge(
            DB::table('notes')
                ->join('subjects', 'subjects.id', '=', 'notes.subject_id')
                ->join('semesters', 'semesters.id', '=', 'subjects.semester_id')
                ->pluck('semesters.user_id')
        );

        $ids = $ids->merge(
            DB::table('work_shifts')->join('semesters', 'semesters.id', '=', 'work_shifts.semester_id')->pluck('semesters.user_id')
        );

        $ids = $ids->merge(
            DB::table('schedule_slots')
                ->join('subjects', 'subjects.id', '=', 'schedule_slots.subject_id')
                ->join('semesters', 'semesters.id', '=', 'subjects.semester_id')
                ->whereNotNull('schedule_slots.class_date')
                ->pluck('semesters.user_id')
        );

        $ids = $ids->merge(Feedback::pluck('user_id'));
        $ids = $ids->merge(MilestoneSurvey::pluck('user_id'));

        return $ids->unique();
    }
}
