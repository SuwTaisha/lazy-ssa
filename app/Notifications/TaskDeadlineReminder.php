<?php

namespace App\Notifications;

use App\Models\Task;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class TaskDeadlineReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly Task $task)
    {
        //
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', WebPushChannel::class];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("⏰ Deadline sắp đến: {$this->task->text}")
            ->line("Nhiệm vụ \"{$this->task->text}\" sắp đến hạn.")
            ->line('Hạn chót: '.$this->task->deadline->format('H:i d/m/Y'))
            ->action('Mở lazy-ssa', url('/'));
    }

    public function toWebPush(object $notifiable, self $notification): WebPushMessage
    {
        return (new WebPushMessage)
            ->title('⏰ Deadline sắp đến')
            ->icon('/favicon.ico')
            ->body($this->task->text.' — hạn chót '.$this->task->deadline->format('H:i d/m/Y'))
            ->data(['url' => url('/')]);
    }
}
