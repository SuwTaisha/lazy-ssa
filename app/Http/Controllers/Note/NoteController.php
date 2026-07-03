<?php
 
namespace App\Http\Controllers\Note;
 
use App\Http\Controllers\Auth\ConfirmablePasswordController;
use App\Models\Subject;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
 
class NoteController extends ConfirmablePasswordController
{
    public function update(Request $request, Subject $subject): RedirectResponse
    {
        abort_unless($subject->semester->user_id === $request->user()->id, 403);
 
        $data = $request->validate([
            'content' => ['required', 'string'],
        ]);
 
        $subject->note()->updateOrCreate(
            ['subject_id' => $subject->id],
            ['content' => $data['content']]
        );
 
        return back();
    }
}
 