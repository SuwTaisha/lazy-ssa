<?php

namespace App\Http\Controllers\WorkShift;

use App\Http\Controllers\Controller;
use App\Models\Semester;
use App\Models\WorkShift;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class WorkShiftController extends Controller
{
    public function store(Request $request, Semester $semester): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'date' => ['required', 'date'],
            'work_shift_type_id' => ['nullable', 'integer'],
            'start_time' => ['required_without:work_shift_type_id', 'nullable', 'date_format:H:i'],
            'end_time' => ['required_without:work_shift_type_id', 'nullable', 'date_format:H:i'],
        ]);

        $startTime = $data['start_time'] ?? null;
        $endTime = $data['end_time'] ?? null;

        // Ca làm cố định: không tin giờ client gửi lên, luôn lấy đúng giờ đã lưu của loại
        // ca làm đó trong DB (giống cách ScheduleSlotController lấy SLOT_TIMES phía server).
        if (! empty($data['work_shift_type_id'])) {
            $type = $semester->workShiftTypes()->find($data['work_shift_type_id']);
            abort_unless($type, 404);
            $startTime = $type->start_time;
            $endTime = $type->end_time;
        }

        $semester->workShifts()->create([
            'date' => $data['date'],
            'start_time' => $startTime,
            'end_time' => $endTime,
        ]);

        return back();
    }

    public function destroy(Request $request, Semester $semester, WorkShift $workShift): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);
        abort_unless($workShift->semester_id === $semester->id, 404);

        $workShift->delete();

        return back();
    }
}
