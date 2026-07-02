<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('semester_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subject_id')->nullable()->constrained()->nullOnDelete();
            $table->string('text');
            $table->dateTime('deadline')->nullable();
            $table->boolean('done')->default(false);
            $table->timestamps();

            $table->index(['semester_id', 'done']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
