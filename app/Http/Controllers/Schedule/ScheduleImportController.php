<?php

namespace App\Http\Controllers\Schedule;

use App\Http\Controllers\Controller;
use App\Models\Semester;
use DateTimeImmutable;
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

        // Mỗi VEVENT là 1 buổi học vào 1 ngày CỤ THỂ — import thẳng vào đúng ngày đó,
        // không gộp lại thành 1 mẫu lặp lại hàng tuần (khác với thiết kế cũ).
        $today = new DateTimeImmutable('today');

        $occurrencesByCode = []; // mã môn -> danh sách buổi học SẮP TỚI (>= hôm nay)
        $touchedCodes = []; // mọi mã môn xuất hiện trong file (kể cả buổi đã qua), để dọn slot cũ
        $dayCounters = []; // "code:date" -> số buổi đã gặp trong ngày đó, dùng khi DESCRIPTION không có "Slot n"

        foreach ($calendar->VEVENT ?? [] as $event) {
            $code = trim((string) $event->SUMMARY);
            if ($code === '' || ! isset($event->DTSTART)) {
                continue;
            }

            $touchedCodes[$code] = true;

            $start = $event->DTSTART->getDateTime();
            if ($start < $today) {
                continue; // buổi đã diễn ra (đã học) — bỏ qua, không import
            }

            $end = isset($event->DTEND) ? $event->DTEND->getDateTime() : null;
            $dateStr = $start->format('Y-m-d');

            // Số SLOT thật lấy từ DESCRIPTION (VD "ENT503 - Slot 3 (13:00-15:15)"), để hiển
            // thị đúng đúng slot gốc thay vì đánh số lại theo vị trí trong ngày.
            $slotOrder = null;
            if (isset($event->DESCRIPTION) && preg_match('/Slot\s+(\d+)/i', (string) $event->DESCRIPTION, $m)) {
                $slotOrder = (int) $m[1];
            } else {
                $counterKey = "{$code}:{$dateStr}";
                $dayCounters[$counterKey] = ($dayCounters[$counterKey] ?? 0) + 1;
                $slotOrder = $dayCounters[$counterKey];
            }

            // LOCATION dạng "R.ONxx" là phòng học Online của trường; còn lại (R.Axx, VOV.., G...)
            // là phòng học trực tiếp (offline).
            $location = isset($event->LOCATION) ? trim((string) $event->LOCATION) : '';
            $location = rtrim($location, " \t-");
            $isOnline = (bool) preg_match('/^R\.?ON\d/i', $location);

            $occurrencesByCode[$code][] = [
                'date' => $dateStr,
                'day_of_week' => (int) $start->format('N'), // 1 (Thứ 2) .. 7 (Chủ nhật)
                'start_time' => $start->format('H:i:s'),
                'end_time' => $end?->format('H:i:s'),
                'slot_order' => $slotOrder,
                'is_online' => $isOnline,
                'sort' => $start,
            ];
        }

        if (empty($touchedCodes)) {
            throw ValidationException::withMessages([
                'ics_file' => 'Không tìm thấy buổi học nào trong file .ics.',
            ]);
        }

        DB::transaction(function () use ($semester, $occurrencesByCode, $touchedCodes) {
            $existingCount = $semester->subjects()->count();

            foreach (array_keys($touchedCodes) as $code) {
                $occurrences = $occurrencesByCode[$code] ?? [];

                // Môn không còn buổi nào sắp tới (đã học xong hết) thì không tạo mới —
                // chỉ cần dọn lịch cũ của nó (nếu có) ở dưới.
                if (empty($occurrences)) {
                    $existing = $semester->subjects()->where('code', $code)->first();
                    $existing?->scheduleSlots()->whereNotNull('class_date')->delete();

                    continue;
                }

                $subject = $semester->subjects()->firstOrNew(['code' => $code]);
                if (! $subject->exists) {
                    $subject->full_name = $code;
                    $subject->color = self::PRESET_COLORS[$existingCount % count(self::PRESET_COLORS)];
                    $subject->save();
                    $existingCount++;
                }

                usort($occurrences, fn ($a, $b) => $a['sort'] <=> $b['sort']);

                // Chỉ thay các buổi có ngày cụ thể (từ import trước đó); không đụng tới
                // slot lặp lại tạo thủ công qua UI (class_date null).
                $subject->scheduleSlots()->whereNotNull('class_date')->delete();
                foreach ($occurrences as $occ) {
                    $subject->scheduleSlots()->create([
                        'day_of_week' => $occ['day_of_week'],
                        'slot_order' => $occ['slot_order'],
                        'class_date' => $occ['date'],
                        'start_time' => $occ['start_time'],
                        'end_time' => $occ['end_time'],
                        'is_online' => $occ['is_online'],
                    ]);
                }
            }
        });

        return back();
    }
}
