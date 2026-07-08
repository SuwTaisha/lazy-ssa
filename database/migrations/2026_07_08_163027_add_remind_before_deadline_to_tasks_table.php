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
        Schema::table('tasks', function (Blueprint $table) {
            // Số phút trước deadline để nhắc (vd 45 = nhắc trước 45 phút, 1440 = nhắc
            // trước 1 ngày). NULL = không nhắc. Mặc định 1440 (1 ngày) để giữ gần đúng
            // hành vi cũ (trước đây SendTaskDeadlineReminders nhắc cố định trước 24h).
            $table->unsignedInteger('remind_minutes_before')->nullable()->default(1440)->after('deadline');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn('remind_minutes_before');
        });
    }
};
