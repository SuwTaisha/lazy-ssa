<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScheduleSlot extends Model
{
    use HasFactory;

    protected $fillable = [
        'subject_id',
        'day_of_week',
        'slot_order',
        'class_date',
        'start_time',
        'end_time',
        'is_online',
    ];

    protected $casts = [
        'day_of_week' => 'integer',
        'slot_order' => 'integer',
        'class_date' => 'date',
        'is_online' => 'boolean',
    ];

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }
}
