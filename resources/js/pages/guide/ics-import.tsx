import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Calendar, CalendarPlus, Upload } from 'lucide-react';

const ACCENT = '#FF6B35';

function StepShot({ src, alt }: { src: string; alt: string }) {
    return (
        <div className="mt-4 overflow-hidden rounded-xl border border-[#19140018] shadow-sm dark:border-[#3E3E3A]">
            <img src={src} alt={alt} className="block w-full" loading="lazy" />
        </div>
    );
}

function UiChip({ children, tone = 'outline' }: { children: React.ReactNode; tone?: 'solid' | 'outline' }) {
    return (
        <span
            className={
                tone === 'solid'
                    ? 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[13px] font-semibold text-white'
                    : 'inline-flex items-center gap-1.5 rounded-lg border border-[#19140030] px-3 py-1.5 font-mono text-[13px] font-semibold text-[#1b1b18] dark:border-[#3E3E3A] dark:text-[#EDEDEC]'
            }
            style={tone === 'solid' ? { background: ACCENT } : undefined}
        >
            {children}
        </span>
    );
}

function Step({ n, title, children, accent = ACCENT }: { n: number; title: string; children: React.ReactNode; accent?: string }) {
    return (
        <div className="flex gap-4 border-b border-[#19140012] py-6 last:border-b-0 dark:border-[#3E3E3A66]">
            <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border font-mono text-sm font-bold"
                style={{ borderColor: accent + '55', color: accent }}
            >
                {n}
            </div>
            <div className="min-w-0 flex-1">
                <h3 className="mb-2 text-base font-bold text-[#1b1b18] dark:text-[#EDEDEC]">{title}</h3>
                <div className="space-y-3 text-[15px] leading-relaxed text-[#4a453f] dark:text-[#b8b2a6]">{children}</div>
            </div>
        </div>
    );
}

export default function IcsImportGuide() {
    return (
        <>
            <Head title="Hướng dẫn nhập lịch từ FAP" />
            <div className="min-h-screen bg-[#FDFDFC] text-[#1b1b18] dark:bg-[#0a0a0a] dark:text-[#EDEDEC]">
                <div className="mx-auto max-w-3xl px-6 py-10 lg:py-16">
                    {/* Top bar */}
                    <div className="mb-10 flex items-center justify-between">
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black tracking-tight" style={{ color: ACCENT }}>
                                FPT
                            </span>
                            <span className="text-lg font-black tracking-tight">TIME</span>
                        </div>
                        <Link
                            href={route('home')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#19140030] px-3 py-1.5 text-sm font-medium hover:border-[#19140060] dark:border-[#3E3E3A] dark:hover:border-[#62605b]"
                        >
                            <ArrowLeft size={15} /> Quay lại ứng dụng
                        </Link>
                    </div>

                    {/* Hero */}
                    <p className="mb-2 font-mono text-xs font-semibold tracking-widest uppercase" style={{ color: ACCENT }}>
                        Hướng dẫn đồng bộ lịch
                    </p>
                    <h1 className="mb-4 text-3xl leading-tight font-extrabold text-balance lg:text-4xl">
                        Đưa lịch học và lịch thi từ FAP vào FPT Time
                    </h1>
                    <p className="max-w-[62ch] text-[17px] leading-relaxed text-[#4a453f] dark:text-[#b8b2a6]">
                        FAP không cho tải lịch trực tiếp ra file, nên bước đầu tiên là dùng extension Chrome{' '}
                        <strong className="text-[#1b1b18] dark:text-[#EDEDEC]">FPTU Schedule</strong> để xuất lịch ra file{' '}
                        <code className="rounded bg-[#19140012] px-1.5 py-0.5 font-mono text-[15px] dark:bg-[#EDEDEC1a]">.ics</code>, rồi nhập file đó
                        vào đúng hai chỗ trong FPT Time.
                    </p>

                    {/* Overview map */}
                    <div className="mt-10 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
                        <div className="rounded-xl border border-[#19140018] bg-[#19140006] p-5 dark:border-[#3E3E3A] dark:bg-[#EDEDEC08]">
                            <div className="font-mono text-[11px] font-bold tracking-wide uppercase" style={{ color: ACCENT }}>
                                Giai đoạn 1
                            </div>
                            <h3 className="mt-1 mb-1 font-bold">Lấy file .ics từ FAP</h3>
                            <p className="text-sm text-[#4a453f] dark:text-[#b8b2a6]">
                                Cài extension, đồng bộ rồi tải 2 file: lịch học và lịch thi.
                            </p>
                        </div>
                        <div className="flex items-center justify-center text-[#4a453f] sm:rotate-0 dark:text-[#8a8478]">
                            <ArrowRight size={20} className="rotate-90 sm:rotate-0" />
                        </div>
                        <div className="rounded-xl border border-blue-600/20 bg-blue-600/5 p-5 dark:border-blue-400/25 dark:bg-blue-400/10">
                            <div className="font-mono text-[11px] font-bold tracking-wide text-blue-600 uppercase dark:text-blue-400">
                                Giai đoạn 2
                            </div>
                            <h3 className="mt-1 mb-1 font-bold">Nhập vào FPT Time</h3>
                            <p className="text-sm text-[#4a453f] dark:text-[#b8b2a6]">
                                Mở đúng modal tương ứng trong app, nhập từng file .ics vào đúng chỗ.
                            </p>
                        </div>
                    </div>

                    {/* Phase 1 */}
                    <section className="mt-16">
                        <div className="mb-6 flex items-baseline gap-3 border-b-2 border-[#19140018] pb-3 dark:border-[#3E3E3A]">
                            <span
                                className="rounded-full border px-2.5 py-1 font-mono text-xs font-bold tracking-wide uppercase"
                                style={{ borderColor: ACCENT + '55', color: ACCENT, background: ACCENT + '14' }}
                            >
                                Giai đoạn 1
                            </span>
                            <h2 className="text-xl font-bold lg:text-2xl">Lấy file .ics từ FAP</h2>
                        </div>

                        <Step n={1} title={'Cài extension "FPTU Schedule"'}>
                            <p>Extension này của cộng đồng (không phải FPT làm), đăng nhập giúp bạn vào FAP và xuất lịch ra file .ics chuẩn.</p>
                            <a
                                href="https://chromewebstore.google.com/detail/fptu-schedule/obiiippodjlfcmdipfbkneknbakjekfm"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white"
                                style={{ background: ACCENT }}
                            >
                                Mở trên Chrome Web Store
                            </a>
                            <p>
                                Bấm <UiChip tone="solid">Add to Chrome</UiChip> ở góc trên bên phải trang.
                            </p>
                            <StepShot src="/images/guide/step1-chrome-store.png" alt="Trang Chrome Web Store của extension FPTU Schedule, nút Add to Chrome ở góc trên bên phải" />
                        </Step>

                        <Step n={2} title="Đồng bộ lịch học">
                            <p>
                                Bấm biểu tượng extension trên thanh Chrome, chọn tab <UiChip>📖 Lịch học</UiChip>, rồi bấm{' '}
                                <UiChip tone="solid">⟳ Đồng bộ lịch học</UiChip>.
                            </p>
                            <p>
                                Lần đầu extension sẽ mở FAP để bạn đăng nhập bằng tài khoản sinh viên — đăng nhập xong nó tự lấy lịch về. Sau khi
                                lịch hiện ra, bấm <UiChip tone="solid">⬇ Tải lịch</UiChip> để tải file <code>.ics</code> về máy (thư mục Downloads).
                            </p>
                            <StepShot src="/images/guide/step2-sync-lich-hoc.png" alt="Popup extension FPTU Schedule ở tab Lịch học, nút Đồng bộ lịch học" />
                        </Step>

                        <Step n={3} title="Đồng bộ lịch thi">
                            <p>
                                Chuyển sang tab <UiChip>📄 Kỳ thi</UiChip> ngay trong extension, bấm <UiChip tone="solid">⟳ Đồng bộ lịch thi</UiChip>,
                                rồi <UiChip tone="solid">⬇ Tải lịch</UiChip> như bước trên.
                            </p>
                            <p>
                                Bạn sẽ có <strong className="text-[#1b1b18] dark:text-[#EDEDEC]">2 file .ics riêng biệt</strong> — một cho lịch học,
                                một cho lịch thi. Đừng nhầm hai file khi nhập ở giai đoạn 2.
                            </p>
                            <StepShot src="/images/guide/step3-sync-lich-thi.png" alt="Popup extension FPTU Schedule ở tab Kỳ thi, nút Đồng bộ lịch thi" />
                        </Step>
                    </section>

                    {/* Phase 2 */}
                    <section className="mt-14">
                        <div className="mb-6 flex items-baseline gap-3 border-b-2 border-[#19140018] pb-3 dark:border-[#3E3E3A]">
                            <span className="rounded-full border border-blue-600/40 bg-blue-600/10 px-2.5 py-1 font-mono text-xs font-bold tracking-wide text-blue-600 uppercase dark:border-blue-400/40 dark:bg-blue-400/10 dark:text-blue-400">
                                Giai đoạn 2
                            </span>
                            <h2 className="text-xl font-bold lg:text-2xl">Nhập file .ics vào FPT Time</h2>
                        </div>

                        <Step n={1} title="Nhập lịch học" accent="#3d6bff">
                            <p>
                                Trong FPT Time: vào <UiChip>Cài đặt</UiChip> → <UiChip>Lịch học theo ngày</UiChip>. Ở đầu danh sách môn học có nút{' '}
                                <UiChip>
                                    <Upload size={12} /> Nhập file .ics
                                </UiChip>
                                .
                            </p>
                            <p>
                                Chọn đúng file lịch <strong className="text-[#1b1b18] dark:text-[#EDEDEC]">học</strong> vừa tải ở bước trước. Hệ
                                thống tự xếp từng buổi học vào đúng môn, đúng ngày.
                            </p>
                            <StepShot src="/images/guide/step4-import-app.png" alt="Modal Lịch Học Theo Ngày trong FPT Time, nút Nhập file .ics" />
                        </Step>

                        <Step n={2} title="Nhập lịch thi" accent="#3d6bff">
                            <p>
                                Vào tab <UiChip>Lịch</UiChip>, lướt đến đúng tuần thi, bấm <UiChip>✏️ Sửa</UiChip> trên banner "TUẦN THI" để mở modal{' '}
                                <UiChip>Lịch Thi</UiChip> — trong đó cũng có nút{' '}
                                <UiChip>
                                    <Upload size={12} /> Nhập file .ics
                                </UiChip>
                                .
                            </p>
                            <p>
                                Lần này chọn file lịch <strong className="text-[#1b1b18] dark:text-[#EDEDEC]">thi</strong> — đừng đưa nhầm file lịch
                                học vào đây.
                            </p>
                        </Step>

                        <div className="mt-2 flex gap-3 rounded-xl border border-[#19140018] bg-[#19140006] p-4 text-sm text-[#4a453f] dark:border-[#3E3E3A] dark:bg-[#EDEDEC08] dark:text-[#b8b2a6]">
                            <CalendarPlus size={18} className="mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
                            <p>
                                Nhập lại một file .ics mới sẽ <strong className="text-[#1b1b18] dark:text-[#EDEDEC]">cập nhật</strong> đúng những buổi
                                có trong file đó, không xoá dữ liệu bạn đã tự thêm tay ở những ngày khác.
                            </p>
                        </div>
                    </section>

                    {/* FAQ */}
                    <section className="mt-16">
                        <h2 className="mb-5 text-xl font-bold">Vướng ở đâu?</h2>
                        <dl className="divide-y divide-[#19140012] dark:divide-[#3E3E3A66]">
                            <div className="py-4">
                                <dt className="mb-1 font-bold">Extension không đăng nhập được vào FAP?</dt>
                                <dd className="max-w-[62ch] text-sm text-[#4a453f] dark:text-[#b8b2a6]">
                                    Đăng nhập tay vào fap.fpt.edu.vn trên cùng trình duyệt trước, sau đó quay lại bấm "Đồng bộ" trong extension.
                                </dd>
                            </div>
                            <div className="py-4">
                                <dt className="mb-1 font-bold">Nhập file xong nhưng lịch hiện sai ngày?</dt>
                                <dd className="max-w-[62ch] text-sm text-[#4a453f] dark:text-[#b8b2a6]">
                                    Kiểm tra lại "Ngày bắt đầu học kỳ" trong Cài đặt của FPT Time — ngày này phải đúng Thứ 2 của tuần học đầu tiên
                                    thì lịch mới xếp đúng tuần.
                                </dd>
                            </div>
                            <div className="py-4">
                                <dt className="mb-1 font-bold">Nhập nhầm file lịch học vào ô lịch thi (hoặc ngược lại)?</dt>
                                <dd className="max-w-[62ch] text-sm text-[#4a453f] dark:text-[#b8b2a6]">
                                    Mở đúng modal, nhập lại đúng file — dữ liệu cũ của các buổi trùng ngày sẽ được ghi đè bằng dữ liệu đúng.
                                </dd>
                            </div>
                        </dl>
                    </section>

                    {/* Footer */}
                    <footer className="mt-16 flex flex-col gap-2 border-t border-[#19140012] pt-6 text-xs text-[#8a8478] sm:flex-row sm:items-center sm:justify-between dark:border-[#3E3E3A66]">
                        <span className="flex items-center gap-1.5">
                            <Calendar size={13} /> FPT Time · hướng dẫn nội bộ cho sinh viên
                        </span>
                        <span>Extension "FPTU Schedule" do cộng đồng phát triển, không phải sản phẩm chính thức của FPT.</span>
                    </footer>
                </div>
            </div>
        </>
    );
}
