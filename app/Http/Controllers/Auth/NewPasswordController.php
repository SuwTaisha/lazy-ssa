<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class NewPasswordController extends Controller
{
    // Mã OTP hết hạn sau 10 phút kể từ lúc gửi — ngắn hơn hẳn hạn 60 phút mặc định của
    // link reset, vì OTP dùng ngay tại chỗ, không có lý do để giữ lâu.
    private const OTP_EXPIRE_MINUTES = 10;

    /**
     * Show the password reset page.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('auth/reset-password', [
            'email' => $request->query('email', ''),
        ]);
    }

    /**
     * Bước 1: chỉ xác thực mã OTP, chưa đổi mật khẩu — để frontend chặn người dùng
     * sang bước nhập mật khẩu mới khi OTP còn sai/hết hạn.
     *
     * @throws ValidationException
     */
    public function verifyOtp(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => 'required|email',
            'otp' => 'required|digits:6',
        ]);

        $this->assertOtpValid($request->string('email'), $request->string('otp'));

        return back();
    }

    /**
     * Bước 2: xác thực lại OTP (không tin tưởng riêng bước 1 ở client — request thẳng
     * vào đây vẫn phải qua kiểm tra) rồi mới đặt mật khẩu mới.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => 'required|email',
            'otp' => 'required|digits:6',
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $this->assertOtpValid($request->string('email'), $request->string('otp'));

        $user = User::where('email', $request->email)->first();

        if (! $user) {
            throw ValidationException::withMessages([
                'email' => 'Không tìm thấy tài khoản với email này.',
            ]);
        }

        $user->forceFill([
            'password' => Hash::make($request->password),
            'remember_token' => Str::random(60),
        ])->save();

        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        event(new PasswordReset($user));

        return to_route('login')->with('status', 'Đặt lại mật khẩu thành công! Đăng nhập lại nhé.');
    }

    /**
     * @throws ValidationException
     */
    private function assertOtpValid(string $email, string $otp): void
    {
        $record = DB::table('password_reset_tokens')->where('email', $email)->first();

        $valid = $record
            && Hash::check($otp, $record->token)
            && now()->lessThan(Carbon::parse($record->created_at)->addMinutes(self::OTP_EXPIRE_MINUTES));

        if (! $valid) {
            throw ValidationException::withMessages([
                'otp' => 'Mã OTP không đúng hoặc đã hết hạn.',
            ]);
        }
    }
}
