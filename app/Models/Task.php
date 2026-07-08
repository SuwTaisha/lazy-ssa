<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Task extends Model
{
    use HasFactory;

    protected $fillable = [
        'semester_id',
        'subject_id',
        'text',
        'deadline',
        'remind_minutes_before',
        'done',
    ];

    protected $casts = [
        'deadline' => 'datetime',
        'remind_minutes_before' => 'integer',
        'done' => 'boolean',
        'reminder_sent_at' => 'datetime',
    ];

    public function semester(): BelongsTo
    {
        return $this->belongsTo(Semester::class);
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function scopePending($query)
    {
        return $query->where('done', false);
    }

    public function scopeOverdue($query)
    {
        return $query->where('done', false)
            ->whereNotNull('deadline')
            ->where('deadline', '<', now());
    }
}
