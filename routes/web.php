<?php

use App\Http\Controllers\Examentry\ExamEntryController;
use App\Http\Controllers\ExamEntry\ExamEntryImportController;
use App\Http\Controllers\Feedback\FeedbackController;
use App\Http\Controllers\Home\HomeController;
use App\Http\Controllers\Note\NoteController;
use App\Http\Controllers\Online\OnlineDayController;
use App\Http\Controllers\Push\PushSubscriptionController;
use App\Http\Controllers\Schedule\ScheduleImportController;
use App\Http\Controllers\Schedule\ScheduleSlotController;
use App\Http\Controllers\Semester\SemesterController;
use App\Http\Controllers\Subject\SubjectController;
use App\Http\Controllers\Task\TaskController;
use Illuminate\Support\Facades\Route;

Route::get('/', [HomeController::class, 'index'])->name('home');

Route::middleware('auth')->group(function () {
    Route::post('/tasks', [TaskController::class, 'store'])->name('tasks.store');
    Route::patch('/tasks/{task}/toggle', [TaskController::class, 'toggle'])->name('tasks.toggle');
    Route::delete('/tasks/{task}', [TaskController::class, 'destroy'])->name('tasks.destroy');

    Route::put('/semesters/{semester}', [SemesterController::class, 'update'])->name('semesters.update');
    Route::put('/semesters/{semester}/subjects/{code}/note', [NoteController::class, 'update'])->name('notes.update');
    Route::put('/semesters/{semester}/subjects', [SubjectController::class, 'sync'])->name('subjects.sync');
    Route::put('/semesters/{semester}/subjects/{code}/schedule-slots', [ScheduleSlotController::class, 'update'])->name('schedule-slots.update');
    Route::delete('/semesters/{semester}/schedule-slots', [ScheduleSlotController::class, 'destroyAll'])->name('schedule-slots.destroy-all');
    Route::post('/semesters/{semester}/schedule/import', [ScheduleImportController::class, 'import'])->name('schedule.import');
    Route::put('/semesters/{semester}/online-days', [OnlineDayController::class, 'sync'])->name('online-days.sync');
    Route::put('/semesters/{semester}/exam-entries', [ExamEntryController::class, 'sync'])->name('exam-entries.sync');
    Route::post('/semesters/{semester}/exam-entries/import', [ExamEntryImportController::class, 'import'])->name('exam-entries.import');

    Route::post('/webpush/subscribe', [PushSubscriptionController::class, 'store'])->name('webpush.subscribe');
    Route::delete('/webpush/subscribe', [PushSubscriptionController::class, 'destroy'])->name('webpush.unsubscribe');

    Route::post('/feedback', [FeedbackController::class, 'store'])->name('feedback.store');
});

require __DIR__.'/auth.php';
