<?php

namespace App\Http\Controllers\Online;

use App\Http\Controllers\Controller;
use App\Models\Semester;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;

class OnlineDayController extends Controller
{

    public function sync(Request $request, Semester $semester): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'onlineDays' => ['required', 'array'],
            'onlineDays.*' => ['array'],
            'onlineDays.*.*' => ['integer', 'between:1,5'],
        ]);

        $semester->onlineDays()->delete();

        $rows = [];
        foreach ($data['onlineDays'] as $week => $days) {
            foreach ($days as $day) {
                $rows[] = [
                    'semester_id' => $semester->id,
                    'week_number' => (int) $week,
                    'day_of_week' => (int) $day,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        if ($rows) {
            $semester->onlineDays()->insert($rows);
        }

        return back();
    }
}