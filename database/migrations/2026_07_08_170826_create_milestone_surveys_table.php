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
        Schema::create('milestone_surveys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('milestone'); // day1 | day7 | day30
            $table->unsignedTinyInteger('rating');
            $table->text('feedback')->nullable();
            $table->timestamps();

            // Mỗi mốc chỉ hỏi đúng 1 lần cho mỗi user.
            $table->unique(['user_id', 'milestone']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('milestone_surveys');
    }
};
