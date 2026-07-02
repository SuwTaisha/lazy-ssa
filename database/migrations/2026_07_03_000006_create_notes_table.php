<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subject_id')->constrained()->cascadeOnDelete();
            $table->text('content');
            $table->timestamps();

            // Mỗi môn chỉ có 1 ghi chú (theo UI hiện tại: notes[subjectId] -> text)
            $table->unique('subject_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notes');
    }
};
