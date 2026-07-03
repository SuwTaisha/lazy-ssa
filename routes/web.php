<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Examentry\ExamEntryController;
use App\Http\Controllers\Note\NoteController;
use App\Http\Controllers\Schedule\ScheduleSlotController;
use App\Http\Controllers\Semester\SemesterController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Home\HomeController;
use App\Http\Controllers\Online\OnlineDayController;
use App\Http\Controllers\Subject\SubjectController;
use App\Http\Controllers\Task\TaskController;
 

 
Route::get('/', [HomeController::class, 'index'])->name('home');
 
Route::middleware('auth')->group(function () {
    Route::post('/tasks', [TaskController::class, 'store'])->name('tasks.store');
    Route::patch('/tasks/{task}/toggle', [TaskController::class, 'toggle'])->name('tasks.toggle');
    Route::delete('/tasks/{task}', [TaskController::class, 'destroy'])->name('tasks.destroy');
 
    Route::put('/subjects/{subject}/note', [NoteController::class, 'update'])->name('notes.update');
 
    Route::put('/semesters/{semester}', [SemesterController::class, 'update'])->name('semesters.update');
    Route::put('/semesters/{semester}/subjects', [SubjectController::class, 'sync'])->name('subjects.sync');
    Route::put('/semesters/{semester}/schedule', [ScheduleSlotController::class, 'sync'])->name('schedule.sync');
    Route::put('/semesters/{semester}/online-days', [OnlineDayController::class, 'sync'])->name('online-days.sync');
    Route::put('/semesters/{semester}/exam-entries', [ExamEntryController::class, 'sync'])->name('exam-entries.sync');
});
 
require __DIR__.'/auth.php';