import { Link, useForm } from "@inertiajs/react";
import { FormEventHandler } from "react";

// ── Dữ liệu tĩnh chỉ để minh hoạ preview lịch tuần bên trái ──────
const PREVIEW_DAYS = [
  { day: "T2", subject: "PRF192", mode: "🏫" },
  { day: "T3", subject: "MAE101", mode: "🌐" },
  { day: "T4", subject: "CEA201", mode: "🏫" },
  { day: "T5", subject: "CSI106", mode: "🌐" },
  { day: "T6", subject: "SSA101", mode: "🏫" },
];

interface ForgotPasswordProps {
  status?: string;
}

export default function ForgotPassword({ status }: ForgotPasswordProps) {
  const { data, setData, post, processing, errors } = useForm({
    email: "",
  });

  const submit: FormEventHandler = (e) => {
    e.preventDefault();
    post("/forgot-password");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#06061a] px-4 py-10 font-['Outfit',_sans-serif] text-[#e2e2f0]">
      {/* Nền chấm */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(#ffffff08 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative z-10 grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d22] shadow-2xl md:grid-cols-2">
        {/* ── Panel trái: thương hiệu + preview lịch tuần ───────── */}
        <div className="relative hidden flex-col justify-between border-r border-white/10 bg-gradient-to-b from-[#FF6B3512] to-transparent p-9 md:flex">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black tracking-tight text-[#FF6B35]">FPT</span>
              <span className="text-2xl font-black tracking-tight text-white">TIME</span>
            </div>
            <div className="mt-1 text-[9px] uppercase tracking-[3px] text-white/30">
              Management Toolkit
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-white/40">
                Tuần 3 · Lịch học
              </span>
              <span className="rounded-full bg-[#FF6B3518] px-2.5 py-0.5 text-[10px] font-bold text-[#FF6B35]">
                Hiện tại
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {PREVIEW_DAYS.map((d) => (
                <div
                  key={d.day}
                  className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
                >
                  <span className="w-6 text-[11px] font-bold text-white/40">{d.day}</span>
                  <span className="flex-1 text-[12px] font-semibold text-[#e2e2f0]">
                    {d.subject}
                  </span>
                  <span className="text-[11px]">{d.mode}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-white/30">
            Quên mật khẩu không sao — chỉ mất một phút để lấy lại quyền truy cập.
          </p>
        </div>

        {/* ── Panel phải: form quên mật khẩu ─────────────────────── */}
        <div className="flex flex-col justify-center p-8 sm:p-10">
          <div className="mb-1 flex items-baseline gap-1 md:hidden">
            <span className="text-xl font-black tracking-tight text-[#FF6B35]">FPT</span>
            <span className="text-xl font-black tracking-tight text-white">TIME</span>
          </div>

          <h1 className="mt-2 text-xl font-extrabold text-white">Quên mật khẩu</h1>
          <p className="mt-1 text-[12px] leading-relaxed text-white/40">
            Nhập email đã đăng ký, chúng tôi sẽ gửi cho bạn mã OTP để đặt lại mật khẩu.
          </p>

          {status && (
            <div className="mt-4 rounded-lg border border-[#34D39930] bg-[#34D39912] px-3.5 py-2.5 text-[12px] font-medium text-[#34D399]">
              {status}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[11px] font-semibold text-white/50">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={data.email}
                onChange={(e) => setData("email", e.target.value)}
                autoComplete="username"
                placeholder="ban@fpt.edu.vn"
                autoFocus
                className="w-full rounded-lg border border-white/10 bg-[#1a1a32] px-3.5 py-2.5 text-[13px] text-[#e2e2f0] outline-none placeholder:text-white/20 focus:border-[#FF6B3560] focus:ring-1 focus:ring-[#FF6B3540]"
              />
              {errors.email && (
                <p className="mt-1.5 text-[11px] text-red-400">{errors.email}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={processing}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-[#FF6B35] px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#ff7d4d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing ? "Đang gửi..." : "Gửi mã OTP"}
            </button>
          </form>

          <p className="mt-6 text-center text-[12px] text-white/40">
            Nhớ ra mật khẩu rồi?{" "}
            <Link href="/login" className="font-semibold text-[#FF6B35] hover:text-[#ff8255]">
              Quay lại đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}