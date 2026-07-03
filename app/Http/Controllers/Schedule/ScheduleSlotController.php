<?php

namespace App\Http\Controllers\Schedule;

use App\Http\Controllers\Controller;
use App\Models\ScheduleSlot;
use App\Models\Semester;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;

class ScheduleSlotController extends Controller
{
    public function sync(Request $request, Semester $semester): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'schedule' => ['required', 'array'],
            'schedule.*' => ['array'],
            'schedule.*.*' => ['string'],
        ]);

        $subjectIdByCode = $semester->subjects()->pluck('id', 'code');

        ScheduleSlot::whereIn('subject_id', $subjectIdByCode->values())->delete();

        foreach ($data['schedule'] as $day => $codes) {
            foreach (array_values($codes) as $order => $code) {
                if (! $code || ! isset($subjectIdByCode[$code])) {
                    continue;
                }
                ScheduleSlot::create([
                    'subject_id' => $subjectIdByCode[$code],
                    'day_of_week' => (int) $day,
                    'slot_order' => $order,
                ]);
            }
        }

        return back();
    }
}