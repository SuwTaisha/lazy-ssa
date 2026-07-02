<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExamEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'subject_id',
        'week_number',
        'exam_date',
        'exam_time',
        'room',
        'type',
    ];

    protected $casts = [
        'week_number' => 'integer',
        'exam_date' => 'date',
    ];

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }
}
