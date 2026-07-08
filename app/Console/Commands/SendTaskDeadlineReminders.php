<?php

namespace App\Console\Commands;

use App\Models\Task;
use App\Notifications\TaskDeadlineReminder;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class SendTaskDeadlineReminders extends Command
{
    protected $signature = 'app:send-task-deadline-reminders';

    protected $description = 'Gửi email + push notification cho các task sắp đến hạn (chưa được nhắc)';

    public function handle(): void
    {
        // Mỗi task tự chọn nhắc trước bao lâu (remind_minutes_before, phút) — task đã
        // vào "cửa sổ nhắc" của chính nó khi deadline <= now() + remind_minutes_before.
        // Không giới hạn cận dưới (không lọc "deadline >= now") để bắt luôn các task đã
        // quá hạn nhắc (vd scheduler không chạy kịp), tránh bỏ sót vĩnh viễn —
        // whereNull('reminder_sent_at') đảm bảo mỗi task chỉ được nhắc đúng 1 lần.
        // remind_minutes_before = null nghĩa là task đó không muốn được nhắc.
        $tasks = Task::where('done', false)
            ->whereNotNull('deadline')
            ->whereNotNull('remind_minutes_before')
            ->whereNull('reminder_sent_at')
            ->whereRaw('deadline <= DATE_ADD(NOW(), INTERVAL remind_minutes_before MINUTE)')
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
