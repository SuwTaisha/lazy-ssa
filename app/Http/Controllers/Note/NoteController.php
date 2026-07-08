<?php

namespace App\Http\Controllers\Note;

use App\Http\Controllers\Controller;
use App\Models\Semester;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class NoteController extends Controller
{
    public function update(Request $request, Semester $semester, string $code): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);

        $subject = $semester->subjects()->where('code', $code)->firstOrFail();

        $data = $request->validate([
            'content' => ['required', 'string', 'max:20000'],
        ]);

        $subject->note()->updateOrCreate(
            ['subject_id' => $subject->id],
            ['content' => $data['content']]
        );

        return back();
    }

    public function destroy(Request $request, Semester $semester, string $code): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);

        $subject = $semester->subjects()->where('code', $code)->firstOrFail();

        $subject->note()->delete();

        return back();
    }
}
