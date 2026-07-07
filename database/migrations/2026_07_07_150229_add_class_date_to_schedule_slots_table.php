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
            // Ngày học thực tế (từ import .ics) — 1 buổi = 1 ngày cụ thể, không còn gộp
            // thành 1 mẫu lặp lại hàng tuần. Null với slot tạo thủ công qua UI (lặp mãi mãi).
            $table->date('class_date')->nullable()->after('slot_order');
            $table->index(['subject_id', 'class_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('schedule_slots', function (Blueprint $table) {
            $table->dropIndex(['subject_id', 'class_date']);
            $table->dropColumn('class_date');
        });
    }
};
