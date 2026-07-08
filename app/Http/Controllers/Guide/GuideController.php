<?php

namespace App\Http\Controllers\Guide;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class GuideController extends Controller
{
    public function icsImport(): Response
    {
        return Inertia::render('guide/ics-import');
    }
}
