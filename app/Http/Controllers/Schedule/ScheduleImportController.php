<?php

namespace App\Http\Controllers\Schedule;

use App\Http\Controllers\Controller;
use App\Models\Semester;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Sabre\VObject\ParseException;
use Sabre\VObject\Reader;

class ScheduleImportController extends Controller
{
    // Đúng theo PRESET_COLORS trong home.tsx, dùng để tô màu cho môn học mới tạo từ import.
    private const PRESET_COLORS = [
        '#FF6B35', '#00C6FF', '#A78BFA', '#34D399', '#FBBF24',
        '#F472B6', '#FB923C', '#38BDF8', '#4ADE80', '#E879F9',
        '#F87171', '#60A5FA', '#A3E635', '#FDE68A', '#6EE7B7',
    ];

    public function import(Request $request, Semester $semester): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'ics_file' => ['required', 'file', 'max:5120'],
        ]);

        $file = $data['ics_file'];
        if (strtolower($file->getClientOriginalExtension()) !== 'ics') {
            throw ValidationException::withMessages([
                'ics_file' => 'File phải có định dạng .ics',
            ]);
        }

        try {
            $calendar = Reader::read(file_get_contents($file->getRealPath()), Reader::OPTION_FORGIVING);
        } catch (ParseException) {
            throw ValidationException::withMessages([
                'ics_file' => 'Không thể đọc file .ics: file bị lỗi định dạng.',
            ]);
        }

        // Mỗi mã môn -> map "thứ:slot" -> [day_of_week, slot_order], để loại các buổi trùng lặp qua nhiều tuần.
        $slotsByCode = [];

        foreach ($calendar->VEVENT ?? [] as $event) {
            $code = trim((string) $event->SUMMARY);
            if ($code === '' || ! isset($event->DTSTART)) {
                continue;
            }

            $start = $event->DTSTART->getDateTime();
            $dayOfWeek = (int) $start->format('N'); // 1 (Thứ 2) .. 7 (Chủ nhật)

            if ($dayOfWeek > 5) {
                continue; // App chỉ hỗ trợ lịch học Thứ 2 - Thứ 6
            }

            $slotOrder = 0;
            if (isset($event->DESCRIPTION) && preg_match('/Slot\s+(\d+)/i', (string) $event->DESCRIPTION, $m)) {
                $slotOrder = max(0, ((int) $m[1]) - 1);
            } else {
                $slotOrder = (int) $start->format('H');
            }

            $slotsByCode[$code]["{$dayOfWeek}:{$slotOrder}"] = [$dayOfWeek, $slotOrder];
        }

        if (empty($slotsByCode)) {
            throw ValidationException::withMessages([
                'ics_file' => 'Không tìm thấy buổi học nào (Thứ 2 - Thứ 6) trong file .ics.',
            ]);
        }

        DB::transaction(function () use ($semester, $slotsByCode) {
            $existingCount = $semester->subjects()->count();

            foreach ($slotsByCode as $code => $slots) {
                $subject = $semester->subjects()->firstOrNew(['code' => $code]);

                if (! $subject->exists) {
                    $subject->full_name = $code;
                    $subject->color = self::PRESET_COLORS[$existingCount % count(self::PRESET_COLORS)];
                    $subject->save();
                    $existingCount++;
                }

                $subject->scheduleSlots()->delete();
                foreach (array_values($slots) as [$day, $order]) {
                    $subject->scheduleSlots()->create([
                        'day_of_week' => $day,
                        'slot_order' => $order,
                    ]);
                }
            }
        });

        return back();
    }
}
