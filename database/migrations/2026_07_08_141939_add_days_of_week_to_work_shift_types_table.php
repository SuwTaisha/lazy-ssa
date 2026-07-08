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
        Schema::table('work_shift_types', function (Blueprint $table) {
            // Thứ trong tuần (1=Thứ 2 .. 7=Chủ Nhật) mà ca làm cố định này tự động lặp lại
            // mỗi tuần; rỗng = chỉ dùng làm mẫu cho "thêm ca làm theo ngày", không tự áp lịch.
            $table->json('days_of_week')->nullable()->after('end_time');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('work_shift_types', function (Blueprint $table) {
            $table->dropColumn('days_of_week');
        });
    }
};
