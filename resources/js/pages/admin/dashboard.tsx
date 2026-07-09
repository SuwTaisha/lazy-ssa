import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, BookOpen, CheckSquare, MessageCircle, Star, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';

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

interface RatingDistributionItem {
    rating: number;
    count: number;
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

interface UserRow {
    id: number;
    name: string;
    email: string;
    isAdmin: boolean;
    isActive: boolean;
    createdAt: string;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedUsers {
    data: UserRow[];
    links: PaginationLink[];
    current_page: number;
    last_page: number;
    total: number;
}

const HOVER_CARD =
    'transition-all duration-150 hover:-translate-y-0.5 hover:border-[#FF6B3560] hover:shadow-md dark:hover:border-[#FF6B3560]';

const MILESTONE_LABELS: Record<string, string> = {
    day1: '1 ngày',
    day7: '7 ngày',
    day30: '30 ngày',
};

const NAV_ITEMS = [
    { key: 'stats', label: 'Thống kê', icon: TrendingUp },
    { key: 'users', label: 'Người dùng', icon: Users },
    { key: 'feedback', label: 'Đánh giá & Feedback', icon: MessageCircle },
] as const;

type SectionKey = (typeof NAV_ITEMS)[number]['key'];

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
        <div className={`rounded-xl border border-[#19140018] bg-white p-4 dark:border-[#3E3E3A] dark:bg-[#141414] ${HOVER_CARD}`}>
            <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide text-[#8a8478] uppercase">{label}</span>
                <Icon size={15} style={{ color: ACCENT }} />
            </div>
            <div className="font-mono text-2xl font-bold tabular-nums">{value}</div>
            {sub && <div className="mt-1 text-xs text-[#8a8478]">{sub}</div>}
        </div>
    );
}

function PieChart({ data, size = 140 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    let cursor = 0;
    const stops = data.map((d) => {
        const pct = total > 0 ? (d.value / total) * 100 : 0;
        const slice = `${d.color} ${cursor}% ${cursor + pct}%`;
        cursor += pct;
        return slice;
    });
    const background = total > 0 ? `conic-gradient(${stops.join(', ')})` : '#19140012';

    return (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="shrink-0 rounded-full" style={{ width: size, height: size, background }} />
            <ul className="flex w-full flex-col gap-1.5 text-sm sm:flex-1">
                {data.map((d) => {
                    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                    return (
                        <li key={d.label} className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                            <span className="truncate text-[#4a453f] dark:text-[#b8b2a6]">{d.label}</span>
                            <span className="ml-auto shrink-0 font-mono text-xs text-[#8a8478]">
                                {d.value} ({pct}%)
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function StatsSection({
    stats,
    surveyByMilestone,
    ratingDistribution,
}: {
    stats: Stats;
    surveyByMilestone: MilestoneStat[];
    ratingDistribution: RatingDistributionItem[];
}) {
    const RATING_COLORS: Record<number, string> = {
        1: '#ef4444',
        2: '#f97316',
        3: '#eab308',
        4: '#84cc16',
        5: '#22c55e',
    };
    const MILESTONE_COLORS: Record<string, string> = {
        day1: '#FF6B35',
        day7: '#00C6FF',
        day30: '#A78BFA',
    };

    return (
        <div>
            <h1 className="mb-1 text-xl font-bold">Thống kê</h1>
            <p className="mb-6 text-sm text-[#8a8478]">Tổng quan người dùng, đánh giá và mức độ dùng thật.</p>

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

            <div className="mt-8">
                <h2 className="mb-3 text-sm font-bold tracking-wide text-[#8a8478] uppercase">Đánh giá theo mốc thời gian</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {surveyByMilestone.map((m) => (
                        <div
                            key={m.milestone}
                            className={`rounded-xl border border-[#19140018] bg-white p-4 dark:border-[#3E3E3A] dark:bg-[#141414] ${HOVER_CARD}`}
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

            <div className="mt-8">
                <h2 className="mb-3 text-sm font-bold tracking-wide text-[#8a8478] uppercase">Biểu đồ tròn</h2>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <div className={`rounded-xl border border-[#19140018] bg-white p-4 dark:border-[#3E3E3A] dark:bg-[#141414] ${HOVER_CARD}`}>
                        <div className="mb-3 text-sm font-semibold">Tỉ lệ dùng thật</div>
                        <PieChart
                            data={[
                                { label: 'Dùng thật', value: stats.activeUsers, color: '#22c55e' },
                                { label: 'Chưa hoạt động', value: stats.totalUsers - stats.activeUsers, color: '#19140020' },
                            ]}
                        />
                    </div>

                    <div className={`rounded-xl border border-[#19140018] bg-white p-4 dark:border-[#3E3E3A] dark:bg-[#141414] ${HOVER_CARD}`}>
                        <div className="mb-3 text-sm font-semibold">Phân bố đánh giá theo mốc</div>
                        <PieChart
                            data={surveyByMilestone.map((m) => ({
                                label: `Mốc ${MILESTONE_LABELS[m.milestone]}`,
                                value: m.count,
                                color: MILESTONE_COLORS[m.milestone],
                            }))}
                        />
                    </div>

                    <div className={`rounded-xl border border-[#19140018] bg-white p-4 dark:border-[#3E3E3A] dark:bg-[#141414] ${HOVER_CARD}`}>
                        <div className="mb-3 text-sm font-semibold">Phân bố số sao đánh giá</div>
                        <PieChart
                            data={ratingDistribution.map((r) => ({
                                label: `${r.rating}★`,
                                value: r.count,
                                color: RATING_COLORS[r.rating],
                            }))}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function UsersSection({ users }: { users: PaginatedUsers }) {
    return (
        <div>
            <h1 className="mb-1 text-xl font-bold">Người dùng</h1>
            <p className="mb-6 text-sm text-[#8a8478]">Tổng {users.total} người dùng đã đăng ký.</p>

            <div className="overflow-x-auto rounded-xl border border-[#19140018] dark:border-[#3E3E3A]">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="border-b border-[#19140018] bg-[#19140006] text-left dark:border-[#3E3E3A] dark:bg-[#EDEDEC08]">
                            <th className="px-4 py-2 font-semibold">Tên</th>
                            <th className="px-4 py-2 font-semibold">Email</th>
                            <th className="px-4 py-2 font-semibold">Trạng thái</th>
                            <th className="px-4 py-2 font-semibold">Quyền</th>
                            <th className="px-4 py-2 font-semibold whitespace-nowrap">Ngày tham gia</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.data.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-6 text-center text-[#8a8478]">
                                    Chưa có người dùng nào.
                                </td>
                            </tr>
                        )}
                        {users.data.map((u) => (
                            <tr
                                key={u.id}
                                className="border-b border-[#19140012] transition-colors last:border-b-0 hover:bg-[#19140006] dark:border-[#3E3E3A66] dark:hover:bg-[#EDEDEC08]"
                            >
                                <td className="px-4 py-2 font-medium whitespace-nowrap">{u.name}</td>
                                <td className="px-4 py-2 text-[#4a453f] dark:text-[#b8b2a6]">{u.email}</td>
                                <td className="px-4 py-2">
                                    {u.isActive ? (
                                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                            Dùng thật
                                        </span>
                                    ) : (
                                        <span className="rounded-full bg-[#19140010] px-2 py-0.5 text-xs font-medium text-[#8a8478] dark:bg-[#EDEDEC10]">
                                            Chưa hoạt động
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-2">
                                    {u.isAdmin && (
                                        <span
                                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                                            style={{ backgroundColor: `${ACCENT}18`, color: ACCENT }}
                                        >
                                            Admin
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-[#8a8478]">{fmtDate(u.createdAt)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {users.last_page > 1 && (
                <div className="mt-4 flex flex-wrap gap-1">
                    {users.links.map((link, i) =>
                        link.url ? (
                            <Link
                                key={i}
                                href={link.url}
                                only={['users']}
                                preserveState
                                preserveScroll
                                className={`cursor-pointer rounded-md px-3 py-1.5 text-sm ${
                                    link.active
                                        ? 'bg-[#FF6B35] text-white'
                                        : 'border border-[#19140018] hover:bg-[#19140008] dark:border-[#3E3E3A] dark:hover:bg-[#EDEDEC08]'
                                }`}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ) : (
                            <span
                                key={i}
                                className="rounded-md px-3 py-1.5 text-sm text-[#8a8478]/50"
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ),
                    )}
                </div>
            )}
        </div>
    );
}

function FeedbackSection({ recentFeedback, recentSurveys }: { recentFeedback: RecentFeedback[]; recentSurveys: RecentSurvey[] }) {
    return (
        <div>
            <h1 className="mb-1 text-xl font-bold">Đánh giá & Feedback</h1>
            <p className="mb-6 text-sm text-[#8a8478]">Phản hồi tự do và đánh giá theo mốc thời gian gần đây.</p>

            <div>
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
                                <tr
                                    key={f.id}
                                    className="border-b border-[#19140012] transition-colors last:border-b-0 hover:bg-[#19140006] dark:border-[#3E3E3A66] dark:hover:bg-[#EDEDEC08]"
                                >
                                    <td className="px-4 py-2 font-medium whitespace-nowrap">{f.userName}</td>
                                    <td className="px-4 py-2">
                                        <Stars value={f.rating} />
                                    </td>
                                    <td className="max-w-md px-4 py-2 whitespace-pre-wrap text-[#4a453f] dark:text-[#b8b2a6]">{f.content}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-[#8a8478]">{fmtDate(f.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-8">
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
                                <tr
                                    key={s.id}
                                    className="border-b border-[#19140012] transition-colors last:border-b-0 hover:bg-[#19140006] dark:border-[#3E3E3A66] dark:hover:bg-[#EDEDEC08]"
                                >
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
    );
}

export default function AdminDashboard({
    stats,
    surveyByMilestone,
    ratingDistribution,
    recentFeedback,
    recentSurveys,
    users,
}: {
    stats: Stats;
    surveyByMilestone: MilestoneStat[];
    ratingDistribution: RatingDistributionItem[];
    recentFeedback: RecentFeedback[];
    recentSurveys: RecentSurvey[];
    users: PaginatedUsers;
}) {
    const [section, setSection] = useState<SectionKey>('stats');

    return (
        <>
            <Head title="Admin Dashboard" />
            <div className="flex min-h-screen flex-col bg-[#FDFDFC] text-[#1b1b18] sm:flex-row dark:bg-[#0a0a0a] dark:text-[#EDEDEC]">
                <aside className="flex w-full shrink-0 flex-col border-b border-[#19140018] px-4 py-4 sm:w-56 sm:border-r sm:border-b-0 sm:py-6 dark:border-[#3E3E3A]">
                    <div className="mb-3 flex items-center justify-between px-2 sm:mb-8 sm:block">
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black tracking-tight" style={{ color: ACCENT }}>
                                FPT
                            </span>
                            <span className="text-lg font-black tracking-tight">TIME</span>
                            <span className="ml-2 text-sm font-semibold text-[#8a8478]">Admin</span>
                        </div>

                        <Link
                            href={route('home')}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#19140030] px-2 py-1 text-xs font-medium hover:border-[#19140060] sm:hidden dark:border-[#3E3E3A] dark:hover:border-[#62605b]"
                        >
                            <ArrowLeft size={13} /> Quay lại
                        </Link>
                    </div>

                    <nav className="flex gap-1 overflow-x-auto sm:flex-col">
                        {NAV_ITEMS.map((item) => {
                            const ItemIcon = item.icon;
                            const active = section === item.key;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setSection(item.key)}
                                    className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors ${
                                        active
                                            ? 'bg-[#FF6B3518] text-[#FF6B35]'
                                            : 'text-[#4a453f] hover:bg-[#19140008] dark:text-[#b8b2a6] dark:hover:bg-[#EDEDEC08]'
                                    }`}
                                >
                                    <ItemIcon size={16} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>

                    <Link
                        href={route('home')}
                        className="mt-auto hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#8a8478] transition-colors hover:bg-[#19140008] hover:text-[#1b1b18] sm:flex dark:hover:bg-[#EDEDEC08] dark:hover:text-[#EDEDEC]"
                    >
                        <ArrowLeft size={15} /> Quay lại ứng dụng
                    </Link>
                </aside>

                <div className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
                    <div className="mx-auto max-w-5xl">
                        {section === 'stats' && (
                            <StatsSection stats={stats} surveyByMilestone={surveyByMilestone} ratingDistribution={ratingDistribution} />
                        )}
                        {section === 'users' && <UsersSection users={users} />}
                        {section === 'feedback' && <FeedbackSection recentFeedback={recentFeedback} recentSurveys={recentSurveys} />}
                    </div>
                </div>
            </div>
        </>
    );
}
