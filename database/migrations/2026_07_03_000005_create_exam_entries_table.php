<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exam_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subject_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('week_number'); // 8, 9 (tuần thi)
            $table->date('exam_date')->nullable();
            $table->string('exam_time', 20)->nullable(); // lưu dạng chuỗi vì UI chỉ nhập giờ tự do
            $table->string('room', 50)->nullable();
            $table->string('type', 50)->nullable(); // vd: Trắc nghiệm, Tự luận
            $table->timestamps();

            $table->unique(['subject_id', 'week_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exam_entries');
    }
};
