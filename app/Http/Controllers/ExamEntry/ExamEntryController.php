<?php

namespace App\Http\Controllers\ExamEntry;

use App\Http\Controllers\Controller;
use App\Models\ExamEntry;
use App\Models\Semester;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ExamEntryController extends Controller
{
    /**
     * Ghi đè các exam_entries của semester (cả 2 tuần thi cùng lúc, khớp với ExamModal.local).
     * Body: { examData: { "w8_SSA101": {date,time,room,type}, "w9_CSI106": {...}, ... } }
     */
    public function sync(Request $request, Semester $semester): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);

        // Ô trống trên form gửi lên là chuỗi rỗng "" chứ không phải null — cần đổi thành
        // null trước khi validate để 'nullable' thực sự bỏ qua các rule format bên dưới
        // (nullable của Laravel chỉ bỏ qua rule khi giá trị là null, không phải "").
        $examData = $request->input('examData', []);
        foreach ($examData as $key => $entry) {
            foreach (['date', 'time', 'room', 'type'] as $field) {
                if (($entry[$field] ?? null) === '') {
                    $examData[$key][$field] = null;
                }
            }
        }
        $request->merge(['examData' => $examData]);

        $data = $request->validate([
            'examData' => ['required', 'array'],
            'examData.*.date' => ['nullable', 'date'],
            'examData.*.time' => ['nullable', 'date_format:H:i'],
            'examData.*.room' => ['nullable', 'string', 'max:100'],
            'examData.*.type' => ['nullable', 'string', 'max:100'],
        ]);

        $subjectIdByCode = $semester->subjects()->pluck('id', 'code');

        foreach ($data['examData'] as $key => $entry) {
            // key dạng "w{week}_{code}"
            if (! preg_match('/^w(\d+)_(.+)$/', $key, $m)) {
                continue;
            }
            [$_, $week, $code] = $m;

            if (! isset($subjectIdByCode[$code])) {
                continue;
            }

            ExamEntry::updateOrCreate(
                ['subject_id' => $subjectIdByCode[$code], 'week_number' => (int) $week],
                [
                    'exam_date' => $entry['date'] ?? null,
                    'exam_time' => $entry['time'] ?? null,
                    'room' => $entry['room'] ?? null,
                    'type' => $entry['type'] ?? null,
                ]
            );
        }

        return back();
    }
}
