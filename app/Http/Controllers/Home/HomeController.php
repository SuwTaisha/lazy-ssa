<?php
namespace App\Http\Controllers\Home;

use App\Http\Controllers\Controller;
use Inertia\Inertia;

class HomeController extends Controller {
    public function show() {
        return Inertia::render('home/home');
    }    
}