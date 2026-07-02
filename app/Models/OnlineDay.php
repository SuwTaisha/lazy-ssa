<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OnlineDay extends Model
{
    use HasFactory;

    protected $fillable = [
        'semester_id',
        'week_number',
        'day_of_week',
    ];

    protected $casts = [
        'week_number' => 'integer',
        'day_of_week' => 'integer',
    ];

    public function semester(): BelongsTo
    {
        return $this->belongsTo(Semester::class);
    }
}
