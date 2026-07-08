<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkShiftType extends Model
{
    use HasFactory;

    protected $fillable = [
        'semester_id',
        'name',
        'start_time',
        'end_time',
        'days_of_week',
    ];

    protected $casts = [
        'days_of_week' => 'array',
    ];

    public function semester(): BelongsTo
    {
        return $this->belongsTo(Semester::class);
    }
}
