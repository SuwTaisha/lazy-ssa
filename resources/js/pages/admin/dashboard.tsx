import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, BookOpen, CheckSquare, MessageCircle, Star, TrendingUp, Users } from 'lucide-react';

const ACCENT = '#FF6B35';

interface Stats {
    totalUsers: number;
    newUsersThisWeek: number;
    totalSemesters: number;
    totalTasks: number;
    feedbackCount: number;
    feedbackAvgRating: number;
    surveyCount: number;
    surveyAvgRating: number;
    activeUsers: number;
    realUsageRate: number;
}

interface MilestoneStat {
    milestone: 'day1' | 'day7' | 'day30';
    count: number;
    avgRating: number;
}

interface RecentFeedback {
    id: number;
    rating: number;
    content: string;
    userName: string;
    createdAt: string;
}

interface RecentSurvey {
    id: number;
    milestone: 'day1' | 'day7' | 'day30';
    rating: number;
    feedback: string | null;
    userName: string;
    createdAt: string;
}

const MILESTONE_LABELS: Record<string, string> = {
    day1: '1 ngày',
    day7: '7 ngày',
    day30: '30 ngày',
};

function fmtDate(iso: string): string {
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function Stars({ value }: { value: number }) {
    return (
        <span className="whitespace-nowrap text-amber-500">
            {'★'.repeat(value)}
            <span className="text-[#19140020] dark:text-[#EDEDEC30]">{'★'.repeat(5 - value)}</span>
        </span>
    );
}

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon: React.ElementType }) {
    return (
        <div className="rounded-xl border border-[#19140018] bg-white p-4 dark:border-[#3E3E3A] dark:bg-[#141414]">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide text-[#8a8478] uppercase">{label}</span>
                <Icon size={15} style={{ color: ACCENT }} />
            </div>
            <div className="font-mono text-2xl font-bold tabular-nums">{value}</div>
            {sub && <div className="mt-1 text-xs text-[#8a8478]">{sub}</div>}
        </div>
    );
}

export default function AdminDashboard({
    stats,
    surveyByMilestone,
    recentFeedback,
    recentSurveys,
}: {
    stats: Stats;
    surveyByMilestone: MilestoneStat[];
    recentFeedback: RecentFeedback[];
    recentSurveys: RecentSurvey[];
}) {
    return (
        <>
            <Head title="Admin Dashboard" />
            <div className="min-h-screen bg-[#FDFDFC] text-[#1b1b18] dark:bg-[#0a0a0a] dark:text-[#EDEDEC]">
                <div className="mx-auto max-w-6xl px-6 py-10">
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-black tracking-tight" style={{ color: ACCENT }}>
                                    FPT
                                </span>
                                <span className="text-lg font-black tracking-tight">TIME</span>
                                <span className="ml-2 text-lg font-semibold text-[#8a8478]">Admin</span>
                            </div>
                            <p className="mt-1 text-sm text-[#8a8478]">Thống kê người dùng, đánh giá và phản hồi.</p>
                        </div>
                        <Link
                            href={route('home')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#19140030] px-3 py-1.5 text-sm font-medium hover:border-[#19140060] dark:border-[#3E3E3A] dark:hover:border-[#62605b]"
                        >
                            <ArrowLeft size={15} /> Quay lại ứng dụng
                        </Link>
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                        <StatCard label="Người dùng" value={stats.totalUsers} sub={`+${stats.newUsersThisWeek} tuần này`} icon={Users} />
                        <StatCard label="Học kỳ" value={stats.totalSemesters} icon={BookOpen} />
                        <StatCard label="Task" value={stats.totalTasks} icon={CheckSquare} />
                        <StatCard label="Phản hồi" value={stats.feedbackCount} sub={`TB ${stats.feedbackAvgRating || 0}★`} icon={MessageCircle} />
                        <StatCard label="Đánh giá mốc" value={stats.surveyCount} sub={`TB ${stats.surveyAvgRating || 0}★`} icon={Star} />
                        <StatCard
                            label="Tỉ lệ dùng thật"
                            value={`${stats.realUsageRate}%`}
                            sub={`${stats.activeUsers}/${stats.totalUsers} user có hoạt động thật`}
                            icon={TrendingUp}
                        />
                    </div>

                    {/* Milestone breakdown */}
                    <div className="mt-8">
                        <h2 className="mb-3 text-sm font-bold tracking-wide text-[#8a8478] uppercase">Đánh giá theo mốc thời gian</h2>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {surveyByMilestone.map((m) => (
                                <div
                                    key={m.milestone}
                                    className="rounded-xl border border-[#19140018] bg-white p-4 dark:border-[#3E3E3A] dark:bg-[#141414]"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold">Mốc {MILESTONE_LABELS[m.milestone]}</span>
                                        <span className="font-mono text-xs text-[#8a8478]">{m.count} lượt</span>
                                    </div>
                                    <div className="mt-2 text-2xl font-bold">
                                        {m.count > 0 ? (
                                            <>
                                                {m.avgRating} <span className="text-base font-normal text-amber-500">★</span>
                                            </>
                                        ) : (
                                            <span className="text-base font-normal text-[#8a8478]">Chưa có dữ liệu</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent feedback */}
                    <div className="mt-8">
                        <h2 className="mb-3 text-sm font-bold tracking-wide text-[#8a8478] uppercase">Phản hồi gần đây</h2>
                        <div className="overflow-x-auto rounded-xl border border-[#19140018] dark:border-[#3E3E3A]">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-[#19140018] bg-[#19140006] text-left dark:border-[#3E3E3A] dark:bg-[#EDEDEC08]">
                                        <th className="px-4 py-2 font-semibold">Người dùng</th>
                                        <th className="px-4 py-2 font-semibold">Đánh giá</th>
                                        <th className="px-4 py-2 font-semibold">Nội dung</th>
                                        <th className="px-4 py-2 font-semibold whitespace-nowrap">Thời gian</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentFeedback.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-6 text-center text-[#8a8478]">
                                                Chưa có phản hồi nào.
                                            </td>
                                        </tr>
                                    )}
                                    {recentFeedback.map((f) => (
                                        <tr key={f.id} className="border-b border-[#19140012] last:border-b-0 dark:border-[#3E3E3A66]">
                                            <td className="px-4 py-2 font-medium whitespace-nowrap">{f.userName}</td>
                                            <td className="px-4 py-2">
                                                <Stars value={f.rating} />
                                            </td>
                                            <td className="max-w-md px-4 py-2 whitespace-pre-wrap text-[#4a453f] dark:text-[#b8b2a6]">
                                                {f.content}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-[#8a8478]">{fmtDate(f.createdAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recent milestone surveys */}
                    <div className="mt-8 mb-10">
                        <h2 className="mb-3 text-sm font-bold tracking-wide text-[#8a8478] uppercase">Đánh giá mốc thời gian gần đây</h2>
                        <div className="overflow-x-auto rounded-xl border border-[#19140018] dark:border-[#3E3E3A]">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-[#19140018] bg-[#19140006] text-left dark:border-[#3E3E3A] dark:bg-[#EDEDEC08]">
                                        <th className="px-4 py-2 font-semibold">Người dùng</th>
                                        <th className="px-4 py-2 font-semibold">Mốc</th>
                                        <th className="px-4 py-2 font-semibold">Đánh giá</th>
                                        <th className="px-4 py-2 font-semibold">Góp ý</th>
                                        <th className="px-4 py-2 font-semibold whitespace-nowrap">Thời gian</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentSurveys.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-6 text-center text-[#8a8478]">
                                                Chưa có đánh giá nào.
                                            </td>
                                        </tr>
                                    )}
                                    {recentSurveys.map((s) => (
                                        <tr key={s.id} className="border-b border-[#19140012] last:border-b-0 dark:border-[#3E3E3A66]">
                                            <td className="px-4 py-2 font-medium whitespace-nowrap">{s.userName}</td>
                                            <td className="px-4 py-2 whitespace-nowrap">{MILESTONE_LABELS[s.milestone]}</td>
                                            <td className="px-4 py-2">
                                                <Stars value={s.rating} />
                                            </td>
                                            <td className="max-w-md px-4 py-2 whitespace-pre-wrap text-[#4a453f] dark:text-[#b8b2a6]">
                                                {s.feedback || <span className="text-[#8a8478] italic">(không có)</span>}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-[#8a8478]">{fmtDate(s.createdAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
