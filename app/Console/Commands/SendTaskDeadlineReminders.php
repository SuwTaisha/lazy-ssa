<?php

namespace App\Console\Commands;

use App\Models\Task;
use App\Notifications\TaskDeadlineReminder;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class SendTaskDeadlineReminders extends Command
{
    // Nhắc trước khi đến hạn tối đa 24h. Không giới hạn cận dưới (không lọc theo
    // "deadline >= now") để bắt luôn các task đã quá hạn nhắc (vd scheduler không
    // chạy kịp), tránh bỏ sót vĩnh viễn — whereNull('reminder_sent_at') đảm bảo
    // mỗi task chỉ được nhắc đúng 1 lần.
    private const HOURS_BEFORE_DEADLINE = 24;

    protected $signature = 'app:send-task-deadline-reminders';

    protected $description = 'Gửi email + push notification cho các task sắp đến hạn (chưa được nhắc)';

    public function handle(): void
    {
        $tasks = Task::where('done', false)
            ->whereNotNull('deadline')
            ->whereNull('reminder_sent_at')
            ->where('deadline', '<=', Carbon::now()->addHours(self::HOURS_BEFORE_DEADLINE))
            ->with('semester.user')
            ->get();

        $sent = 0;
        foreach ($tasks as $task) {
            $user = $task->semester?->user;
            if (! $user) {
                continue;
            }

            $user->notify(new TaskDeadlineReminder($task));

            // Không dùng update()/fill(): reminder_sent_at cố tình không nằm trong
            // $fillable (để không bao giờ có thể bị gán hàng loạt từ request), nên phải
            // gán trực tiếp thuộc tính rồi save() để né guard mass-assignment.
            $task->reminder_sent_at = Carbon::now();
            $task->save();
            $sent++;
        }

        $this->info("Đã gửi nhắc nhở cho {$sent}/{$tasks->count()} task.");
    }
}
