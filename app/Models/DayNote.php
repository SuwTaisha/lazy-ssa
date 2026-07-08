<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DayNote extends Model
{
    use HasFactory;

    protected $fillable = [
        'semester_id',
        'date',
        'content',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function semester(): BelongsTo
    {
        return $this->belongsTo(Semester::class);
    }
}
