<?php

namespace App\Http\Controllers\Semester;

use App\Http\Controllers\Controller;
use App\Models\Semester;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Carbon;

class SemesterController extends Controller

{
    public function update(Request $request, Semester $semester): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'start_date' => ['required', 'date'],
        ]);

        $semester->update([
            // Luôn snap về Thứ 2 của tuần chứa ngày được chọn, giống setSemStart() gốc
            'start_date' => Carbon::parse($data['start_date'])->startOfWeek(Carbon::MONDAY)->toDateString(),
        ]);

        return back();
    }
}