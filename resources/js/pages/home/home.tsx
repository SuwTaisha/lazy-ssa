'use client';

import type { FormDataConvertible } from '@inertiajs/core';
import { Link, router, usePage } from '@inertiajs/react';
import React, { CSSProperties, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useAppearance } from '@/hooks/use-appearance';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import viLocale from '@fullcalendar/core/locales/vi';

// Inertia's router.put/post yêu cầu payload thoả FormDataConvertible (index signature).
// Các type của app (Subject[], Schedule, OnlineDays, ExamData) đã có shape cụ thể nên
// TypeScript không tự suy ra được — ép kiểu tường minh ở nơi gọi thay vì nới lỏng interface.
function asFormData<T extends Record<string, unknown>>(data: T): Record<string, FormDataConvertible> {
    return data as unknown as Record<string, FormDataConvertible>;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface Subject {
    id: string; // = subjects.code trong DB, không phải PK số
    name: string;
    full: string;
    color: string;
}

type Schedule = Record<number, string[]>; // day (1-5) -> subject codes
type OnlineDays = Record<number, number[]>; // week -> days online

interface DatedScheduleItem {
    code: string;
    startTime: string | null;
    endTime: string | null;
    slotOrder: number;
    isOnline: boolean | null;
}
type ScheduleByDate = Record<string, DatedScheduleItem[]>; // 'YYYY-MM-DD' -> subjects học ngày đó

interface ScheduleSession {
    classDate: string;
    slot: number;
    isOnline: boolean;
}
type ScheduleSlotsBySubject = Record<string, ScheduleSession[]>; // subjectCode -> toàn bộ buổi học (kể cả quá khứ)

// Khung giờ chuẩn theo slot của FPT — đúng theo ScheduleSlotController::SLOT_TIMES ở backend,
// chỉ để hiển thị (giờ thật do backend tính, không tin giờ client tự gửi lên).
const SLOT_TIMES: Record<number, [string, string]> = {
    1: ['07:00', '09:15'],
    2: ['09:30', '11:45'],
    3: ['12:30', '14:45'],
    4: ['15:00', '17:15'],
    5: ['17:30', '19:45'],
};

interface Task {
    id: number;
    subject: string; // subject code, "" nếu không gắn môn
    text: string;
    deadline: string;
    done: boolean;
    createdAt: string;
}

type Notes = Record<string, string>; // subjectCode -> note text

interface FeedbackItem {
    id: number;
    rating: number;
    content: string;
    createdAt: string;
}

interface ExamEntry {
    date?: string;
    time?: string;
    room?: string;
    type?: string;
}
type ExamData = Record<string, ExamEntry>; // `w{week}_{code}` -> entry

type ModalState = string | null;
type TabId = 'schedule' | 'tasks' | 'notes' | 'settings';

interface PageProps {
    auth: {
        user: { id: number; name: string; email: string } | null;
    };
    semesterId?: number;
    semStart: string;
    subjects: Subject[];
    schedule: Schedule;
    scheduleByDate: ScheduleByDate;
    scheduleSlotsBySubject: ScheduleSlotsBySubject;
    onlineDays: OnlineDays;
    tasks: Task[];
    notes: Notes;
    examData: ExamData;
    examWeeksCount: number;
    feedback: FeedbackItem[];
    isDemo: boolean;
    vapidPublicKey: string | null;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS & HELPERS
// ═══════════════════════════════════════════════════════════════════

const PRESET_COLORS = [
    '#FF6B35',
    '#00C6FF',
    '#A78BFA',
    '#34D399',
    '#FBBF24',
    '#F472B6',
    '#FB923C',
    '#38BDF8',
    '#4ADE80',
    '#E879F9',
    '#F87171',
    '#60A5FA',
    '#A3E635',
    '#FDE68A',
    '#6EE7B7',
];

const DAY_NAMES: Record<number, string> = { 1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6' };
const STUDY_WEEKS = 7;
// Số tuần thi không còn cố định = 2 nữa — import lịch thi thật có thể trải dài hơn,
// nên tổng số tuần (TOTAL_WEEKS = STUDY_WEEKS + examWeeksCount) được tính động từ server.

// "YYYY-MM-DD" phải được parse theo giờ local, không phải qua new Date(str) (bị hiểu
// là UTC nên có thể lùi/tới 1 ngày tuỳ múi giờ trình duyệt, làm lệch ngày hiển thị).
function parseLocalDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}
function getWeekMonday(semStart: string, weekNum: number): Date {
    const d = parseLocalDate(semStart);
    d.setDate(d.getDate() + (weekNum - 1) * 7);
    return d;
}
function getDayDate(monday: Date, dow: number): Date {
    const d = new Date(monday);
    d.setDate(d.getDate() + dow - 1);
    return d;
}
function toISODate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDMY(d: Date): string {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function hexToRgba(hex: string, alpha: number): string {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function isToday(d: Date): boolean {
    const n = new Date();
    return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}
// Web Push cần applicationServerKey dạng Uint8Array, còn VAPID public key server trả về
// là base64url string -> phải tự decode, trình duyệt không có helper sẵn cho việc này.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function fmtCountdown(ms: number): string {
    if (ms <= 0) return 'Đã quá hạn';
    const totalSec = Math.floor(ms / 1000);
    const s = totalSec % 60;
    const m = Math.floor(totalSec / 60) % 60;
    const h = Math.floor(totalSec / 3600) % 24;
    const d = Math.floor(totalSec / 86400);
    if (d > 0) return `${d}n ${h}g ${m}p`;
    if (h > 0) return `${h}g ${m}p ${s}s`;
    return `${m}p ${s}s`;
}

// ═══════════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function Home() {
    const {
        auth,
        semesterId,
        semStart,
        subjects,
        schedule,
        scheduleByDate,
        scheduleSlotsBySubject,
        onlineDays,
        tasks,
        notes,
        examData,
        examWeeksCount,
        feedback,
        isDemo,
        vapidPublicKey,
    } = usePage<PageProps>().props;
    const user = auth.user;
    const totalWeeks = STUDY_WEEKS + examWeeksCount;

    const [tab, setTab] = useState<TabId>('schedule');
    const [weekView, setWeekView] = useState<number>(1);
    const [toast, setToast] = useState<string | null>(null);
    const [bellOpen, setBellOpen] = useState<boolean>(false);
    const [bellAnim, setBellAnim] = useState<boolean>(false);
    const [modal, setModal] = useState<ModalState>(null);
    const [showPushBanner, setShowPushBanner] = useState<boolean>(false);
    const [subscribing, setSubscribing] = useState<boolean>(false);

    // Tái sử dụng hệ theme có sẵn của app (localStorage['appearance'], class .dark trên
    // <html>, đã được initializeTheme() áp dụng đúng trước khi React mount) thay vì tự
    // dựng cơ chế theme riêng cho mỗi trang.
    const { updateAppearance } = useAppearance();
    const [isDark, setIsDark] = useState(true);
    useLayoutEffect(() => {
        setIsDark(document.documentElement.classList.contains('dark'));
    }, []);
    const toggleTheme = () => {
        const next = isDark ? 'light' : 'dark';
        updateAppearance(next);
        setIsDark(!isDark);
    };

    const currentWeek = useMemo(() => {
        const start = parseLocalDate(semStart);
        start.setHours(0, 0, 0, 0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const diff = Math.floor((now.getTime() - start.getTime()) / (7 * 86400000)) + 1;
        return Math.max(1, Math.min(totalWeeks, diff));
    }, [semStart, totalWeeks]);

    useEffect(() => {
        setWeekView(currentWeek);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentWeek]);

    const subjectMap = useMemo(() => {
        const m: Record<string, Subject> = {};
        subjects.forEach((s) => {
            m[s.id] = s;
        });
        return m;
    }, [subjects]);

    const pendingTasks = tasks.filter((t) => !t.done);
    const urgentTasks = pendingTasks.filter((t) => {
        if (!t.deadline) return false;
        const ms = new Date(t.deadline).getTime() - new Date().getTime();
        return ms > 0 && ms < 86400000;
    });

    useEffect(() => {
        if (urgentTasks.length > 0) {
            setBellAnim(true);
            const timer = setTimeout(() => setBellAnim(false), 600);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urgentTasks.length]);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2800);
    };

    // Chỉ gợi ý bật thông báo cho user thật (không phải demo), khi trình duyệt hỗ trợ
    // Push, chưa từng được cấp/từ chối quyền, và chưa bị người dùng đóng banner trước đó.
    useEffect(() => {
        if (isDemo || !vapidPublicKey) return;
        if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
        if (Notification.permission !== 'default') return;
        if (localStorage.getItem('pushBannerDismissed') === '1') return;
        setShowPushBanner(true);
    }, [isDemo, vapidPublicKey]);

    const dismissPushBanner = () => {
        localStorage.setItem('pushBannerDismissed', '1');
        setShowPushBanner(false);
    };

    const enablePush = async () => {
        if (!vapidPublicKey) return;
        setSubscribing(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                showToast('🔕 Bạn đã từ chối quyền thông báo');
                return;
            }
            const registration = await navigator.serviceWorker.register('/sw.js');
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
            });
            const json = subscription.toJSON();
            router.post(
                '/webpush/subscribe',
                {
                    endpoint: json.endpoint,
                    keys: json.keys,
                    contentEncoding: PushManager.supportedContentEncodings?.[0] ?? 'aesgcm',
                },
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => showToast('🔔 Đã bật thông báo nhắc deadline!'),
                    onError: () => showToast('❌ Không thể bật thông báo'),
                }
            );
        } catch {
            showToast('❌ Không thể bật thông báo');
        } finally {
            setSubscribing(false);
            setShowPushBanner(false);
            localStorage.setItem('pushBannerDismissed', '1');
        }
    };

    // Chặn mọi hành động ghi khi là demo (chưa đăng nhập) -> đẩy sang trang login
    const requireAuth = (): boolean => {
        if (isDemo) {
            showToast('🔐 Đăng nhập để lưu thay đổi của bạn');
            router.visit('/login');
            return false;
        }
        return true;
    };

    const openModal = (id: string) => {
        if (isDemo) {
            showToast('🔐 Đăng nhập để chỉnh sửa');
            return;
        }
        setModal(id);
    };
    const closeModal = () => setModal(null);

    return (
        <div style={css.root}>
            <style>{globalCss}</style>
            <div style={css.bgDots} />

            <Header
                currentWeek={currentWeek}
                urgentCount={urgentTasks.length}
                bellAnim={bellAnim}
                bellOpen={bellOpen}
                setBellOpen={setBellOpen}
                pendingTasks={pendingTasks}
                user={user}
                isDemo={isDemo}
                isDark={isDark}
                toggleTheme={toggleTheme}
            />

            <BottomNav tab={tab} setTab={setTab} pendingCount={pendingTasks.length} />

            {isDemo && (
                <div style={css.demoBanner}>
                    🔎 Bạn đang xem <strong>dữ liệu demo</strong>.{' '}
                    <Link href="/login" style={{ color: '#FF6B35', fontWeight: 700 }}>
                        Đăng nhập
                    </Link>{' '}
                    để dùng lịch học của riêng bạn.
                </div>
            )}

            {showPushBanner && (
                <div style={{ ...css.demoBanner, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1 }}>🔔 Bật thông báo để được nhắc khi task sắp đến hạn (email + trình duyệt).</span>
                    <button
                        style={{ ...css.smallBtn, color: '#FF6B35', borderColor: '#FF6B3540', opacity: subscribing ? 0.6 : 1 }}
                        disabled={subscribing}
                        onClick={enablePush}
                    >
                        {subscribing ? 'Đang bật...' : 'Bật thông báo'}
                    </button>
                    <button style={css.smallBtn} onClick={dismissPushBanner}>
                        Bỏ qua
                    </button>
                </div>
            )}

            <main style={css.main}>
                {tab === 'schedule' && (
                    <ScheduleTab
                        semStart={semStart}
                        currentWeek={currentWeek}
                        weekView={weekView}
                        setWeekView={setWeekView}
                        totalWeeks={totalWeeks}
                        subjects={subjects}
                        subjectMap={subjectMap}
                        schedule={schedule}
                        scheduleByDate={scheduleByDate}
                        onlineDays={onlineDays}
                        examData={examData}
                        notes={notes}
                        openModal={openModal}
                    />
                )}
                {tab === 'tasks' && (
                    <TasksTab
                        tasks={tasks}
                        subjects={subjects}
                        subjectMap={subjectMap}
                        showToast={showToast}
                        requireAuth={requireAuth}
                        isDemo={isDemo}
                    />
                )}
                {tab === 'notes' && <NotesTab subjects={subjects} notes={notes} openModal={openModal} />}
                {tab === 'settings' && (
                    <SettingsTab
                        semStart={semStart}
                        semesterId={semesterId}
                        currentWeek={currentWeek}
                        totalWeeks={totalWeeks}
                        openModal={openModal}
                        showToast={showToast}
                        isDemo={isDemo}
                    />
                )}
            </main>

            {modal === 'exam' && semesterId && (
                <ExamModal
                    examData={examData}
                    subjects={subjects}
                    semesterId={semesterId}
                    examWeeksCount={examWeeksCount}
                    onClose={closeModal}
                    showToast={showToast}
                />
            )}
            {modal === 'subjects' && semesterId && (
                <SubjectsModal subjects={subjects} semesterId={semesterId} onClose={closeModal} showToast={showToast} />
            )}
            {modal === 'schedule' && semesterId && (
                <ScheduleModal
                    subjects={subjects}
                    scheduleSlotsBySubject={scheduleSlotsBySubject}
                    semesterId={semesterId}
                    onClose={closeModal}
                    showToast={showToast}
                />
            )}
            {modal === 'feedback' && <FeedbackModal feedback={feedback} onClose={closeModal} showToast={showToast} />}
            {modal && modal.startsWith('note:') && semesterId && (
                <NoteModal
                    subjectId={modal.slice(5)}
                    subjectMap={subjectMap}
                    notes={notes}
                    semesterId={semesterId}
                    onClose={closeModal}
                    showToast={showToast}
                />
            )}

            {toast && (
                <div style={css.toast} className="anim-fadeup">
                    {toast}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════════

interface HeaderProps {
    currentWeek: number;
    urgentCount: number;
    bellAnim: boolean;
    bellOpen: boolean;
    setBellOpen: React.Dispatch<React.SetStateAction<boolean>>;
    pendingTasks: Task[];
    user: { id: number; name: string; email: string } | null;
    isDemo: boolean;
    isDark: boolean;
    toggleTheme: () => void;
}

function Header({ currentWeek, urgentCount, bellAnim, bellOpen, setBellOpen, pendingTasks, user, isDark, toggleTheme }: HeaderProps) {
    const isExam = currentWeek > STUDY_WEEKS;
    const label = isExam ? `THI ${currentWeek - STUDY_WEEKS}` : `W${currentWeek}`;
    const sublabel = isExam ? 'TUẦN THI' : 'TUẦN HỌC';

    return (
        <header style={css.header}>
            <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#FF6B35', letterSpacing: -1 }}>FPT</span>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>TIME</span>
                </div>
                <div style={{ fontSize: 9, color: 'var(--home-text-faint)', letterSpacing: 2.5, textTransform: 'uppercase', marginTop: 1 }}>Management Toolkit</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {user ? (
                    <>
                        <button className="flex items-center gap-1.5 rounded-lg border border-[#34D39930] bg-[#34D39912] px-3 py-1.5 text-xs font-bold text-[#34D399]">
                            👤 {user.name}
                        </button>
                        <Link
                            href="/logout"
                            method="post"
                            as="button"
                            title="Đăng xuất"
                            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 active:scale-95"
                        >
                            🚪
                        </Link>
                    </>
                ) : (
                    <Link
                        href="/login"
                        className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-500 hover:bg-orange-500/20 active:scale-95"
                    >
                        🔐 Đăng nhập
                    </Link>
                )}

                <button style={css.iconBtn} title={isDark ? 'Giao diện sáng' : 'Giao diện tối'} onClick={toggleTheme}>
                    {isDark ? '☀️' : '🌙'}
                </button>

                <div style={{ position: 'relative' }}>
                    <button
                        className={bellAnim ? 'anim-bell' : ''}
                        style={{
                            ...css.iconBtn,
                            color: urgentCount > 0 ? '#FBBF24' : 'var(--home-text-dim)',
                            border: `1px solid ${urgentCount > 0 ? '#FBBF2430' : 'var(--home-border-strong)'}`,
                        }}
                        onClick={() => setBellOpen((o) => !o)}
                    >
                        🔔
                        {urgentCount > 0 && <span style={css.bellBadge}>{urgentCount}</span>}
                    </button>
                    {bellOpen && <BellPanel tasks={pendingTasks} onClose={() => setBellOpen(false)} />}
                </div>

                <div style={css.weekBadge}>
                    <div style={{ fontSize: 8, color: '#FF6B3580', letterSpacing: 2, textTransform: 'uppercase' }}>{sublabel}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#FF6B35', lineHeight: 1.1 }}>{label}</div>
                </div>
            </div>
        </header>
    );
}

function BellPanel({ tasks, onClose }: { tasks: Task[]; onClose: () => void }) {
    const [now, setNow] = useState<Date>(new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const withDl = [...tasks].filter((t) => t.deadline).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    const noDl = tasks.filter((t) => !t.deadline);

    return (
        <div style={css.bellPanel} className="anim-fadeup">
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--home-border)',
                }}
            >
                <span style={{ fontWeight: 700, fontSize: 13 }}>⏰ Deadline Tasks</span>
                <button style={css.closeBtn} onClick={onClose}>
                    ✕
                </button>
            </div>
            {tasks.length === 0 && <div style={{ padding: '28px 14px', textAlign: 'center', color: 'var(--home-text-faint)', fontSize: 13 }}>Không có task nào 🎉</div>}
            {withDl.map((t) => {
                const ms = new Date(t.deadline).getTime() - now.getTime();
                const over = ms <= 0;
                const warn = !over && ms < 3600000;
                const color = over ? '#EF4444' : warn ? '#FBBF24' : '#34D399';
                return (
                    <div key={t.id} style={{ padding: '9px 14px', borderBottom: '1px solid var(--home-border-faint)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: over ? '#EF4444' : 'var(--home-text)' }}>{t.text}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: 'var(--home-text-faint)' }}>{t.subject}</span>
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: 20,
                                    color,
                                    background: color + '18',
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            >
                                {fmtCountdown(ms)}
                            </span>
                        </div>
                    </div>
                );
            })}
            {noDl.length > 0 && <div style={{ padding: '7px 14px', fontSize: 11, color: 'var(--home-text-faint)' }}>+{noDl.length} task chưa có deadline</div>}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// BOTTOM NAV
// ═══════════════════════════════════════════════════════════════════

function BottomNav({ tab, setTab, pendingCount }: { tab: TabId; setTab: React.Dispatch<React.SetStateAction<TabId>>; pendingCount: number }) {
    const items: { id: TabId; icon: string; label: string; badge?: number }[] = [
        { id: 'schedule', icon: '📅', label: 'Lịch' },
        { id: 'tasks', icon: '✅', label: 'Task', badge: pendingCount },
        { id: 'notes', icon: '📝', label: 'Ghi chú' },
        { id: 'settings', icon: '⚙️', label: 'Cài đặt' },
    ];
    return (
        <nav style={css.nav}>
            {items.map((item) => {
                const active = tab === item.id;
                return (
                    <button key={item.id} style={{ ...css.navBtn, color: active ? '#FF6B35' : 'var(--home-text-faint)' }} onClick={() => setTab(item.id)}>
                        <span style={{ fontSize: 18 }}>{item.icon}</span>
                        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>{item.label}</span>
                        {!!item.badge && item.badge > 0 && <span style={css.navBadge}>{item.badge}</span>}
                        {active && <div style={css.navLine} />}
                    </button>
                );
            })}
        </nav>
    );
}

// ═══════════════════════════════════════════════════════════════════
// SCHEDULE TAB (giữ nguyên logic hiển thị, chỉ đổi nguồn dữ liệu)
// ═══════════════════════════════════════════════════════════════════

interface ScheduleTabProps {
    semStart: string;
    currentWeek: number;
    weekView: number;
    setWeekView: React.Dispatch<React.SetStateAction<number>>;
    totalWeeks: number;
    subjects: Subject[];
    subjectMap: Record<string, Subject>;
    schedule: Schedule;
    scheduleByDate: ScheduleByDate;
    onlineDays: OnlineDays;
    examData: ExamData;
    notes: Notes;
    openModal: (id: string) => void;
}

function ScheduleTab({
    semStart,
    currentWeek,
    weekView,
    setWeekView,
    totalWeeks,
    subjects,
    subjectMap,
    schedule,
    scheduleByDate,
    onlineDays,
    examData,
    notes,
    openModal,
}: ScheduleTabProps) {
    const monday = getWeekMonday(semStart, weekView);
    const isExam = weekView > STUDY_WEEKS;
    const [viewMode, setViewMode] = useState<'week' | 'calendar'>('week');

    return (
        <div style={css.tab} className="anim-fadeup">
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                {(
                    [
                        ['week', '📋 Theo tuần'],
                        ['calendar', '📅 Lịch'],
                    ] as [typeof viewMode, string][]
                ).map(([mode, label]) => (
                    <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        style={{
                            ...css.chip,
                            padding: '6px 14px',
                            fontSize: 12,
                            background: viewMode === mode ? '#FF6B35' : 'transparent',
                            color: viewMode === mode ? '#fff' : 'var(--home-text-dim)',
                            border: `1px solid ${viewMode === mode ? 'transparent' : 'var(--home-border-strong)'}`,
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {viewMode === 'week' ? (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button style={css.arrowBtn} onClick={() => setWeekView((w) => Math.max(1, w - 1))}>
                            ‹
                        </button>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                                {isExam ? `🎯 TUẦN THI ${weekView - STUDY_WEEKS}` : `📚 TUẦN ${weekView}`}
                                {weekView === currentWeek && <span style={css.nowTag}>Hiện tại</span>}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--home-text-faint)', marginTop: 2 }}>
                                {fmtDMY(monday)} – {fmtDMY(getDayDate(monday, 5))}
                            </div>
                        </div>
                        <button style={css.arrowBtn} onClick={() => setWeekView((w) => Math.min(totalWeeks, w + 1))}>
                            ›
                        </button>
                    </div>

                    <WeekPills weekView={weekView} setWeekView={setWeekView} currentWeek={currentWeek} totalWeeks={totalWeeks} />

                    {!isExam && (
                        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                            {[
                                ['#00C6FF', '🌐 Online'],
                                ['#FF6B35', '🏫 Offline'],
                            ].map(([c, l]) => (
                                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--home-text-dim)' }}>
                                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
                                    {l}
                                </div>
                            ))}
                        </div>
                    )}

                    {isExam ? (
                        <ExamWeek weekView={weekView} examData={examData} subjects={subjects} openModal={openModal} notes={notes} />
                    ) : (
                        <StudyWeek
                            weekView={weekView}
                            monday={monday}
                            subjectMap={subjectMap}
                            schedule={schedule}
                            scheduleByDate={scheduleByDate}
                            onlineDays={onlineDays}
                            notes={notes}
                            openModal={openModal}
                        />
                    )}
                </>
            ) : (
                <CalendarView
                    semStart={semStart}
                    subjectMap={subjectMap}
                    schedule={schedule}
                    scheduleByDate={scheduleByDate}
                    onlineDays={onlineDays}
                    examData={examData}
                    openModal={openModal}
                />
            )}
        </div>
    );
}

function WeekPills({
    weekView,
    setWeekView,
    currentWeek,
    totalWeeks,
}: {
    weekView: number;
    setWeekView: React.Dispatch<React.SetStateAction<number>>;
    currentWeek: number;
    totalWeeks: number;
}) {
    return (
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => {
                const isActive = w === weekView;
                const isCurrent = w === currentWeek;
                const isExam = w > STUDY_WEEKS;
                return (
                    <button
                        key={w}
                        onClick={() => setWeekView(w)}
                        style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: isActive ? (isExam ? '#FBBF24' : '#FF6B35') : 'transparent',
                            color: isActive ? '#fff' : isExam ? '#FBBF24' : isCurrent ? '#FF6B35' : 'var(--home-text-faint)',
                            border: isActive ? 'none' : isCurrent ? '1px solid #FF6B3560' : isExam ? '1px solid #FBBF2440' : '1px solid var(--home-border)',
                        }}
                    >
                        {w > STUDY_WEEKS ? `T${w - STUDY_WEEKS}` : w}
                    </button>
                );
            })}
        </div>
    );
}

function StudyWeek({
    weekView,
    monday,
    subjectMap,
    schedule,
    scheduleByDate,
    onlineDays,
    notes,
    openModal,
}: {
    weekView: number;
    monday: Date;
    subjectMap: Record<string, Subject>;
    schedule: Schedule;
    scheduleByDate: ScheduleByDate;
    onlineDays: OnlineDays;
    notes: Notes;
    openModal: (id: string) => void;
}) {
    const onDays = onlineDays[weekView] || [];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5].map((dow) => {
                const date = getDayDate(monday, dow);
                const today = isToday(date);
                const dateStr = toISODate(date);
                // Slot tạo tay (không có isOnline riêng) fallback theo onlineDays lặp lại
                // theo tuần; slot import .ics đã có isOnline riêng theo đúng phòng học.
                const dayFallbackOnline = onDays.includes(dow);
                // Buổi lặp lại hàng tuần (tạo tay) + buổi đúng ngày cụ thể (import .ics) của
                // riêng ngày này, in chung lên 1 danh sách cho ô lịch của ngày đó.
                const dated = scheduleByDate[dateStr] || [];
                const items: { code: string; slotOrder?: number; isOnline?: boolean | null }[] = [
                    ...(schedule[dow] || []).map((code) => ({ code })),
                    ...dated,
                ];
                return (
                    <div key={dow} style={{ ...css.card, ...(today ? { border: '1px solid #FF6B3540', boxShadow: '0 0 20px #FF6B3310' } : {}) }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <span style={{ fontWeight: 800, fontSize: 13 }}>{DAY_NAMES[dow]}</span>
                            <span style={{ fontSize: 11, color: 'var(--home-text-faint)', flex: 1 }}>
                                {fmtDMY(date)}
                                {today && (
                                    <span className="anim-pulse" style={{ color: '#FF6B35', marginLeft: 6, fontSize: 9 }}>
                                        ●
                                    </span>
                                )}
                            </span>
                        </div>
                        {items.length === 0 && <div style={{ fontSize: 11, color: 'var(--home-text-faint)', fontStyle: 'italic' }}>Không có lịch học</div>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                            {items.map((item, i) => {
                                const sub = subjectMap[item.code];
                                if (!sub) return null;
                                const hasNote = !!(notes[item.code] && notes[item.code].trim());
                                const online = item.isOnline ?? dayFallbackOnline;
                                return (
                                    <div
                                        key={i}
                                        style={{
                                            borderRadius: 9,
                                            padding: '8px 11px',
                                            borderLeft: `3px solid ${sub.color}`,
                                            background: sub.color + '14',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                            <span style={{ color: sub.color, fontWeight: 800, fontSize: 13 }}>{sub.name}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span
                                                    style={{
                                                        fontSize: 9,
                                                        fontWeight: 700,
                                                        padding: '2px 7px',
                                                        borderRadius: 20,
                                                        background: online ? '#00C6FF14' : '#FF6B3514',
                                                        color: online ? '#00C6FF' : '#FF6B35',
                                                        border: `1px solid ${online ? '#00C6FF30' : '#FF6B3530'}`,
                                                    }}
                                                >
                                                    {online ? '🌐 Online' : '🏫 Offline'}
                                                </span>
                                                <span style={{ fontSize: 9, color: 'var(--home-text-faint)' }}>SLOT {item.slotOrder ?? i + 1}</span>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--home-text-dim)', marginBottom: 7 }}>{sub.full}</div>
                                        <button style={css.smallBtn} onClick={() => openModal(`note:${item.code}`)}>
                                            {hasNote ? '📝 Xem ghi chú' : '➕ Thêm ghi chú'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function ExamWeek({
    weekView,
    examData,
    subjects,
    openModal,
    notes,
}: {
    weekView: number;
    examData: ExamData;
    subjects: Subject[];
    openModal: (id: string) => void;
    notes: Notes;
}) {
    const examWeekNum = weekView - STUDY_WEEKS;
    return (
        <div>
            <div
                style={{
                    ...css.card,
                    background: '#FBBF2410',
                    border: '1px solid #FBBF2428',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                }}
            >
                <span style={{ fontSize: 30 }}>🎯</span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#FBBF24' }}>TUẦN THI {examWeekNum}</div>
                    <div style={{ fontSize: 11, color: 'var(--home-text-dim)', marginTop: 2 }}>Chỉnh sửa theo thông báo chính thức</div>
                </div>
                <button style={{ ...css.smallBtn, color: '#FBBF24', borderColor: '#FBBF2440' }} onClick={() => openModal('exam')}>
                    ✏️ Sửa
                </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {subjects.map((sub) => {
                    const key = `w${weekView}_${sub.id}`;
                    const exam = examData[key];
                    const hasNote = !!(notes[sub.id] && notes[sub.id].trim());
                    return (
                        <div key={sub.id} style={{ ...css.card, borderTop: `3px solid ${sub.color}`, gap: 0 }}>
                            <div style={{ color: sub.color, fontWeight: 800, fontSize: 13, marginBottom: 2 }}>{sub.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--home-text-dim)', marginBottom: 8 }}>{sub.full}</div>
                            {exam ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                                    {(
                                        [
                                            ['📅', exam.date],
                                            ['⏰', exam.time],
                                            ['🏫', exam.room],
                                            ['📋', exam.type],
                                        ] as [string, string | undefined][]
                                    )
                                        .filter(([, v]) => v)
                                        .map(([icon, val]) => (
                                            <div key={icon} style={{ fontSize: 11, color: 'var(--home-text-soft)' }}>
                                                {icon} {val}
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: 11, color: 'var(--home-text-faint)', fontStyle: 'italic', marginBottom: 8 }}>Chưa có lịch thi</div>
                            )}
                            <button style={css.smallBtn} onClick={() => openModal(`note:${sub.id}`)}>
                                {hasNote ? '📝 Ghi chú' : '➕ Ôn thi'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface CalendarEventProps {
    code: string;
    kind: 'class' | 'exam';
    isOnline?: boolean | null;
    room?: string;
    type?: string;
}

function CalendarView({
    semStart,
    subjectMap,
    schedule,
    scheduleByDate,
    onlineDays,
    examData,
    openModal,
}: {
    semStart: string;
    subjectMap: Record<string, Subject>;
    schedule: Schedule;
    scheduleByDate: ScheduleByDate;
    onlineDays: OnlineDays;
    examData: ExamData;
    openModal: (id: string) => void;
}) {
    // FullCalendar cần danh sách event tĩnh (không tính theo từng ngày một như bản tự vẽ
    // cũ) — build 1 lần: (1) lịch lặp lại hàng tuần chỉ trong phạm vi STUDY_WEEKS tuần học
    // đầu tiên của học kỳ, (2) buổi học có ngày cụ thể (import .ics/tạo tay), (3) lịch thi.
    const events = useMemo(() => {
        const list: {
            id: string;
            title: string;
            start: string;
            end?: string;
            allDay?: boolean;
            backgroundColor: string;
            borderColor: string;
            extendedProps: CalendarEventProps;
        }[] = [];

        const semStartMonday = parseLocalDate(semStart);
        for (let week = 0; week < STUDY_WEEKS; week++) {
            const weekOnline = onlineDays[week + 1] || [];
            for (let dow = 1; dow <= 5; dow++) {
                const date = new Date(semStartMonday);
                date.setDate(date.getDate() + week * 7 + (dow - 1));
                const dateStr = toISODate(date);
                const dayOnline = weekOnline.includes(dow);
                (schedule[dow] || []).forEach((code, i) => {
                    const sub = subjectMap[code];
                    if (!sub) return;
                    list.push({
                        id: `tpl-${week}-${dow}-${i}`,
                        title: dayOnline ? `${sub.name} · 🌐 Online` : sub.name,
                        start: dateStr,
                        allDay: true,
                        backgroundColor: hexToRgba(sub.color, 0.16),
                        borderColor: sub.color,
                        extendedProps: { code, kind: 'class', isOnline: dayOnline },
                    });
                });
            }
        }

        Object.entries(scheduleByDate).forEach(([dateStr, items]) => {
            items.forEach((item, i) => {
                const sub = subjectMap[item.code];
                if (!sub) return;
                list.push({
                    id: `dated-${dateStr}-${i}`,
                    title: item.isOnline ? `${sub.name} · 🌐 Online` : sub.name,
                    start: item.startTime ? `${dateStr}T${item.startTime}` : dateStr,
                    end: item.endTime ? `${dateStr}T${item.endTime}` : undefined,
                    allDay: !item.startTime,
                    backgroundColor: hexToRgba(sub.color, 0.16),
                    borderColor: sub.color,
                    extendedProps: { code: item.code, kind: 'class', isOnline: item.isOnline },
                });
            });
        });

        Object.entries(examData).forEach(([key, entry]) => {
            const m = key.match(/^w\d+_(.+)$/);
            if (!m || !entry.date) return;
            const code = m[1];
            const sub = subjectMap[code];
            if (!sub) return;
            list.push({
                id: `exam-${key}`,
                title: `🎯 ${sub.name} thi`,
                start: entry.time ? `${entry.date}T${entry.time}` : entry.date,
                allDay: !entry.time,
                backgroundColor: hexToRgba('#FBBF24', 0.22),
                borderColor: '#FBBF24',
                extendedProps: { code, kind: 'exam', room: entry.room, type: entry.type },
            });
        });

        return list;
    }, [semStart, schedule, scheduleByDate, onlineDays, examData, subjectMap]);

    return (
        <div className="fc-home-wrap">
            <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                locale={viLocale}
                headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                height="auto"
                dayMaxEvents={3}
                events={events}
                eventClick={(info) => {
                    const code = (info.event.extendedProps as CalendarEventProps).code;
                    openModal(`note:${code}`);
                }}
            />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// TASKS TAB (mutation qua router thay vì setState)
// ═══════════════════════════════════════════════════════════════════

interface TasksTabProps {
    tasks: Task[];
    subjects: Subject[];
    subjectMap: Record<string, Subject>;
    showToast: (msg: string) => void;
    requireAuth: () => boolean;
    isDemo: boolean;
}

function TasksTab({ tasks, subjects, subjectMap, showToast, requireAuth, isDemo }: TasksTabProps) {
    const [newSub, setNewSub] = useState<string>(subjects[0]?.id || '');
    const [newText, setNewText] = useState<string>('');
    const [newDl, setNewDl] = useState<string>('');
    const [filter, setFilter] = useState<string>('ALL');

    useEffect(() => {
        if (!subjects.find((s) => s.id === newSub)) setNewSub(subjects[0]?.id || '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subjects]);

    const addTask = () => {
        if (!requireAuth()) return;
        if (!newText.trim()) return;
        router.post(
            '/tasks',
            { subject: newSub, text: newText.trim(), deadline: newDl || null },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setNewText('');
                    setNewDl('');
                    showToast('✅ Đã thêm task!');
                },
            },
        );
    };

    const toggleTask = (id: number) => {
        if (!requireAuth()) return;
        router.patch(`/tasks/${id}/toggle`, {}, { preserveScroll: true, preserveState: true });
    };

    const deleteTask = (id: number) => {
        if (!requireAuth()) return;
        router.delete(`/tasks/${id}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => showToast('🗑 Đã xóa'),
        });
    };

    const isOverdue = (dl: string) => !!dl && new Date(dl) < new Date();

    const filtered = filter === 'ALL' ? tasks : tasks.filter((t) => t.subject === filter);
    const pending = filtered.filter((t) => !t.done);
    const done = filtered.filter((t) => t.done);

    return (
        <div style={css.tab} className="anim-fadeup">
            <div style={css.card}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#FF6B35', marginBottom: 6 }}>➕ Thêm Nhiệm Vụ</div>
                <select value={newSub} onChange={(e) => setNewSub(e.target.value)} style={css.select}>
                    {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name} — {s.full}
                        </option>
                    ))}
                </select>
                <input
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTask()}
                    placeholder={isDemo ? 'Đăng nhập để thêm task...' : 'Mô tả nhiệm vụ...'}
                    style={css.input}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                    <input type="datetime-local" value={newDl} onChange={(e) => setNewDl(e.target.value)} style={{ ...css.input, flex: 1 }} />
                    <button style={css.primaryBtn} onClick={addTask}>
                        Thêm
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
                {[
                    { label: 'Cần làm', val: tasks.filter((t) => !t.done).length, color: '#FF6B35' },
                    { label: 'Hoàn thành', val: tasks.filter((t) => t.done).length, color: '#34D399' },
                    { label: 'Quá hạn', val: tasks.filter((t) => !t.done && isOverdue(t.deadline)).length, color: '#EF4444' },
                ].map((s) => (
                    <div key={s.label} style={{ flex: 1, ...css.card, padding: '10px', textAlign: 'center', gap: 2 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 10, color: 'var(--home-text-dim)' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['ALL', ...subjects.map((s) => s.id)].map((f) => {
                    const active = f === filter;
                    const color = f === 'ALL' ? '#fff' : subjectMap[f]?.color || 'var(--home-text-dim)';
                    return (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                ...css.chip,
                                background: active ? (f === 'ALL' ? '#fff' : color) : 'transparent',
                                color: active ? (f === 'ALL' ? 'var(--home-bg)' : '#fff') : 'var(--home-text-dim)',
                                border: `1px solid ${active ? 'transparent' : 'var(--home-border-strong)'}`,
                            }}
                        >
                            {f}
                        </button>
                    );
                })}
            </div>

            {pending.length === 0 && done.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--home-text-faint)', padding: '48px 0', fontSize: 14 }}>Không có task nào 🎉</div>
            )}

            {pending.map((t) => (
                <TaskRow key={t.id} task={t} subjectMap={subjectMap} onToggle={toggleTask} onDelete={deleteTask} overdue={isOverdue(t.deadline)} />
            ))}

            {done.length > 0 && (
                <>
                    <div style={{ fontSize: 11, color: 'var(--home-text-faint)', fontWeight: 700, padding: '4px 0', borderTop: '1px solid var(--home-border)' }}>
                        ✅ HOÀN THÀNH ({done.length})
                    </div>
                    {done.map((t) => (
                        <TaskRow key={t.id} task={t} subjectMap={subjectMap} onToggle={toggleTask} onDelete={deleteTask} overdue={false} />
                    ))}
                </>
            )}
        </div>
    );
}

function TaskRow({
    task,
    subjectMap,
    onToggle,
    onDelete,
    overdue,
}: {
    task: Task;
    subjectMap: Record<string, Subject>;
    onToggle: (id: number) => void;
    onDelete: (id: number) => void;
    overdue: boolean;
}) {
    const sub = subjectMap[task.subject] || { color: 'var(--home-text-dim)' };
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                background: 'var(--home-card)',
                border: `1px solid ${overdue && !task.done ? '#EF444430' : 'var(--home-border)'}`,
                borderLeft: `3px solid ${sub.color}`,
                opacity: task.done ? 0.5 : 1,
            }}
        >
            <button style={{ background: 'none', border: 'none', fontSize: 19, cursor: 'pointer', flexShrink: 0 }} onClick={() => onToggle(task.id)}>
                {task.done ? '✅' : '⬜'}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: task.done ? 'line-through' : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {task.text}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: sub.color }}>{task.subject}</span>
                    {task.deadline && (
                        <span style={{ fontSize: 10, color: overdue && !task.done ? '#EF4444' : 'var(--home-text-faint)' }}>
                            ⏰{' '}
                            {new Date(task.deadline).toLocaleString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </span>
                    )}
                </div>
            </div>
            <button
                style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', opacity: 0.35, flexShrink: 0 }}
                onClick={() => onDelete(task.id)}
            >
                🗑
            </button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// NOTES TAB
// ═══════════════════════════════════════════════════════════════════

function NotesTab({ subjects, notes, openModal }: { subjects: Subject[]; notes: Notes; openModal: (id: string) => void }) {
    return (
        <div style={css.tab} className="anim-fadeup">
            <div style={{ fontSize: 12, color: 'var(--home-text-faint)', marginBottom: 2 }}>Nhấn vào môn để xem hoặc chỉnh sửa ghi chú</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {subjects.map((sub) => {
                    const note = notes[sub.id] || '';
                    return (
                        <div
                            key={sub.id}
                            style={{ ...css.card, borderTop: `3px solid ${sub.color}`, cursor: 'pointer', gap: 4 }}
                            onClick={() => openModal(`note:${sub.id}`)}
                        >
                            <div style={{ fontWeight: 800, fontSize: 13, color: sub.color }}>{sub.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--home-text-faint)', marginBottom: 4 }}>{sub.full}</div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: note ? 'var(--home-text-soft)' : 'var(--home-text-faint)',
                                    lineHeight: 1.5,
                                    flex: 1,
                                    fontStyle: note ? 'normal' : 'italic',
                                    overflow: 'hidden',
                                }}
                            >
                                {note ? note.slice(0, 110) + (note.length > 110 ? '…' : '') : 'Chưa có ghi chú...'}
                            </div>
                            <div style={{ fontSize: 10, color: sub.color, fontWeight: 700, marginTop: 6 }}>{note ? '✏️ Chỉnh sửa' : '➕ Thêm'}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS TAB
// ═══════════════════════════════════════════════════════════════════

function SettingsTab({
    semStart,
    semesterId,
    currentWeek,
    totalWeeks,
    openModal,
    showToast,
    isDemo,
}: {
    semStart: string;
    semesterId?: number;
    currentWeek: number;
    totalWeeks: number;
    openModal: (id: string) => void;
    showToast: (msg: string) => void;
    isDemo: boolean;
}) {
    const changeSemStart = (dateStr: string) => {
        if (isDemo || !semesterId) {
            showToast('🔐 Đăng nhập để chỉnh ngày bắt đầu học kỳ');
            return;
        }
        if (!dateStr) {
            showToast('⚠️ Vui lòng chọn một ngày hợp lệ');
            return;
        }
        router.put(
            `/semesters/${semesterId}`,
            { start_date: dateStr },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => showToast('✅ Đã cập nhật ngày bắt đầu học kỳ!'),
                onError: () => showToast('❌ Không thể cập nhật ngày bắt đầu học kỳ'),
            },
        );
    };

    return (
        <div style={css.tab} className="anim-fadeup">
            <div style={css.card}>
                <div style={css.cardTitle}>📅 Ngày Bắt Đầu Học Kỳ</div>
                <div style={{ fontSize: 11, color: 'var(--home-text-faint)', marginBottom: 6 }}>Chọn ngày Thứ 2 của tuần đầu tiên</div>
                <input type="date" value={semStart} onChange={(e) => changeSemStart(e.target.value)} style={css.input} disabled={isDemo} />
                <div style={{ fontSize: 12, color: 'var(--home-text-dim)' }}>
                    Tuần hiện tại:{' '}
                    <strong style={{ color: '#FF6B35' }}>
                        {currentWeek <= STUDY_WEEKS ? `Tuần ${currentWeek}` : `Tuần thi ${currentWeek - STUDY_WEEKS}`}
                    </strong>
                </div>
            </div>

            <div style={css.card}>
                <div style={css.cardTitle}>⚙️ Tuỳ Chỉnh</div>
                {[
                    { icon: '📚', label: 'Quản lý môn học', sub: 'Thêm, sửa, xóa, đổi màu môn', id: 'subjects' },
                    { icon: '🗓', label: 'Lịch học theo ngày', sub: 'Chỉnh slot môn cho từng thứ', id: 'schedule' },
                    { icon: '💬', label: 'Gửi phản hồi', sub: 'Góp ý, báo lỗi cho ứng dụng', id: 'feedback' },
                ].map((item) => (
                    <button
                        key={item.id}
                        onClick={() => openModal(item.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            width: '100%',
                            background: 'var(--home-input)',
                            border: '1px solid var(--home-border)',
                            borderRadius: 10,
                            padding: '11px 13px',
                            cursor: 'pointer',
                            textAlign: 'left',
                        }}
                    >
                        <span style={{ fontSize: 22 }}>{item.icon}</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--home-text)' }}>{item.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--home-text-faint)', marginTop: 1 }}>{item.sub}</div>
                        </div>
                        <span style={{ color: 'var(--home-text-faint)', fontSize: 18 }}>›</span>
                    </button>
                ))}
            </div>

            <div style={css.card}>
                <div style={css.cardTitle}>📊 Tiến Độ Học Kỳ</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                    {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => {
                        const isExam = w > STUDY_WEEKS;
                        const isCur = w === currentWeek;
                        const isPast = w < currentWeek;
                        return (
                            <div
                                key={w}
                                style={{
                                    borderRadius: 8,
                                    padding: '5px 7px',
                                    textAlign: 'center',
                                    minWidth: 35,
                                    background: isCur ? '#FF6B35' : isPast ? 'var(--home-border-strong)' : 'var(--home-border-faint)',
                                    border: `1px solid ${isCur ? '#FF6B35' : isExam ? '#FBBF2428' : 'var(--home-border)'}`,
                                }}
                            >
                                <div style={{ fontSize: 10, fontWeight: 800, color: isCur ? '#fff' : isExam ? '#FBBF24' : isPast ? 'var(--home-text-dim)' : 'var(--home-text-faint)' }}>
                                    {isExam ? `T${w - STUDY_WEEKS}` : `W${w}`}
                                </div>
                                <div style={{ fontSize: 8, color: isCur ? '#fff8' : 'var(--home-text-faint)', marginTop: 1 }}>
                                    {isExam ? 'THI' : isCur ? 'NOW' : isPast ? '✓' : '·'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--home-text-faint)', paddingTop: 4 }}>FPT Time Management Toolkit v3</div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════

function ModalShell({
    title,
    onClose,
    children,
    footer,
}: {
    title: React.ReactNode;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    return (
        <div style={css.overlay}>
            <div style={css.modal} className="anim-slideup">
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '13px 16px',
                        borderBottom: '1px solid var(--home-border)',
                    }}
                >
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
                    <button style={css.closeBtn} onClick={onClose}>
                        ✕
                    </button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
                {footer && <div style={{ display: 'flex', gap: 8, padding: '11px 16px', borderTop: '1px solid var(--home-border)' }}>{footer}</div>}
            </div>
        </div>
    );
}

function NoteModal({
    subjectId,
    subjectMap,
    notes,
    semesterId,
    onClose,
    showToast,
}: {
    subjectId: string;
    subjectMap: Record<string, Subject>;
    notes: Notes;
    semesterId: number;
    onClose: () => void;
    showToast: (msg: string) => void;
}) {
    const sub = subjectMap[subjectId] || { color: 'var(--home-text-dim)', name: subjectId, full: '', id: subjectId };
    const [text, setText] = useState<string>(notes[subjectId] || '');
    const [saving, setSaving] = useState(false);

    const saveNote = () => {
        if (!text.trim()) {
            showToast('⚠️ Ghi chú không được để trống');
            return;
        }
        if (text.length > 20000) {
            showToast('⚠️ Ghi chú quá dài (tối đa 20.000 ký tự)');
            return;
        }
        setSaving(true);
        router.put(
            `/semesters/${semesterId}/subjects/${subjectId}/note`,
            { content: text },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    showToast('✅ Đã lưu ghi chú!');
                    onClose();
                },
                onError: () => showToast('❌ Không thể lưu ghi chú'),
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <ModalShell
            title={<span style={{ color: sub.color }}>📝 {sub.name}</span>}
            onClose={onClose}
            footer={
                <>
                    <button style={{ ...css.chip, flex: 1, padding: '10px', justifyContent: 'center' }} onClick={onClose}>
                        Hủy
                    </button>
                    <button
                        style={{ ...css.primaryBtn, flex: 2, justifyContent: 'center', background: sub.color, opacity: saving ? 0.6 : 1 }}
                        onClick={saveNote}
                        disabled={saving}
                    >
                        💾 {saving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                </>
            }
        >
            <div style={{ fontSize: 11, color: 'var(--home-text-faint)' }}>{sub.full}</div>
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Nội dung, bài tập, công thức cần nhớ..."
                rows={9}
                style={{ ...css.input, resize: 'vertical', lineHeight: 1.65, border: `1px solid ${sub.color}28` }}
            />
        </ModalShell>
    );
}

function ExamModal({
    examData,
    subjects,
    semesterId,
    examWeeksCount,
    onClose,
    showToast,
}: {
    examData: ExamData;
    subjects: Subject[];
    semesterId: number;
    examWeeksCount: number;
    onClose: () => void;
    showToast: (msg: string) => void;
}) {
    const [local, setLocal] = useState<ExamData>(() => JSON.parse(JSON.stringify(examData)));
    const [activeW, setActiveW] = useState<number>(STUDY_WEEKS + 1);
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);
    const [manualAdds, setManualAdds] = useState<Set<string>>(new Set());
    const [addSubId, setAddSubId] = useState('');
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const update = (subId: string, field: keyof ExamEntry, val: string) => {
        const key = `w${activeW}_${subId}`;
        setLocal((prev) => ({ ...prev, [key]: { ...prev[key], [field]: val } }));
    };

    const addSubjectToWeek = () => {
        if (!addSubId) return;
        const key = `w${activeW}_${addSubId}`;
        setManualAdds((prev) => new Set(prev).add(key));
        setLocal((prev) => (prev[key] ? prev : { ...prev, [key]: { date: '', time: '', room: '', type: '' } }));
        setAddSubId('');
    };

    const saveExam = () => {
        setSaving(true);
        router.put(`/semesters/${semesterId}/exam-entries`, asFormData({ examData: local }), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                showToast('✅ Đã lưu lịch thi!');
                onClose();
            },
            onFinish: () => setSaving(false),
        });
    };

    const importIcs = (file: File) => {
        const form = new FormData();
        form.append('ics_file', file);
        setImporting(true);
        router.post(`/semesters/${semesterId}/exam-entries/import`, form, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                showToast('✅ Đã nhập lịch thi từ file .ics!');
                onClose();
            },
            onError: (errors) => showToast(`❌ ${errors.ics_file || 'Không thể nhập file .ics'}`),
            onFinish: () => {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
        });
    };

    return (
        <ModalShell
            title="🎯 Lịch Thi"
            onClose={onClose}
            footer={
                <>
                    <button style={{ ...css.chip, flex: 1, padding: '10px', justifyContent: 'center' }} onClick={onClose}>
                        Hủy
                    </button>
                    <button
                        style={{ ...css.primaryBtn, flex: 2, justifyContent: 'center', opacity: saving ? 0.6 : 1 }}
                        onClick={saveExam}
                        disabled={saving}
                    >
                        💾 {saving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                </>
            }
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--home-input)', borderRadius: 10, padding: '10px 12px' }}>
                <span style={{ fontSize: 12, color: 'var(--home-text-dim)', flex: 1 }}>Nhập lịch thi tự động từ file .ics</span>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ics"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files?.[0] && importIcs(e.target.files[0])}
                />
                <button
                    style={{ ...css.smallBtn, opacity: importing ? 0.6 : 1 }}
                    disabled={importing}
                    onClick={() => fileInputRef.current?.click()}
                >
                    📥 {importing ? 'Đang nhập...' : 'Nhập file .ics'}
                </button>
            </div>

            <div
                style={{
                    display: 'flex',
                    overflowX: 'auto',
                    borderBottom: '1px solid var(--home-border)',
                    margin: '0 -16px 0',
                    padding: '0 16px',
                }}
            >
                {Array.from({ length: examWeeksCount }, (_, i) => STUDY_WEEKS + 1 + i).map((w) => (
                    <button
                        key={w}
                        onClick={() => setActiveW(w)}
                        style={{
                            flex: '0 0 auto',
                            minWidth: 84,
                            padding: '9px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: 13,
                            color: w === activeW ? '#FBBF24' : 'var(--home-text-faint)',
                            borderBottom: w === activeW ? '2px solid #FBBF24' : '2px solid transparent',
                        }}
                    >
                        Tuần Thi {w - STUDY_WEEKS}
                    </button>
                ))}
            </div>
            {(() => {
                const hasExam = (sub: Subject) => {
                    const key = `w${activeW}_${sub.id}`;
                    if (manualAdds.has(key)) return true;
                    const exam = local[key];
                    return !!exam && (exam.date || exam.time || exam.room || exam.type);
                };
                const subjectsWithExam = subjects.filter(hasExam);
                const availableToAdd = subjects.filter((s) => !hasExam(s));

                return (
                    <>
                        {availableToAdd.length > 0 && (
                            <div style={{ display: 'flex', gap: 6 }}>
                                <select value={addSubId} onChange={(e) => setAddSubId(e.target.value)} style={{ ...css.select, flex: 1 }}>
                                    <option value="">+ Thêm môn thi vào tuần này...</option>
                                    {availableToAdd.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} — {s.full}
                                        </option>
                                    ))}
                                </select>
                                <button style={css.smallBtn} onClick={addSubjectToWeek} disabled={!addSubId}>
                                    ➕
                                </button>
                            </div>
                        )}
                        {subjectsWithExam.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--home-text-dim)', fontSize: 12, padding: '16px 0' }}>
                                Chưa có môn nào thi trong tuần này
                            </div>
                        )}
                        {subjectsWithExam.map((sub) => {
                            const key = `w${activeW}_${sub.id}`;
                            const exam = local[key] || {};
                            return (
                                <div
                                    key={sub.id}
                                    style={{ background: 'var(--home-input)', borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${sub.color}` }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                                        <div style={{ color: sub.color, fontWeight: 700, flex: 1 }}>{sub.name}</div>
                                        <button
                                            style={{ ...css.smallBtn, padding: '2px 8px' }}
                                            onClick={() => {
                                                setLocal((prev) => {
                                                    const next = { ...prev };
                                                    delete next[key];
                                                    return next;
                                                });
                                                setManualAdds((prev) => {
                                                    const next = new Set(prev);
                                                    next.delete(key);
                                                    return next;
                                                });
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                        {(
                                            [
                                                ['date', 'Ngày thi', 'date'],
                                                ['time', 'Giờ thi', 'time'],
                                                ['room', 'Phòng thi', 'text'],
                                                ['type', 'Hình thức', 'text'],
                                            ] as [keyof ExamEntry, string, string][]
                                        ).map(([f, ph, type]) => (
                                            <input
                                                key={f}
                                                type={type}
                                                placeholder={ph}
                                                maxLength={type === 'text' ? 100 : undefined}
                                                value={exam[f] || ''}
                                                onChange={(e) => update(sub.id, f, e.target.value)}
                                                style={{ ...css.input, fontSize: 11 }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </>
                );
            })()}
        </ModalShell>
    );
}

function SubjectsModal({
    subjects,
    semesterId,
    onClose,
    showToast,
}: {
    subjects: Subject[];
    semesterId: number;
    onClose: () => void;
    showToast: (msg: string) => void;
}) {
    const [local, setLocal] = useState<Subject[]>(subjects.map((s) => ({ ...s })));
    const [newName, setNewName] = useState<string>('');
    const [newFull, setNewFull] = useState<string>('');
    const [newColor, setNewColor] = useState<string>(PRESET_COLORS[5]);
    const [saving, setSaving] = useState(false);

    const updateField = (idx: number, field: keyof Subject, val: string) =>
        setLocal((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: val } : s)));
    // "id" và "name" luôn phải giống nhau (cùng là mã môn) — sync cả 2 khi sửa ô "Mã môn",
    // nếu không backend chỉ đọc "id" nên sửa mã môn ở đây sẽ không có tác dụng gì khi lưu.
    const updateCode = (idx: number, val: string) =>
        setLocal((prev) => prev.map((s, i) => (i === idx ? { ...s, id: val, name: val } : s)));
    const remove = (idx: number) => setLocal((prev) => prev.filter((_, i) => i !== idx));

    const addSubject = () => {
        const name = newName.trim().toUpperCase();
        if (!name) return;
        if (!/^[A-Za-z0-9]+$/.test(name)) {
            showToast('⚠️ Mã môn chỉ được chứa chữ và số');
            return;
        }
        if (local.find((s) => s.id === name)) {
            showToast('⚠️ Mã môn đã tồn tại!');
            return;
        }
        setLocal((prev) => [...prev, { id: name, name, full: newFull.trim() || name, color: newColor }]);
        setNewName('');
        setNewFull('');
    };

    const saveSubjects = () => {
        if (local.length === 0) {
            showToast('⚠️ Cần ít nhất 1 môn học');
            return;
        }
        const codeRe = /^[A-Za-z0-9]+$/;
        for (const s of local) {
            if (!s.id.trim() || !codeRe.test(s.id.trim())) {
                showToast(`⚠️ Mã môn "${s.id || '(trống)'}" không hợp lệ (chỉ chữ và số)`);
                return;
            }
            if (!s.full.trim()) {
                showToast(`⚠️ Môn "${s.id}" thiếu tên đầy đủ`);
                return;
            }
        }
        const codes = local.map((s) => s.id.toUpperCase());
        if (new Set(codes).size !== codes.length) {
            showToast('⚠️ Có mã môn bị trùng lặp');
            return;
        }

        setSaving(true);
        router.put(`/semesters/${semesterId}/subjects`, asFormData({ subjects: local }), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                showToast('✅ Đã lưu môn học!');
                onClose();
            },
            onError: () => showToast('❌ Không thể lưu môn học. Kiểm tra lại mã môn.'),
            onFinish: () => setSaving(false),
        });
    };

    return (
        <ModalShell
            title="📚 Quản Lý Môn Học"
            onClose={onClose}
            footer={
                <>
                    <button style={{ ...css.chip, flex: 1, padding: '10px', justifyContent: 'center' }} onClick={onClose}>
                        Hủy
                    </button>
                    <button
                        style={{ ...css.primaryBtn, flex: 2, justifyContent: 'center', opacity: saving ? 0.6 : 1 }}
                        onClick={saveSubjects}
                        disabled={saving}
                    >
                        💾 {saving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                </>
            }
        >
            {local.map((sub, i) => (
                <div key={i} style={{ background: 'var(--home-input)', borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${sub.color}` }}>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 6 }}>
                        <input
                            value={sub.name}
                            onChange={(e) => updateCode(i, e.target.value.toUpperCase())}
                            maxLength={20}
                            style={{ ...css.input, flex: 1, fontWeight: 700, fontSize: 13 }}
                            placeholder="Mã môn"
                        />
                        <input
                            type="color"
                            value={sub.color}
                            onChange={(e) => updateField(i, 'color', e.target.value)}
                            style={{ width: 36, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 2, background: 'none' }}
                        />
                        <button
                            onClick={() => remove(i)}
                            style={{
                                background: '#EF444418',
                                border: '1px solid #EF444430',
                                color: '#EF4444',
                                borderRadius: 8,
                                padding: '6px 9px',
                                cursor: 'pointer',
                                fontSize: 12,
                            }}
                        >
                            🗑
                        </button>
                    </div>
                    <input
                        value={sub.full}
                        onChange={(e) => updateField(i, 'full', e.target.value)}
                        style={{ ...css.input, fontSize: 11 }}
                        placeholder="Tên đầy đủ"
                    />
                </div>
            ))}

            <div style={{ background: 'var(--home-card)', border: '1px dashed var(--home-border-strong)', borderRadius: 10, padding: '12px' }}>
                <div style={{ fontSize: 12, color: 'var(--home-text-dim)', fontWeight: 600, marginBottom: 8 }}>➕ Thêm môn mới</div>
                <div style={{ display: 'flex', gap: 7, marginBottom: 6 }}>
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Mã môn (vd: OOP101)"
                        style={{ ...css.input, flex: 1 }}
                        onKeyDown={(e) => e.key === 'Enter' && addSubject()}
                    />
                    <input
                        type="color"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        style={{ width: 36, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 2, background: 'none' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                    <input
                        value={newFull}
                        onChange={(e) => setNewFull(e.target.value)}
                        placeholder="Tên đầy đủ môn học"
                        style={{ ...css.input, flex: 1 }}
                        onKeyDown={(e) => e.key === 'Enter' && addSubject()}
                    />
                    <button style={css.primaryBtn} onClick={addSubject}>
                        +
                    </button>
                </div>
            </div>
        </ModalShell>
    );
}

function ScheduleModal({
    subjects,
    scheduleSlotsBySubject,
    semesterId,
    onClose,
    showToast,
}: {
    subjects: Subject[];
    scheduleSlotsBySubject: ScheduleSlotsBySubject;
    semesterId: number;
    onClose: () => void;
    showToast: (msg: string) => void;
}) {
    const [selectedCode, setSelectedCode] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [sessions, setSessions] = useState<ScheduleSession[]>([]);
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);
    const [deletingAll, setDeletingAll] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const deleteAllSchedule = () => {
        if (!window.confirm('Xoá TOÀN BỘ lịch học của mọi môn? Hành động này không thể hoàn tác.')) {
            return;
        }
        setDeletingAll(true);
        router.delete(`/semesters/${semesterId}/schedule-slots`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => showToast('🗑 Đã xoá toàn bộ lịch học!'),
            onFinish: () => setDeletingAll(false),
        });
    };

    const openSubject = (code: string) => {
        setSelectedCode(code);
        setSessions((scheduleSlotsBySubject[code] || []).map((s) => ({ ...s })));
    };
    const backToList = () => setSelectedCode(null);

    const updateSession = (idx: number, field: keyof ScheduleSession, val: string | number | boolean) =>
        setSessions((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: val } : s)));
    const addSession = () => setSessions((prev) => [...prev, { classDate: '', slot: 1, isOnline: false }]);
    const removeSession = (idx: number) => setSessions((prev) => prev.filter((_, i) => i !== idx));

    const saveSessions = () => {
        if (!selectedCode) return;
        if (sessions.some((s) => !s.classDate)) {
            showToast('⚠️ Có buổi học chưa chọn ngày');
            return;
        }
        setSaving(true);
        const slots = sessions.map((s) => ({ class_date: s.classDate, slot: s.slot, is_online: s.isOnline }));
        router.put(`/semesters/${semesterId}/subjects/${selectedCode}/schedule-slots`, asFormData({ slots }), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                showToast('✅ Đã lưu lịch học!');
                setSelectedCode(null);
            },
            onError: () => showToast('❌ Không thể lưu lịch học. Kiểm tra lại ngày/slot.'),
            onFinish: () => setSaving(false),
        });
    };

    const importIcs = (file: File) => {
        const form = new FormData();
        form.append('ics_file', file);
        setImporting(true);
        router.post(`/semesters/${semesterId}/schedule/import`, form, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                showToast('✅ Đã nhập lịch học từ file .ics!');
                onClose();
            },
            onError: (errors) => showToast(`❌ ${errors.ics_file || 'Không thể nhập file .ics'}`),
            onFinish: () => {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
        });
    };

    const q = query.trim().toLowerCase();
    const filteredSubjects = q
        ? subjects.filter((s) => s.name.toLowerCase().includes(q) || s.full.toLowerCase().includes(q))
        : subjects;

    const selectedSubject = selectedCode ? subjects.find((s) => s.id === selectedCode) : null;

    if (selectedSubject) {
        return (
            <ModalShell
                title={`🗓 ${selectedSubject.name}`}
                onClose={onClose}
                footer={
                    <>
                        <button style={{ ...css.chip, flex: 1, padding: '10px', justifyContent: 'center' }} onClick={backToList}>
                            ← Quay lại
                        </button>
                        <button
                            style={{ ...css.primaryBtn, flex: 2, justifyContent: 'center', opacity: saving ? 0.6 : 1 }}
                            onClick={saveSessions}
                            disabled={saving}
                        >
                            💾 {saving ? 'Đang lưu...' : 'Lưu'}
                        </button>
                    </>
                }
            >
                <div style={{ fontSize: 12, color: 'var(--home-text-dim)' }}>{selectedSubject.full}</div>
                {sessions.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--home-text-dim)', fontSize: 12, padding: '16px 0' }}>Chưa có buổi học nào</div>
                )}
                {sessions.map((s, i) => (
                    <div
                        key={i}
                        style={{ background: 'var(--home-input)', borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${selectedSubject.color}` }}
                    >
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                            <input
                                type="date"
                                value={s.classDate}
                                onChange={(e) => updateSession(i, 'classDate', e.target.value)}
                                style={{ ...css.input, flex: 1 }}
                            />
                            <button
                                onClick={() => removeSession(i)}
                                style={{
                                    background: '#EF444418',
                                    border: 'none',
                                    color: '#EF4444',
                                    borderRadius: 6,
                                    padding: '5px 8px',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <select
                                value={s.slot}
                                onChange={(e) => updateSession(i, 'slot', Number(e.target.value))}
                                style={{ ...css.select, flex: 1 }}
                            >
                                {[1, 2, 3, 4, 5].map((n) => (
                                    <option key={n} value={n}>
                                        Slot {n} ({SLOT_TIMES[n][0]}-{SLOT_TIMES[n][1]})
                                    </option>
                                ))}
                            </select>
                            <label style={{ fontSize: 11, color: 'var(--home-text-dim)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                                <input
                                    type="checkbox"
                                    checked={s.isOnline}
                                    onChange={(e) => updateSession(i, 'isOnline', e.target.checked)}
                                />
                                🌐 Online
                            </label>
                        </div>
                    </div>
                ))}
                <button style={css.smallBtn} onClick={addSession}>
                    + Thêm buổi học
                </button>
            </ModalShell>
        );
    }

    return (
        <ModalShell title="🗓 Lịch Học Theo Ngày" onClose={onClose}>
            <div style={{ background: 'var(--home-input)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--home-text-dim)', flex: 1 }}>Nhập lịch học tự động từ file .ics</span>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ics"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files?.[0] && importIcs(e.target.files[0])}
                />
                <button
                    style={{ ...css.smallBtn, opacity: importing ? 0.6 : 1 }}
                    disabled={importing}
                    onClick={() => fileInputRef.current?.click()}
                >
                    📥 {importing ? 'Đang nhập...' : 'Nhập file .ics'}
                </button>
            </div>
            <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="🔍 Tìm môn học..."
                style={css.input}
            />
            {filteredSubjects.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--home-text-dim)', fontSize: 12, padding: '16px 0' }}>Không tìm thấy môn học nào</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {filteredSubjects.map((s) => {
                    const count = (scheduleSlotsBySubject[s.id] || []).length;
                    return (
                        <div
                            key={s.id}
                            style={{ ...css.card, borderTop: `3px solid ${s.color}`, cursor: 'pointer', gap: 4 }}
                            onClick={() => openSubject(s.id)}
                        >
                            <div style={{ fontWeight: 800, fontSize: 13, color: s.color }}>{s.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--home-text-faint)' }}>{s.full}</div>
                            <div style={{ fontSize: 10, color: count ? 'var(--home-text-dim)' : 'var(--home-text-faint)', marginTop: 6 }}>
                                {count ? `${count} buổi học` : 'Chưa có buổi học'}
                            </div>
                        </div>
                    );
                })}
            </div>
            <button
                style={{
                    background: '#EF444418',
                    border: '1px solid #EF444430',
                    color: '#EF4444',
                    borderRadius: 10,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    opacity: deletingAll ? 0.6 : 1,
                }}
                disabled={deletingAll}
                onClick={deleteAllSchedule}
            >
                🗑 {deletingAll ? 'Đang xoá...' : 'Xoá toàn bộ lịch học'}
            </button>
        </ModalShell>
    );
}

function FeedbackModal({
    feedback,
    onClose,
    showToast,
}: {
    feedback: FeedbackItem[];
    onClose: () => void;
    showToast: (msg: string) => void;
}) {
    const [rating, setRating] = useState<number>(0);
    const [content, setContent] = useState<string>('');
    const [saving, setSaving] = useState(false);

    const submitFeedback = () => {
        if (rating < 1 || rating > 5) {
            showToast('⚠️ Vui lòng chọn số sao đánh giá');
            return;
        }
        if (!content.trim()) {
            showToast('⚠️ Vui lòng nhập nội dung phản hồi');
            return;
        }
        setSaving(true);
        router.post(
            '/feedback',
            { rating, content: content.trim() },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    showToast('✅ Cảm ơn bạn đã gửi phản hồi!');
                    onClose();
                },
                onError: () => showToast('❌ Không thể gửi phản hồi'),
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <ModalShell
            title="💬 Gửi Phản Hồi"
            onClose={onClose}
            footer={
                <>
                    <button style={{ ...css.chip, flex: 1, padding: '10px', justifyContent: 'center' }} onClick={onClose}>
                        Hủy
                    </button>
                    <button
                        style={{ ...css.primaryBtn, flex: 2, justifyContent: 'center', opacity: saving ? 0.6 : 1 }}
                        onClick={submitFeedback}
                        disabled={saving}
                    >
                        📤 {saving ? 'Đang gửi...' : 'Gửi'}
                    </button>
                </>
            }
        >
            <div style={{ fontSize: 12, color: 'var(--home-text-dim)' }}>Bạn đánh giá ứng dụng thế nào?</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        onClick={() => setRating(n)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 30,
                            lineHeight: 1,
                            color: n <= rating ? '#FBBF24' : 'var(--home-border-strong)',
                        }}
                    >
                        ★
                    </button>
                ))}
            </div>
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Góp ý, báo lỗi, hoặc đề xuất tính năng mới..."
                rows={7}
                maxLength={5000}
                style={{ ...css.input, resize: 'vertical', lineHeight: 1.6 }}
            />

            {feedback.length > 0 && (
                <>
                    <div style={{ borderTop: '1px solid var(--home-border)', paddingTop: 10, fontSize: 12, fontWeight: 700, color: 'var(--home-text-dim)' }}>
                        📋 Phản hồi trước đây ({feedback.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                        {feedback.map((f) => (
                            <div key={f.id} style={{ background: 'var(--home-input)', borderRadius: 10, padding: '9px 12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <span style={{ color: '#FBBF24', fontSize: 12 }}>
                                        {'★'.repeat(f.rating)}
                                        <span style={{ color: 'var(--home-border-strong)' }}>{'★'.repeat(5 - f.rating)}</span>
                                    </span>
                                    <span style={{ fontSize: 10, color: 'var(--home-text-faint)' }}>
                                        {new Date(f.createdAt).toLocaleString('vi-VN', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--home-text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{f.content}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </ModalShell>
    );
}

// ═══════════════════════════════════════════════════════════════════
// GLOBAL CSS
// ═══════════════════════════════════════════════════════════════════

const globalCss = `
    *, *::before, *::after { box-sizing: border-box; }
    input, select, textarea, button { font-family: inherit; }
    ::-webkit-scrollbar { width: 3px; }
    ::-webkit-scrollbar-thumb { background: var(--home-border-strong); border-radius: 4px; }
    .dark input[type="date"]::-webkit-calendar-picker-indicator,
    .dark input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
    @keyframes fadeUp   { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideUp  { from { opacity: 0; transform: translateY(50px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes bellWig  { 0%,100%{transform:rotate(0)} 20%{transform:rotate(18deg)} 40%{transform:rotate(-14deg)} 60%{transform:rotate(9deg)} 80%{transform:rotate(-4deg)} }
    @keyframes toastIn  { from { opacity: 0; transform: translateX(-50%) translateY(16px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
    @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.4} }
    .anim-fadeup  { animation: fadeUp  .22s ease forwards; }
    .anim-slideup { animation: slideUp .28s ease forwards; }
    .anim-bell    { animation: bellWig .55s ease; }
    .anim-pulse   { animation: pulse 2s ease-in-out infinite; }

    /* FullCalendar theming — bọc trong khung "cuốn lịch giấy" (card trắng, bo góc, đổ
       bóng) và chỉnh lại độ tương phản màu/chữ cho rõ ràng ở cả light & dark mode. */
    .fc-home-wrap {
        --fc-border-color: var(--home-border);
        --fc-page-bg-color: transparent;
        --fc-neutral-bg-color: var(--home-input);
        --fc-today-bg-color: transparent;
        width: 100%;
        max-width: 1100px;
        margin: 0 auto;
        background: var(--home-card);
        border: 1px solid var(--home-border);
        border-radius: 20px;
        padding: 18px;
        box-shadow: 0 14px 40px var(--home-shadow);
    }
    .fc { font-family: inherit; color: var(--home-text); }
    .fc .fc-toolbar { margin-bottom: 14px !important; padding-bottom: 14px; border-bottom: 1px solid var(--home-border); }
    .fc .fc-toolbar-title { font-size: 17px; font-weight: 800; color: var(--home-text); letter-spacing: 0.2px; }
    .fc .fc-button { background: var(--home-input); border: 1px solid var(--home-border); color: var(--home-text); box-shadow: none; text-transform: capitalize; font-weight: 600; }
    .fc .fc-button:hover { background: var(--home-border-strong); color: var(--home-text); }
    .fc .fc-button:focus { box-shadow: 0 0 0 3px #FF6B3530 !important; }
    .fc .fc-button:disabled { opacity: 0.4; }
    .fc .fc-prev-button, .fc .fc-next-button { border-radius: 50% !important; width: 30px; height: 30px; padding: 0 !important; display: inline-flex; align-items: center; justify-content: center; }
    .fc .fc-today-button { border-radius: 999px !important; padding: 6px 16px !important; }
    .fc .fc-button-primary:not(:disabled).fc-button-active { background: #FF6B35; border-color: #FF6B35; color: #fff; }
    .fc-theme-standard th { border-color: var(--home-border); }
    .fc-col-header { background: var(--home-input); border-radius: 10px; }
    .fc-col-header-cell-cushion { color: var(--home-text-soft); font-size: 11px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; text-decoration: none; padding: 8px 0; }
    .fc-day-sat .fc-col-header-cell-cushion, .fc-day-sun .fc-col-header-cell-cushion { color: #FF6B35; }
    .fc-daygrid-day-frame { padding: 2px; }
    .fc-daygrid-day-top { justify-content: flex-end; padding: 4px; }
    .fc-daygrid-day-number {
        color: var(--home-text);
        font-size: 12px;
        font-weight: 600;
        text-decoration: none;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
    }
    .fc-daygrid-day-number:hover { background: var(--home-input); }
    .fc-day-other .fc-daygrid-day-number { color: var(--home-text-faint); }
    .fc-day-sat, .fc-day-sun { background: var(--home-input); }
    .fc-day-today { background: #FF6B3512 !important; }
    .fc-day-today .fc-daygrid-day-number { background: #FF6B35; color: #fff; font-weight: 800; }
    .fc-day-today .fc-daygrid-day-number:hover { background: #FF6B35; }
    .fc-event {
        border-radius: 8px;
        font-size: 10.5px;
        font-weight: 600;
        padding: 2px 6px;
        border-width: 0;
        border-left-width: 3px;
        cursor: pointer;
        box-shadow: 0 1px 3px var(--home-shadow);
        transition: transform 0.12s ease, box-shadow 0.12s ease;
    }
    .fc-event:hover { transform: translateY(-1px); box-shadow: 0 4px 10px var(--home-shadow); }
    .fc-event-title, .fc-event-time { color: var(--home-text); white-space: normal !important; overflow: visible !important; text-overflow: clip !important; font-weight: 600; }
    .fc-daygrid-event { white-space: normal !important; align-items: flex-start !important; }
    .fc-daygrid-event-harness { margin-bottom: 3px !important; }
    .fc-daygrid-more-link { color: #FF6B35; font-size: 10px; font-weight: 700; }
    .fc-popover { background: var(--home-card); border: 1px solid var(--home-border-strong); border-radius: 14px; box-shadow: 0 10px 36px var(--home-shadow); overflow: hidden; }
    .fc-popover-header { background: var(--home-input); color: var(--home-text); font-weight: 700; padding: 8px 10px; }
    .fc-popover-close { color: var(--home-text-faint); }
    @media (max-width: 640px) {
        .fc-home-wrap { padding: 10px; border-radius: 14px; }
        .fc .fc-toolbar-title { font-size: 15px; }
    }
`;

// ═══════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════

const css: Record<string, CSSProperties> = {
    root: { background: 'var(--home-bg)', minHeight: '100vh', color: 'var(--home-text)', position: 'relative' },
    bgDots: {
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        backgroundImage: 'radial-gradient(var(--home-border-faint) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
    },
    main: { position: 'relative', zIndex: 10, paddingTop: 8, paddingBottom: 36 },
    tab: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 11 },
    demoBanner: {
        position: 'relative',
        zIndex: 10,
        margin: '8px 14px 0',
        padding: '9px 13px',
        borderRadius: 10,
        background: '#FF6B3512',
        border: '1px solid #FF6B3530',
        fontSize: 12,
        color: 'var(--home-text-soft)',
        textAlign: 'center',
    },
    header: {
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '11px 18px',
        background: 'var(--home-bg-translucent)',
        backdropFilter: 'blur(18px)',
        borderBottom: '1px solid var(--home-border)',
    },
    iconBtn: {
        background: 'var(--home-border)',
        borderRadius: 10,
        padding: '7px 10px',
        fontSize: 18,
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bellBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        background: '#EF4444',
        color: '#fff',
        borderRadius: 10,
        fontSize: 9,
        padding: '1px 4px',
        fontWeight: 700,
        minWidth: 16,
        textAlign: 'center',
    },
    bellPanel: {
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 284,
        background: 'var(--home-card)',
        border: '1px solid var(--home-border-strong)',
        borderRadius: 14,
        zIndex: 300,
        overflow: 'hidden',
        boxShadow: '0 10px 36px var(--home-shadow)',
    },
    weekBadge: { textAlign: 'center', background: '#FF6B3512', border: '1px solid #FF6B3528', borderRadius: 10, padding: '4px 13px' },
    nav: {
        position: 'sticky',
        top: 58,
        zIndex: 90,
        display: 'flex',
        background: 'var(--home-bg-translucent)',
        backdropFilter: 'blur(18px)',
        borderBottom: '1px solid var(--home-border)',
    },
    navBtn: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '8px 4px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'color .15s',
    },
    navBadge: {
        position: 'absolute',
        top: 4,
        left: '50%',
        transform: 'translateX(6px)',
        background: '#EF4444',
        color: '#fff',
        borderRadius: 10,
        fontSize: 9,
        padding: '1px 4px',
        fontWeight: 700,
    },
    navLine: {
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 18,
        height: 2,
        background: '#FF6B35',
        borderRadius: 2,
    },
    card: {
        background: 'var(--home-card)',
        border: '1px solid var(--home-border)',
        borderRadius: 13,
        padding: '12px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    cardTitle: { fontWeight: 700, fontSize: 14 },
    input: {
        background: 'var(--home-input)',
        border: '1px solid var(--home-border)',
        color: 'var(--home-text)',
        padding: '8px 10px',
        borderRadius: 8,
        fontSize: 12,
        width: '100%',
        outline: 'none',
    },
    select: {
        background: 'var(--home-input)',
        border: '1px solid var(--home-border)',
        color: 'var(--home-text)',
        padding: '8px 10px',
        borderRadius: 8,
        fontSize: 12,
        width: '100%',
    },
    primaryBtn: {
        background: '#FF6B35',
        border: 'none',
        color: '#fff',
        padding: '8px 16px',
        borderRadius: 8,
        fontWeight: 700,
        cursor: 'pointer',
        fontSize: 13,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
    },
    smallBtn: {
        fontSize: 10,
        background: 'none',
        border: '1px solid var(--home-border)',
        color: 'var(--home-text-dim)',
        padding: '3px 8px',
        borderRadius: 6,
        cursor: 'pointer',
    },
    chip: {
        background: 'var(--home-border)',
        border: '1px solid var(--home-border)',
        color: 'var(--home-text-dim)',
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: 10,
        cursor: 'pointer',
        fontWeight: 600,
    },
    arrowBtn: {
        background: 'var(--home-border)',
        border: '1px solid var(--home-border)',
        color: '#fff',
        borderRadius: 8,
        width: 36,
        height: 36,
        fontSize: 22,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    nowTag: { background: '#FF6B35', color: '#fff', fontSize: 9, padding: '2px 7px', borderRadius: 20, fontWeight: 700 },
    overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,.82)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 10,
    },
    modal: {
        background: 'var(--home-card)',
        border: '1px solid var(--home-border)',
        borderRadius: 20,
        width: '100%',
        maxWidth: 460,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    closeBtn: { background: 'none', border: 'none', color: 'var(--home-text-faint)', fontSize: 18, cursor: 'pointer' },
    toast: {
        position: 'fixed',
        bottom: 22,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--home-input)',
        border: '1px solid #FF6B3540',
        color: '#fff',
        padding: '9px 22px',
        borderRadius: 22,
        zIndex: 400,
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 20px var(--home-shadow)',
        animation: 'toastIn .22s ease forwards',
    },
};
