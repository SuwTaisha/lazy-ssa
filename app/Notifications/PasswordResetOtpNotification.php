<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PasswordResetOtpNotification extends Notification
{
    public function __construct(private readonly string $otp) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Mã OTP đặt lại mật khẩu — FPT Time')
            ->line('Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản FPT Time.')
            ->line("Mã OTP của bạn là: {$this->otp}")
            ->line('Mã có hiệu lực trong 10 phút.')
            ->line('Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.');
    }
}
