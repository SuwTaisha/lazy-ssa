import { Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

interface ResetPasswordProps {
    email: string;
}

interface ResetPasswordForm {
    email: string;
    otp: string;
    password: string;
    password_confirmation: string;
    [key: string]: string;
}

export default function ResetPassword({ email }: ResetPasswordProps) {
    const { data, setData, post, processing, errors, reset } = useForm<ResetPasswordForm>({
        email,
        otp: '',
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/reset-password', {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#06061a] px-4 py-10 font-['Outfit',_sans-serif] text-[#e2e2f0]">
            <div
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                    backgroundImage: 'radial-gradient(#ffffff08 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                }}
            />

            <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d22] p-8 shadow-2xl sm:p-10">
                <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-xl font-black tracking-tight text-[#FF6B35]">FPT</span>
                    <span className="text-xl font-black tracking-tight text-white">TIME</span>
                </div>

                <h1 className="mt-2 text-xl font-extrabold text-white">Đặt lại mật khẩu</h1>
                <p className="mt-1 text-[12px] leading-relaxed text-white/40">
                    Nhập mã OTP đã gửi tới <span className="font-semibold text-white/70">{email}</span> và mật khẩu mới.
                </p>

                <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
                    <div>
                        <label htmlFor="email" className="mb-1.5 block text-[11px] font-semibold text-white/50">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={data.email}
                            readOnly
                            className="w-full cursor-not-allowed rounded-lg border border-white/10 bg-[#1a1a32]/50 px-3.5 py-2.5 text-[13px] text-white/50 outline-none"
                        />
                        {errors.email && <p className="mt-1.5 text-[11px] text-red-400">{errors.email}</p>}
                    </div>

                    <div>
                        <label htmlFor="otp" className="mb-1.5 block text-[11px] font-semibold text-white/50">
                            Mã OTP (6 số)
                        </label>
                        <input
                            id="otp"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            autoComplete="one-time-code"
                            value={data.otp}
                            onChange={(e) => setData('otp', e.target.value.replace(/\D/g, ''))}
                            placeholder="123456"
                            autoFocus
                            className="w-full rounded-lg border border-white/10 bg-[#1a1a32] px-3.5 py-2.5 text-center text-[16px] tracking-[6px] text-[#e2e2f0] outline-none placeholder:text-white/20 focus:border-[#FF6B3560] focus:ring-1 focus:ring-[#FF6B3540]"
                        />
                        {errors.otp && <p className="mt-1.5 text-[11px] text-red-400">{errors.otp}</p>}
                    </div>

                    <div>
                        <label htmlFor="password" className="mb-1.5 block text-[11px] font-semibold text-white/50">
                            Mật khẩu mới
                        </label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="new-password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="Mật khẩu mới"
                            className="w-full rounded-lg border border-white/10 bg-[#1a1a32] px-3.5 py-2.5 text-[13px] text-[#e2e2f0] outline-none placeholder:text-white/20 focus:border-[#FF6B3560] focus:ring-1 focus:ring-[#FF6B3540]"
                        />
                        {errors.password && <p className="mt-1.5 text-[11px] text-red-400">{errors.password}</p>}
                    </div>

                    <div>
                        <label htmlFor="password_confirmation" className="mb-1.5 block text-[11px] font-semibold text-white/50">
                            Xác nhận mật khẩu
                        </label>
                        <input
                            id="password_confirmation"
                            type="password"
                            autoComplete="new-password"
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            placeholder="Nhập lại mật khẩu mới"
                            className="w-full rounded-lg border border-white/10 bg-[#1a1a32] px-3.5 py-2.5 text-[13px] text-[#e2e2f0] outline-none placeholder:text-white/20 focus:border-[#FF6B3560] focus:ring-1 focus:ring-[#FF6B3540]"
                        />
                        {errors.password_confirmation && <p className="mt-1.5 text-[11px] text-red-400">{errors.password_confirmation}</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={processing}
                        className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-[#FF6B35] px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#ff7d4d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {processing ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
                    </button>
                </form>

                <p className="mt-6 text-center text-[12px] text-white/40">
                    Chưa nhận được mã?{' '}
                    <Link href="/forgot-password" className="font-semibold text-[#FF6B35] hover:text-[#ff8255]">
                        Gửi lại
                    </Link>
                </p>
            </div>
        </div>
    );
}
