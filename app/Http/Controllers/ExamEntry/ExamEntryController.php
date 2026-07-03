<?php

namespace App\Http\Controllers\ExamEntry;

use App\Http\Controllers\Controller;
use App\Models\Semester;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;

class ExamEntryController extends Controller
{
    /**
     * Ghi đè các exam_entries của semester (cả 2 tuần thi cùng lúc, khớp với ExamModal.local).
     * Body: { examData: { "w8_SSA101": {date,time,room,type}, "w9_CSI106": {...}, ... } }
     */
    public function sync(Request $request, Semester $semester): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'examData' => ['required', 'array'],
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

            \App\Models\ExamEntry::updateOrCreate(
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