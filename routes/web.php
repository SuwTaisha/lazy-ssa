<?php

use App\Http\Controllers\Home\HomeController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', [HomeController::class, 'show']);


require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
