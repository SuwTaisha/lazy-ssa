<?php

namespace App\Http\Controllers\Schedule;

use App\Http\Controllers\Controller;
use App\Models\ScheduleSlot;
use App\Models\Semester;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ScheduleSlotController extends Controller
{
    // Khung giờ chuẩn theo slot của FPT — cố định, không cho tự chọn giờ để tránh nhập sai.
    private const SLOT_TIMES = [
        1 => ['07:00', '09:15'],
        2 => ['09:30', '11:45'],
        3 => ['12:30', '14:45'],
        4 => ['15:00', '17:15'],
        5 => ['17:30', '19:45'],
    ];

    public function destroyAll(Request $request, Semester $semester): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);

        ScheduleSlot::whereIn('subject_id', $semester->subjects()->pluck('id'))->delete();

        return back();
    }

    public function update(Request $request, Semester $semester, string $code): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);

        $subject = $semester->subjects()->where('code', $code)->firstOrFail();

        $data = $request->validate([
            'slots' => ['present', 'array'],
            'slots.*.class_date' => ['required', 'date'],
            'slots.*.slot' => ['required', 'integer', 'min:1', 'max:5'],
            'slots.*.is_online' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($subject, $data) {
            // Chỉ xoá các buổi có ngày cụ thể của MỘT môn này (không đụng môn khác, không
            // đụng slot lặp lại tạo qua UI cũ nếu còn) — khác với sync() cũ xoá cả semester.
            $subject->scheduleSlots()->whereNotNull('class_date')->delete();

            foreach ($data['slots'] as $slot) {
                [$start, $end] = self::SLOT_TIMES[$slot['slot']];

                $subject->scheduleSlots()->create([
                    'day_of_week' => Carbon::parse($slot['class_date'])->dayOfWeekIso,
                    'slot_order' => $slot['slot'],
                    'class_date' => $slot['class_date'],
                    'start_time' => $start,
                    'end_time' => $end,
                    'is_online' => $slot['is_online'],
                ]);
            }
        });

        return back();
    }
}
