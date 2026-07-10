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
     * Xác thực OTP rồi đặt mật khẩu mới — thay cho Password::reset() (dựa vào token
     * trong URL), vì luồng này dùng mã OTP người dùng tự nhập.
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

        $record = DB::table('password_reset_tokens')->where('email', $request->email)->first();

        $valid = $record
            && Hash::check($request->otp, $record->token)
            && now()->lessThan(Carbon::parse($record->created_at)->addMinutes(self::OTP_EXPIRE_MINUTES));

        if (! $valid) {
            throw ValidationException::withMessages([
                'otp' => 'Mã OTP không đúng hoặc đã hết hạn.',
            ]);
        }

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
}
