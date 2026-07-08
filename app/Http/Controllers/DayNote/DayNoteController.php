<?php

namespace App\Http\Controllers\DayNote;

use App\Http\Controllers\Controller;
use App\Models\Semester;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class DayNoteController extends Controller
{
    public function update(Request $request, Semester $semester, string $date): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);
        abort_unless((bool) strtotime($date), 404);

        $data = $request->validate([
            'content' => ['required', 'string', 'max:20000'],
        ]);

        $semester->dayNotes()->updateOrCreate(
            ['date' => $date],
            ['content' => $data['content']]
        );

        return back();
    }
}
