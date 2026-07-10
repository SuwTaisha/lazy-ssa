<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\PasswordResetOtpNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class PasswordResetLinkController extends Controller
{
    /**
     * Show the password reset request page.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('auth/forgot-password', [
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Gửi mã OTP 6 số qua email — không dùng Password::sendResetLink() vì đây là luồng
     * OTP tự xây, không phải link kèm token của Laravel.
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('email', $request->email)->first();

        // Không tiết lộ email có tồn tại hay không (tránh dò email hợp lệ) — vẫn điều
        // hướng sang trang nhập OTP như bình thường dù không tìm thấy user.
        if ($user) {
            $otp = (string) random_int(100000, 999999);

            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $request->email],
                ['token' => Hash::make($otp), 'created_at' => now()]
            );

            $user->notify(new PasswordResetOtpNotification($otp));
        }

        return redirect()->route('password.reset', ['email' => $request->email])
            ->with('status', 'Đã gửi mã OTP tới email của bạn.');
    }
}
