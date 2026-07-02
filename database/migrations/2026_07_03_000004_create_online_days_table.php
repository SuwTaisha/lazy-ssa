<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('online_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('semester_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('week_number'); // 1..7 (tuần học)
            $table->unsignedTinyInteger('day_of_week'); // 1 = Thứ 2 ... 5 = Thứ 6
            $table->timestamps();

            // Mỗi (semester, tuần, thứ) chỉ có 1 dòng = ngày đó là Online.
            // Không có dòng nào = mặc định Offline.
            $table->unique(['semester_id', 'week_number', 'day_of_week']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('online_days');
    }
};
