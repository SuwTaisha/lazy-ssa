<?php

namespace App\Http\Controllers\Home;

use App\Http\Controllers\Controller;
use App\Models\ScheduleSlot;
use App\Models\Semester;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    private const STUDY_WEEKS = 7;

    public function index(Request $request): Response
    {
        $user = $request->user();
        if (! $user) {
            return Inertia::render('home/home', [
                'semStart' => $this->mondayOf(Carbon::now())->toDateString(),
                'subjects' => $this->demoSubjects(),
                'schedule' => $this->demoSchedule(),
                'scheduleByDate' => (object) [],
                'onlineDays' => $this->demoOnlineDays(),
                'tasks' => [],
                'notes' => (object) [],
                'examData' => (object) [],
                'isDemo' => true,
            ]);
        }

        $semester = $this->currentSemesterFor($user);
        $semester->load(['subjects.scheduleSlots', 'subjects.examEntries', 'subjects.note', 'onlineDays', 'tasks']);

        $subjects = $semester->subjects->map(fn ($s) => [
            'id' => $s->code,
            'name' => $s->code,
            'full' => $s->full_name,
            'color' => $s->color,
        ])->values();

        // Slot lặp lại hàng tuần (tạo thủ công qua UI, class_date null) -> lịch tuần cũ.
        // Gom TẤT CẢ slot của mọi môn lại rồi sort chung theo ngày, thay vì sort riêng
        // từng môn rồi nối mảng lại (thứ tự sẽ sai nếu 2 môn khác nhau cùng học 1 ngày,
        // vì lúc đó thứ tự phụ thuộc vào thứ tự lặp qua $subjects chứ không phải slot_order).
        $schedule = [];
        foreach (range(1, 5) as $day) {
            $schedule[$day] = [];
        }
        $allSlots = collect();
        foreach ($semester->subjects as $subject) {
            foreach ($subject->scheduleSlots as $slot) {
                if ($slot->class_date !== null) {
                    continue; // buổi có ngày cụ thể -> đi vào $upcomingSchedule, không vào lịch tuần
                }
                $allSlots->push([
                    'day' => $slot->day_of_week,
                    'sort_key' => sprintf('%03d', $slot->slot_order),
                    'code' => $subject->code,
                ]);
            }
        }
        foreach ($allSlots->groupBy('day') as $day => $items) {
            $schedule[$day] = $items->sortBy('sort_key')->pluck('code')->values()->all();
        }

        // Lịch theo ngày cụ thể (từ import .ics): map ngày -> danh sách môn học đúng ngày
        // đó, để in thẳng lên lịch tuần (mỗi tuần hiển thị đúng dữ liệu thật của tuần đó,
        // thay vì lặp lại 1 mẫu cố định). Chỉ giữ từ hôm nay trở đi.
        $today = Carbon::today()->toDateString();
        $byDate = [];
        foreach ($semester->subjects as $subject) {
            foreach ($subject->scheduleSlots as $slot) {
                if ($slot->class_date === null || $slot->class_date->toDateString() < $today) {
                    continue;
                }
                $byDate[$slot->class_date->toDateString()][] = [
                    'code' => $subject->code,
                    'startTime' => $slot->start_time,
                    'endTime' => $slot->end_time,
                    'slotOrder' => $slot->slot_order,
                    'isOnline' => $slot->is_online,
                    'sort_key' => $slot->start_time ?? '',
                ];
            }
        }
        $scheduleByDate = collect($byDate)->map(
            fn ($items) => collect($items)->sortBy('sort_key')->values()->map(fn ($i) => [
                'code' => $i['code'],
                'startTime' => $i['startTime'],
                'endTime' => $i['endTime'],
                'slotOrder' => $i['slotOrder'],
                'isOnline' => $i['isOnline'],
            ])->all()
        );

        $onlineDays = [];
        foreach (range(1, self::STUDY_WEEKS) as $w) {
            $onlineDays[$w] = [];
        }
        foreach ($semester->onlineDays as $od) {
            $onlineDays[$od->week_number][] = $od->day_of_week;
        }

        $tasks = $semester->tasks->map(fn ($t) => [
            'id' => $t->id,
            'subject' => optional($t->subject)->code ?? '',
            'text' => $t->text,
            'deadline' => optional($t->deadline)->toIso8601String() ?? '',
            'done' => $t->done,
            'createdAt' => $t->created_at->toIso8601String(),
        ])->values();

        $notes = [];
        foreach ($semester->subjects as $subject) {
            if ($subject->note) {
                $notes[$subject->code] = $subject->note->content;
            }
        }

        $examData = [];
        foreach ($semester->subjects as $subject) {
            foreach ($subject->examEntries as $exam) {
                $examData["w{$exam->week_number}_{$subject->code}"] = [
                    'date' => $exam->exam_date?->toDateString(),
                    'time' => $exam->exam_time,
                    'room' => $exam->room,
                    'type' => $exam->type,
                ];
            }
        }

        return Inertia::render('home/home', [
            'semesterId' => $semester->id,
            'semStart' => $semester->start_date->toDateString(),
            'subjects' => $subjects,
            'schedule' => $schedule,
            'scheduleByDate' => (object) $scheduleByDate->all(),
            'onlineDays' => $onlineDays,
            'tasks' => $tasks,
            'notes' => (object) $notes,
            'examData' => (object) $examData,
            'isDemo' => false,
        ]);
    }

    private function currentSemesterFor($user): Semester
    {
        $semester = Semester::where('user_id', $user->id)->latest('start_date')->first();

        if ($semester) {
            return $semester;
        }

        $semester = Semester::create([
            'user_id' => $user->id,
            'name' => null,
            'start_date' => $this->mondayOf(Carbon::now())->toDateString(),
        ]);

        $subjectIds = [];
        foreach ($this->demoSubjects() as $s) {
            $subjectIds[$s['id']] = $semester->subjects()->create([
                'code' => $s['id'],
                'full_name' => $s['full'],
                'color' => $s['color'],
            ])->id;
        }

        foreach ($this->demoSchedule() as $day => $codes) {
            foreach ($codes as $order => $code) {
                ScheduleSlot::create([
                    'subject_id' => $subjectIds[$code],
                    'day_of_week' => $day,
                    'slot_order' => $order,
                ]);
            }
        }

        foreach ($this->demoOnlineDays() as $week => $days) {
            foreach ($days as $day) {
                $semester->onlineDays()->create([
                    'week_number' => $week,
                    'day_of_week' => $day,
                ]);
            }
        }

        return $semester;
    }

    private function mondayOf(Carbon $date): Carbon
    {
        return $date->copy()->startOfWeek(Carbon::MONDAY);
    }

    /** Đúng theo DEFAULT_SUBJECTS trong page gốc. */
    private function demoSubjects(): array
    {
        return [
            ['id' => 'SSA101', 'name' => 'SSA101', 'full' => 'Soft Skills & Academic', 'color' => '#FF6B35'],
            ['id' => 'CSI106', 'name' => 'CSI106', 'full' => 'Computer Science Intro', 'color' => '#00C6FF'],
            ['id' => 'PRF192', 'name' => 'PRF192', 'full' => 'Programming Fundamentals', 'color' => '#A78BFA'],
            ['id' => 'MAE101', 'name' => 'MAE101', 'full' => 'Mathematics for Engineering', 'color' => '#34D399'],
            ['id' => 'CEA201', 'name' => 'CEA201', 'full' => 'Computer Engineering Architecture', 'color' => '#FBBF24'],
        ];
    }

    /** Đúng theo DEFAULT_SCHEDULE trong page gốc. */
    private function demoSchedule(): array
    {
        return [
            1 => ['SSA101', 'CSI106'],
            2 => ['PRF192', 'MAE101'],
            3 => ['CEA201', 'SSA101'],
            4 => ['MAE101', 'PRF192'],
            5 => ['CSI106', 'CEA201'],
        ];
    }

    private function demoOnlineDays(): array
    {
        $map = [];
        for ($w = 1; $w <= self::STUDY_WEEKS; $w++) {
            if ($w <= 2) {
                $map[$w] = [];
            } elseif ($w % 2 === 1) {
                $map[$w] = [2, 4];
            } else {
                $map[$w] = [1, 3, 5];
            }
        }

        return $map;
    }
}
