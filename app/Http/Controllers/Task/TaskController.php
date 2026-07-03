<?php

namespace App\Http\Controllers\Task;

use App\Http\Controllers\Controller;
use App\Models\Semester;
use App\Models\Subject;
use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;

class TaskController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'subject' => ['nullable', 'string'],
            'text' => ['required', 'string', 'max:255'],
            'deadline' => ['nullable', 'date'],
        ]);

        $semester = $this->currentSemester($request);

        $subjectId = null;
        if (! empty($data['subject'])) {
            $subjectId = Subject::where('semester_id', $semester->id)
                ->where('code', $data['subject'])
                ->value('id');
        }

        Task::create([
            'semester_id' => $semester->id,
            'subject_id' => $subjectId,
            'text' => $data['text'],
            'deadline' => $data['deadline'] ?? null,
            'done' => false,
        ]);

        return back();
    }

    public function toggle(Request $request, Task $task): RedirectResponse
    {
        $this->authorizeTask($request, $task);

        $task->update(['done' => ! $task->done]);

        return back();
    }

    public function destroy(Request $request, Task $task): RedirectResponse
    {
        $this->authorizeTask($request, $task);

        $task->delete();

        return back();
    }

    private function authorizeTask(Request $request, Task $task): void
    {
        abort_unless($task->semester->user_id === $request->user()->id, 403);
    }

    private function currentSemester(Request $request): Semester
    {
        return Semester::where('user_id', $request->user()->id)
            ->latest('start_date')
            ->firstOrFail();
    }
}