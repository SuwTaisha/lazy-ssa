<?php

namespace App\Http\Controllers\WorkShiftType;

use App\Http\Controllers\Controller;
use App\Models\Semester;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkShiftTypeController extends Controller
{
    public function sync(Request $request, Semester $semester): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'types' => ['present', 'array'],
            'types.*.name' => ['required', 'string', 'max:50'],
            'types.*.start_time' => ['required', 'date_format:H:i'],
            'types.*.end_time' => ['required', 'date_format:H:i'],
            'types.*.days_of_week' => ['present', 'array'],
            'types.*.days_of_week.*' => ['integer', 'min:1', 'max:7'],
        ]);

        DB::transaction(function () use ($semester, $data) {
            // Ca làm cố định không có ràng buộc khoá ngoài từ work_shifts (mỗi buổi ca làm
            // đã tự lưu sẵn start/end riêng), nên xoá hết rồi tạo lại là an toàn, không ảnh
            // hưởng các ca làm đã thêm trước đó.
            $semester->workShiftTypes()->delete();

            foreach ($data['types'] as $type) {
                $semester->workShiftTypes()->create([
                    'name' => $type['name'],
                    'start_time' => $type['start_time'],
                    'end_time' => $type['end_time'],
                    'days_of_week' => array_values(array_unique($type['days_of_week'])),
                ]);
            }
        });

        return back();
    }
}
