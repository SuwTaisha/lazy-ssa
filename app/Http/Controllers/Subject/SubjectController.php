<?php

namespace App\Http\Controllers\Subject;

use App\Http\Controllers\Controller;
use App\Models\Semester;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    public function sync(Request $request, Semester $semester): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'subjects' => ['required', 'array'],
            'subjects.*.id' => ['required', 'string', 'max:20', 'regex:/^[A-Za-z0-9]+$/'],
            'subjects.*.full' => ['required', 'string', 'max:255'],
            'subjects.*.color' => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ]);

        $incomingCodes = collect($data['subjects'])->pluck('id')->all();

        // Xoá môn không còn trong danh sách mới (cascade xoá luôn schedule/note/exam/task liên quan)
        $semester->subjects()->whereNotIn('code', $incomingCodes)->delete();

        foreach ($data['subjects'] as $s) {
            $semester->subjects()->updateOrCreate(
                ['code' => $s['id']],
                ['full_name' => $s['full'], 'color' => $s['color']]
            );
        }

        return back();
    }
}
