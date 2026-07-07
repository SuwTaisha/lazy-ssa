<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('schedule_slots', function (Blueprint $table) {
            // Suy ra từ LOCATION khi import .ics (phòng "R.ONxx" = học online). Null với
            // slot tạo thủ công qua UI (dùng onlineDays theo tuần như cũ).
            $table->boolean('is_online')->nullable()->after('end_time');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('schedule_slots', function (Blueprint $table) {
            $table->dropColumn('is_online');
        });
    }
};
