'use client';

import { Link, usePage } from '@inertiajs/react';
import React, { CSSProperties, useEffect, useMemo, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface Subject {
    id: string;
    name: string;
    full: string;
    color: string;
}

interface PageProps {
    auth: {
        user: {
            id: number;
            name: string;
            email: string;
        } | null;
    };
    [key: string]: unknown; // để không lỗi khi Inertia có thêm props khác (errors, ziggy...)
}

type Schedule = Record<number, string[]>; // day (1-5) -> subject ids
type OnlineDays = Record<number, number[]>; // week -> days online

interface Task {
    id: number;
    subject: string;
    text: string;
    deadline: string;
    done: boolean;
    createdAt: string;
}

type Notes = Record<string, string>; // subjectId -> note text

interface ExamEntry {
    date?: string;
    time?: string;
    room?: string;
    type?: string;
}
type ExamData = Record<string, ExamEntry>; // `w{week}_{subjectId}` -> entry

type ModalState = string | null;
type TabId = 'schedule' | 'tasks' | 'notes' | 'settings';

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
const DAY_SHORT: Record<number, string> = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6' };
const STUDY_WEEKS = 7;
const TOTAL_WEEKS = 9; // 7 study + 2 exam

const DEFAULT_SUBJECTS: Subject[] = [
    { id: 'SSA101', name: 'SSA101', full: 'Soft Skills & Academic', color: '#FF6B35' },
    { id: 'CSI106', name: 'CSI106', full: 'Computer Science Intro', color: '#00C6FF' },
    { id: 'PRF192', name: 'PRF192', full: 'Programming Fundamentals', color: '#A78BFA' },
    { id: 'MAE101', name: 'MAE101', full: 'Mathematics for Engineering', color: '#34D399' },
    { id: 'CEA201', name: 'CEA201', full: 'Computer Engineering Architecture', color: '#FBBF24' },
];

const DEFAULT_SCHEDULE: Schedule = {
    1: ['SSA101', 'CSI106'],
    2: ['PRF192', 'MAE101'],
    3: ['CEA201', 'SSA101'],
    4: ['MAE101', 'PRF192'],
    5: ['CSI106', 'CEA201'],
};

function buildDefaultOnline(): OnlineDays {
    const map: OnlineDays = {};
    for (let w = 1; w <= STUDY_WEEKS; w++) {
        if (w <= 2) map[w] = [];
        else if (w % 2 === 1) map[w] = [2, 4];
        else map[w] = [1, 3, 5];
    }
    return map;
}

// ── Date helpers ─────────────────────────────────────────────────
function getMondayOf(dateStr: string): Date {
    const d = new Date(dateStr);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d;
}

function getWeekMonday(semStart: string, weekNum: number): Date {
    const d = new Date(semStart);
    d.setDate(d.getDate() + (weekNum - 1) * 7);
    return d;
}

function getDayDate(monday: Date, dow: number): Date {
    const d = new Date(monday);
    d.setDate(d.getDate() + dow - 1);
    return d;
}

function fmtDMY(d: Date): string {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isToday(d: Date): boolean {
    const n = new Date();
    return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
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

// ── LocalStorage helpers ─────────────────────────────────────────
function load<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
        const v = localStorage.getItem(key);
        return v ? (JSON.parse(v) as T) : fallback;
    } catch {
        return fallback;
    }
}
function save<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {}
}

// ═══════════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function Home() {
    // ── Persistent state ──────────────────────────────────────────
    const [semStart, setSemStartRaw] = useState<string>(() => {
        if (typeof window === 'undefined') return new Date().toISOString().split('T')[0];
        const saved = localStorage.getItem('fpt3_semStart');
        if (saved) return saved;
        const d = getMondayOf(new Date().toISOString().split('T')[0]);
        return d.toISOString().split('T')[0];
    });
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;

    const [subjects, setSubjects] = useState<Subject[]>(() => load('fpt3_subjects', DEFAULT_SUBJECTS));
    const [schedule, setSchedule] = useState<Schedule>(() => load('fpt3_schedule', DEFAULT_SCHEDULE));
    const [onlineDays, setOnlineDays] = useState<OnlineDays>(() => load('fpt3_online', null as unknown as OnlineDays) ?? buildDefaultOnline());
    const [tasks, setTasks] = useState<Task[]>(() => load('fpt3_tasks', [] as Task[]));
    const [notes, setNotes] = useState<Notes>(() => load('fpt3_notes', {} as Notes));
    const [examData, setExamData] = useState<ExamData>(() => load('fpt3_exam', {} as ExamData));

    // ── UI state ──────────────────────────────────────────────────
    const [tab, setTab] = useState<TabId>('schedule');
    const [weekView, setWeekView] = useState<number>(1);
    const [toast, setToast] = useState<string | null>(null);
    const [bellOpen, setBellOpen] = useState<boolean>(false);
    const [bellAnim, setBellAnim] = useState<boolean>(false);

    // Modals: null = closed, string = open ('note:<subjectId>' | 'exam' | 'subjects' | 'schedule' | 'online')
    const [modal, setModal] = useState<ModalState>(null);

    // ── Persist on change ─────────────────────────────────────────
    useEffect(() => save('fpt3_semStart', semStart), [semStart]);
    useEffect(() => save('fpt3_subjects', subjects), [subjects]);
    useEffect(() => save('fpt3_schedule', schedule), [schedule]);
    useEffect(() => save('fpt3_online', onlineDays), [onlineDays]);
    useEffect(() => save('fpt3_tasks', tasks), [tasks]);
    useEffect(() => save('fpt3_notes', notes), [notes]);
    useEffect(() => save('fpt3_exam', examData), [examData]);

    // ── Derived: current week number ──────────────────────────────
    const currentWeek = useMemo(() => {
        const start = new Date(semStart);
        start.setHours(0, 0, 0, 0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const diff = Math.floor((now.getTime() - start.getTime()) / (7 * 86400000)) + 1;
        return Math.max(1, Math.min(TOTAL_WEEKS, diff));
    }, [semStart]);

    // Sync weekView to current week on first load
    useEffect(() => {
        setWeekView(currentWeek);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Subject map for fast lookup ────────────────────────────────
    const subjectMap = useMemo(() => {
        const m: Record<string, Subject> = {};
        subjects.forEach((s) => {
            m[s.id] = s;
        });
        return m;
    }, [subjects]);

    // ── Bell: urgent tasks (deadline < 24h) ───────────────────────
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

    // ── Toast helper ──────────────────────────────────────────────
    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2800);
    };

    // ── Set semester start (always snap to Monday) ─────────────────
    const setSemStart = (dateStr: string) => {
        const monday = getMondayOf(dateStr);
        setSemStartRaw(monday.toISOString().split('T')[0]);
    };

    // ── Open / close helpers ──────────────────────────────────────
    const openModal = (id: string) => setModal(id);
    const closeModal = () => setModal(null);

    // ── Render ────────────────────────────────────────────────────
    return (
        <div style={css.root}>
            <style>{globalCss}</style>

            <div style={css.bgDots} />

            <Header
                currentWeek={currentWeek}
                pendingCount={pendingTasks.length}
                urgentCount={urgentTasks.length}
                bellAnim={bellAnim}
                bellOpen={bellOpen}
                setBellOpen={setBellOpen}
                pendingTasks={pendingTasks}
                user={user}
            />

            {/* ── Bottom Nav ── */}
            <BottomNav tab={tab} setTab={setTab} pendingCount={pendingTasks.length} />

            {/* ── Main Content ── */}
            <main style={css.main}>
                {tab === 'schedule' && (
                    <ScheduleTab
                        semStart={semStart}
                        currentWeek={currentWeek}
                        weekView={weekView}
                        setWeekView={setWeekView}
                        subjects={subjects}
                        subjectMap={subjectMap}
                        schedule={schedule}
                        onlineDays={onlineDays}
                        examData={examData}
                        notes={notes}
                        openModal={openModal}
                    />
                )}
                {tab === 'tasks' && <TasksTab tasks={tasks} setTasks={setTasks} subjects={subjects} subjectMap={subjectMap} showToast={showToast} />}
                {tab === 'notes' && <NotesTab subjects={subjects} notes={notes} openModal={openModal} />}
                {tab === 'settings' && <SettingsTab semStart={semStart} setSemStart={setSemStart} currentWeek={currentWeek} openModal={openModal} />}
            </main>

            {/* ── Modals ── */}
            {modal === 'exam' && (
                <ExamModal examData={examData} setExamData={setExamData} subjects={subjects} onClose={closeModal} showToast={showToast} />
            )}
            {modal === 'subjects' && <SubjectsModal subjects={subjects} setSubjects={setSubjects} onClose={closeModal} showToast={showToast} />}
            {modal === 'schedule' && (
                <ScheduleModal schedule={schedule} setSchedule={setSchedule} subjects={subjects} onClose={closeModal} showToast={showToast} />
            )}
            {modal === 'online' && <OnlineModal onlineDays={onlineDays} setOnlineDays={setOnlineDays} onClose={closeModal} showToast={showToast} />}
            {modal && modal.startsWith('note:') && (
                <NoteModal subjectId={modal.slice(5)} subjectMap={subjectMap} notes={notes} setNotes={setNotes} onClose={closeModal} />
            )}

            {/* ── Toast ── */}
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
    pendingCount: number;
    urgentCount: number;
    bellAnim: boolean;
    bellOpen: boolean;
    setBellOpen: React.Dispatch<React.SetStateAction<boolean>>;
    pendingTasks: Task[];
}

function Header({ currentWeek, urgentCount, bellAnim, bellOpen, setBellOpen, pendingTasks, user }) {
    const isExam = currentWeek > STUDY_WEEKS;
    const label = isExam ? `THI ${currentWeek - STUDY_WEEKS}` : `W${currentWeek}`;
    const sublabel = isExam ? 'TUẦN THI' : 'TUẦN HỌC';

    return (
        <header style={css.header}>
            {/* Logo */}
            <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#FF6B35', letterSpacing: -1 }}>FPT</span>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>TIME</span>
                </div>
                <div style={{ fontSize: 9, color: '#444', letterSpacing: 2.5, textTransform: 'uppercase', marginTop: 1 }}>Management Toolkit</div>
            </div>

            {/* Right side */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {user ? (
                    <button className="flex items-center gap-1.5 rounded-lg border border-[#34D39930] bg-[#34D39912] px-3 py-1.5 text-xs font-bold text-[#34D399]">
                        👤 {user.name}
                    </button>
                ) : (
                    <Link
                        href="/login"
                        className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-500 hover:bg-orange-500/20 active:scale-95"
                    >
                        🔐 Đăng nhập
                    </Link>
                )}
                {/* Bell button */}
                <div style={{ position: 'relative' }}>
                    <button
                        className={bellAnim ? 'anim-bell' : ''}
                        style={{
                            ...css.iconBtn,
                            color: urgentCount > 0 ? '#FBBF24' : '#888',
                            border: `1px solid ${urgentCount > 0 ? '#FBBF2430' : '#ffffff12'}`,
                        }}
                        onClick={() => setBellOpen((o) => !o)}
                    >
                        🔔
                        {urgentCount > 0 && <span style={css.bellBadge}>{urgentCount}</span>}
                    </button>

                    {/* Bell dropdown */}
                    {bellOpen && <BellPanel tasks={pendingTasks} onClose={() => setBellOpen(false)} />}
                </div>

                {/* Week badge */}
                <div style={css.weekBadge}>
                    <div style={{ fontSize: 8, color: '#FF6B3580', letterSpacing: 2, textTransform: 'uppercase' }}>{sublabel}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#FF6B35', lineHeight: 1.1 }}>{label}</div>
                </div>
            </div>
        </header>
    );
}

// ── Bell Panel ────────────────────────────────────────────────────

interface BellPanelProps {
    tasks: Task[];
    onClose: () => void;
}

function BellPanel({ tasks, onClose }: BellPanelProps) {
    const [now, setNow] = useState<Date>(new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const withDl = [...tasks].filter((t) => t.deadline).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    const noDl = tasks.filter((t) => !t.deadline);

    return (
        <div style={css.bellPanel} className="anim-fadeup">
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderBottom: '1px solid #ffffff0f',
                }}
            >
                <span style={{ fontWeight: 700, fontSize: 13 }}>⏰ Deadline Tasks</span>
                <button style={css.closeBtn} onClick={onClose}>
                    ✕
                </button>
            </div>

            {/* Empty */}
            {tasks.length === 0 && <div style={{ padding: '28px 14px', textAlign: 'center', color: '#444', fontSize: 13 }}>Không có task nào 🎉</div>}

            {/* Tasks with deadline */}
            {withDl.map((t) => {
                const ms = new Date(t.deadline).getTime() - now.getTime();
                const over = ms <= 0;
                const warn = !over && ms < 3600000; // < 1h
                const color = over ? '#EF4444' : warn ? '#FBBF24' : '#34D399';
                return (
                    <div key={t.id} style={{ padding: '9px 14px', borderBottom: '1px solid #ffffff08' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: over ? '#EF4444' : '#e2e2f0' }}>{t.text}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: '#555' }}>{t.subject}</span>
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

            {/* Tasks without deadline */}
            {noDl.length > 0 && <div style={{ padding: '7px 14px', fontSize: 11, color: '#444' }}>+{noDl.length} task chưa có deadline</div>}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// BOTTOM NAV
// ═══════════════════════════════════════════════════════════════════

interface BottomNavProps {
    tab: TabId;
    setTab: React.Dispatch<React.SetStateAction<TabId>>;
    pendingCount: number;
}

function BottomNav({ tab, setTab, pendingCount }: BottomNavProps) {
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
                    <button key={item.id} style={{ ...css.navBtn, color: active ? '#FF6B35' : '#555' }} onClick={() => setTab(item.id)}>
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
// SCHEDULE TAB
// ═══════════════════════════════════════════════════════════════════

interface ScheduleTabProps {
    semStart: string;
    currentWeek: number;
    weekView: number;
    setWeekView: React.Dispatch<React.SetStateAction<number>>;
    subjects: Subject[];
    subjectMap: Record<string, Subject>;
    schedule: Schedule;
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
    subjects,
    subjectMap,
    schedule,
    onlineDays,
    examData,
    notes,
    openModal,
}: ScheduleTabProps) {
    const monday = getWeekMonday(semStart, weekView);
    const isExam = weekView > STUDY_WEEKS;

    return (
        <div style={css.tab} className="anim-fadeup">
            {/* Week navigator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button style={css.arrowBtn} onClick={() => setWeekView((w) => Math.max(1, w - 1))}>
                    ‹
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                        {isExam ? `🎯 TUẦN THI ${weekView - STUDY_WEEKS}` : `📚 TUẦN ${weekView}`}
                        {weekView === currentWeek && <span style={css.nowTag}>Hiện tại</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                        {fmtDMY(monday)} – {fmtDMY(getDayDate(monday, 5))}
                    </div>
                </div>
                <button style={css.arrowBtn} onClick={() => setWeekView((w) => Math.min(TOTAL_WEEKS, w + 1))}>
                    ›
                </button>
            </div>

            {/* Week pills */}
            <WeekPills weekView={weekView} setWeekView={setWeekView} currentWeek={currentWeek} />

            {/* Mode legend */}
            {!isExam && (
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                    {[
                        ['#00C6FF', '🌐 Online'],
                        ['#FF6B35', '🏫 Offline'],
                    ].map(([c, l]) => (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#777' }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
                            {l}
                        </div>
                    ))}
                </div>
            )}

            {/* Content */}
            {isExam ? (
                <ExamWeek weekView={weekView} examData={examData} subjects={subjects} openModal={openModal} notes={notes} />
            ) : (
                <StudyWeek
                    weekView={weekView}
                    monday={monday}
                    subjectMap={subjectMap}
                    schedule={schedule}
                    onlineDays={onlineDays}
                    notes={notes}
                    openModal={openModal}
                />
            )}
        </div>
    );
}

// ── Week Pills ────────────────────────────────────────────────────

interface WeekPillsProps {
    weekView: number;
    setWeekView: React.Dispatch<React.SetStateAction<number>>;
    currentWeek: number;
}

function WeekPills({ weekView, setWeekView, currentWeek }: WeekPillsProps) {
    return (
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
            {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((w) => {
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
                            color: isActive ? '#fff' : isExam ? '#FBBF24' : isCurrent ? '#FF6B35' : '#555',
                            border: isActive ? 'none' : isCurrent ? '1px solid #FF6B3560' : isExam ? '1px solid #FBBF2440' : '1px solid #ffffff10',
                        }}
                    >
                        {w > STUDY_WEEKS ? `T${w - STUDY_WEEKS}` : w}
                    </button>
                );
            })}
        </div>
    );
}

// ── Study Week ────────────────────────────────────────────────────

interface StudyWeekProps {
    weekView: number;
    monday: Date;
    subjectMap: Record<string, Subject>;
    schedule: Schedule;
    onlineDays: OnlineDays;
    notes: Notes;
    openModal: (id: string) => void;
}

function StudyWeek({ weekView, monday, subjectMap, schedule, onlineDays, notes, openModal }: StudyWeekProps) {
    const onDays = onlineDays[weekView] || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5].map((dow) => {
                const date = getDayDate(monday, dow);
                const today = isToday(date);
                const online = onDays.includes(dow);
                const slots = schedule[dow] || [];

                return (
                    <div
                        key={dow}
                        style={{
                            ...css.card,
                            ...(today ? { border: '1px solid #FF6B3540', boxShadow: '0 0 20px #FF6B3310' } : {}),
                        }}
                    >
                        {/* Day header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <span style={{ fontWeight: 800, fontSize: 13 }}>{DAY_NAMES[dow]}</span>
                            <span style={{ fontSize: 11, color: '#555', flex: 1 }}>
                                {fmtDMY(date)}
                                {today && (
                                    <span className="anim-pulse" style={{ color: '#FF6B35', marginLeft: 6, fontSize: 9 }}>
                                        ●
                                    </span>
                                )}
                            </span>
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '2px 9px',
                                    borderRadius: 20,
                                    background: online ? '#00C6FF14' : '#FF6B3514',
                                    color: online ? '#00C6FF' : '#FF6B35',
                                    border: `1px solid ${online ? '#00C6FF30' : '#FF6B3530'}`,
                                }}
                            >
                                {online ? '🌐 Online' : '🏫 Offline'}
                            </span>
                        </div>

                        {/* Slots */}
                        {slots.length === 0 && <div style={{ fontSize: 11, color: '#444', fontStyle: 'italic' }}>Không có lịch học</div>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                            {slots.map((sid, i) => {
                                const sub = subjectMap[sid];
                                if (!sub) return null;
                                const hasNote = !!(notes[sid] && notes[sid].trim());
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
                                            <span style={{ fontSize: 9, color: '#555' }}>SLOT {i + 1}</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: '#888', marginBottom: 7 }}>{sub.full}</div>
                                        <button style={css.smallBtn} onClick={() => openModal(`note:${sid}`)}>
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

// ── Exam Week ─────────────────────────────────────────────────────

interface ExamWeekProps {
    weekView: number;
    examData: ExamData;
    subjects: Subject[];
    openModal: (id: string) => void;
    notes: Notes;
}

function ExamWeek({ weekView, examData, subjects, openModal, notes }: ExamWeekProps) {
    const examWeekNum = weekView - STUDY_WEEKS;

    return (
        <div>
            {/* Banner */}
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
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Chỉnh sửa theo thông báo chính thức</div>
                </div>
                <button style={{ ...css.smallBtn, color: '#FBBF24', borderColor: '#FBBF2440' }} onClick={() => openModal('exam')}>
                    ✏️ Sửa
                </button>
            </div>

            {/* Subject cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {subjects.map((sub) => {
                    const key = `w${weekView}_${sub.id}`;
                    const exam = examData[key];
                    const hasNote = !!(notes[sub.id] && notes[sub.id].trim());
                    return (
                        <div key={sub.id} style={{ ...css.card, borderTop: `3px solid ${sub.color}`, gap: 0 }}>
                            <div style={{ color: sub.color, fontWeight: 800, fontSize: 13, marginBottom: 2 }}>{sub.name}</div>
                            <div style={{ fontSize: 10, color: '#666', marginBottom: 8 }}>{sub.full}</div>
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
                                            <div key={icon} style={{ fontSize: 11, color: '#ccc' }}>
                                                {icon} {val}
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: 11, color: '#444', fontStyle: 'italic', marginBottom: 8 }}>Chưa có lịch thi</div>
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

// ═══════════════════════════════════════════════════════════════════
// TASKS TAB
// ═══════════════════════════════════════════════════════════════════

interface TasksTabProps {
    tasks: Task[];
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    subjects: Subject[];
    subjectMap: Record<string, Subject>;
    showToast: (msg: string) => void;
}

function TasksTab({ tasks, setTasks, subjects, subjectMap, showToast }: TasksTabProps) {
    const [newSub, setNewSub] = useState<string>(subjects[0]?.id || '');
    const [newText, setNewText] = useState<string>('');
    const [newDl, setNewDl] = useState<string>('');
    const [filter, setFilter] = useState<string>('ALL');

    // Sync default subject when subjects change
    useEffect(() => {
        if (!subjects.find((s) => s.id === newSub)) setNewSub(subjects[0]?.id || '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subjects]);

    const addTask = () => {
        if (!newText.trim()) return;
        setTasks((prev) => [
            {
                id: Date.now(),
                subject: newSub,
                text: newText.trim(),
                deadline: newDl,
                done: false,
                createdAt: new Date().toISOString(),
            },
            ...prev,
        ]);
        setNewText('');
        setNewDl('');
        showToast('✅ Đã thêm task!');
    };

    const toggleTask = (id: number) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    const deleteTask = (id: number) => {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        showToast('🗑 Đã xóa');
    };
    const isOverdue = (dl: string) => !!dl && new Date(dl) < new Date();

    const filtered = filter === 'ALL' ? tasks : tasks.filter((t) => t.subject === filter);
    const pending = filtered.filter((t) => !t.done);
    const done = filtered.filter((t) => t.done);

    return (
        <div style={css.tab} className="anim-fadeup">
            {/* Add task */}
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
                    placeholder="Mô tả nhiệm vụ..."
                    style={css.input}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                    <input type="datetime-local" value={newDl} onChange={(e) => setNewDl(e.target.value)} style={{ ...css.input, flex: 1 }} />
                    <button style={css.primaryBtn} onClick={addTask}>
                        Thêm
                    </button>
                </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 8 }}>
                {[
                    { label: 'Cần làm', val: tasks.filter((t) => !t.done).length, color: '#FF6B35' },
                    { label: 'Hoàn thành', val: tasks.filter((t) => t.done).length, color: '#34D399' },
                    { label: 'Quá hạn', val: tasks.filter((t) => !t.done && isOverdue(t.deadline)).length, color: '#EF4444' },
                ].map((s) => (
                    <div key={s.label} style={{ flex: 1, ...css.card, padding: '10px', textAlign: 'center', gap: 2 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 10, color: '#666' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['ALL', ...subjects.map((s) => s.id)].map((f) => {
                    const active = f === filter;
                    const color = f === 'ALL' ? '#fff' : subjectMap[f]?.color || '#888';
                    return (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                ...css.chip,
                                background: active ? (f === 'ALL' ? '#fff' : color) : 'transparent',
                                color: active ? (f === 'ALL' ? '#06061a' : '#fff') : '#666',
                                border: `1px solid ${active ? 'transparent' : '#ffffff12'}`,
                            }}
                        >
                            {f}
                        </button>
                    );
                })}
            </div>

            {/* Task list */}
            {pending.length === 0 && done.length === 0 && (
                <div style={{ textAlign: 'center', color: '#333', padding: '48px 0', fontSize: 14 }}>Không có task nào 🎉</div>
            )}

            {pending.map((t) => (
                <TaskRow key={t.id} task={t} subjectMap={subjectMap} onToggle={toggleTask} onDelete={deleteTask} overdue={isOverdue(t.deadline)} />
            ))}

            {done.length > 0 && (
                <>
                    <div style={{ fontSize: 11, color: '#444', fontWeight: 700, padding: '4px 0', borderTop: '1px solid #ffffff0a' }}>
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

interface TaskRowProps {
    task: Task;
    subjectMap: Record<string, Subject>;
    onToggle: (id: number) => void;
    onDelete: (id: number) => void;
    overdue: boolean;
}

function TaskRow({ task, subjectMap, onToggle, onDelete, overdue }: TaskRowProps) {
    const sub = subjectMap[task.subject] || { color: '#888' };
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                background: '#0d0d22',
                border: `1px solid ${overdue && !task.done ? '#EF444430' : '#ffffff0a'}`,
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
                        <span style={{ fontSize: 10, color: overdue && !task.done ? '#EF4444' : '#555' }}>
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

interface NotesTabProps {
    subjects: Subject[];
    notes: Notes;
    openModal: (id: string) => void;
}

function NotesTab({ subjects, notes, openModal }: NotesTabProps) {
    return (
        <div style={css.tab} className="anim-fadeup">
            <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>Nhấn vào môn để xem hoặc chỉnh sửa ghi chú</div>
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
                            <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>{sub.full}</div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: note ? '#bbb' : '#444',
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

interface SettingsTabProps {
    semStart: string;
    setSemStart: (dateStr: string) => void;
    currentWeek: number;
    openModal: (id: string) => void;
}

function SettingsTab({ semStart, setSemStart, currentWeek, openModal }: SettingsTabProps) {
    return (
        <div style={css.tab} className="anim-fadeup">
            {/* Semester start */}
            <div style={css.card}>
                <div style={css.cardTitle}>📅 Ngày Bắt Đầu Học Kỳ</div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>Chọn ngày Thứ 2 của tuần đầu tiên</div>
                <input type="date" value={semStart} onChange={(e) => setSemStart(e.target.value)} style={css.input} />
                <div style={{ fontSize: 12, color: '#888' }}>
                    Tuần hiện tại:{' '}
                    <strong style={{ color: '#FF6B35' }}>
                        {currentWeek <= STUDY_WEEKS ? `Tuần ${currentWeek}` : `Tuần thi ${currentWeek - STUDY_WEEKS}`}
                    </strong>
                </div>
            </div>

            {/* Quick settings */}
            <div style={css.card}>
                <div style={css.cardTitle}>⚙️ Tuỳ Chỉnh</div>
                {[
                    { icon: '📚', label: 'Quản lý môn học', sub: 'Thêm, sửa, xóa, đổi màu môn', id: 'subjects' },
                    { icon: '🗓', label: 'Lịch học theo ngày', sub: 'Chỉnh slot môn cho từng thứ', id: 'schedule' },
                    { icon: '🌐', label: 'Lịch Online / Offline', sub: 'Tuỳ chỉnh từng ngày trong từng tuần', id: 'online' },
                ].map((item) => (
                    <button
                        key={item.id}
                        onClick={() => openModal(item.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            width: '100%',
                            background: '#1a1a32',
                            border: '1px solid #ffffff0a',
                            borderRadius: 10,
                            padding: '11px 13px',
                            cursor: 'pointer',
                            textAlign: 'left',
                        }}
                    >
                        <span style={{ fontSize: 22 }}>{item.icon}</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#e2e2f0' }}>{item.label}</div>
                            <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{item.sub}</div>
                        </div>
                        <span style={{ color: '#444', fontSize: 18 }}>›</span>
                    </button>
                ))}
            </div>

            {/* Progress */}
            <div style={css.card}>
                <div style={css.cardTitle}>📊 Tiến Độ Học Kỳ</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                    {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((w) => {
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
                                    background: isCur ? '#FF6B35' : isPast ? '#ffffff12' : '#ffffff06',
                                    border: `1px solid ${isCur ? '#FF6B35' : isExam ? '#FBBF2428' : '#ffffff0a'}`,
                                }}
                            >
                                <div style={{ fontSize: 10, fontWeight: 800, color: isCur ? '#fff' : isExam ? '#FBBF24' : isPast ? '#888' : '#444' }}>
                                    {isExam ? `T${w - STUDY_WEEKS}` : `W${w}`}
                                </div>
                                <div style={{ fontSize: 8, color: isCur ? '#fff8' : '#444', marginTop: 1 }}>
                                    {isExam ? 'THI' : isCur ? 'NOW' : isPast ? '✓' : '·'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: 11, color: '#333', paddingTop: 4 }}>FPT Time Management Toolkit v3</div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════

// ── Modal Shell ───────────────────────────────────────────────────

interface ModalShellProps {
    title: React.ReactNode;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

function ModalShell({ title, onClose, children, footer }: ModalShellProps) {
    return (
        <div style={css.overlay}>
            <div style={css.modal} className="anim-slideup">
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '13px 16px',
                        borderBottom: '1px solid #ffffff0f',
                    }}
                >
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
                    <button style={css.closeBtn} onClick={onClose}>
                        ✕
                    </button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
                {footer && <div style={{ display: 'flex', gap: 8, padding: '11px 16px', borderTop: '1px solid #ffffff0f' }}>{footer}</div>}
            </div>
        </div>
    );
}

// ── Note Modal ────────────────────────────────────────────────────

interface NoteModalProps {
    subjectId: string;
    subjectMap: Record<string, Subject>;
    notes: Notes;
    setNotes: React.Dispatch<React.SetStateAction<Notes>>;
    onClose: () => void;
}

function NoteModal({ subjectId, subjectMap, notes, setNotes, onClose }: NoteModalProps) {
    const sub = subjectMap[subjectId] || { color: '#888', name: subjectId, full: '', id: subjectId };
    const [text, setText] = useState<string>(notes[subjectId] || '');

    const saveNote = () => {
        setNotes((n) => ({ ...n, [subjectId]: text }));
        onClose();
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
                    <button style={{ ...css.primaryBtn, flex: 2, justifyContent: 'center', background: sub.color }} onClick={saveNote}>
                        💾 Lưu
                    </button>
                </>
            }
        >
            <div style={{ fontSize: 11, color: '#555' }}>{sub.full}</div>
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Nội dung, bài tập, công thức cần nhớ..."
                rows={9}
                style={{
                    ...css.input,
                    resize: 'vertical',
                    lineHeight: 1.65,
                    border: `1px solid ${sub.color}28`,
                }}
            />
        </ModalShell>
    );
}

// ── Exam Modal ────────────────────────────────────────────────────

interface ExamModalProps {
    examData: ExamData;
    setExamData: React.Dispatch<React.SetStateAction<ExamData>>;
    subjects: Subject[];
    onClose: () => void;
    showToast: (msg: string) => void;
}

function ExamModal({ examData, setExamData, subjects, onClose, showToast }: ExamModalProps) {
    const [local, setLocal] = useState<ExamData>(() => JSON.parse(JSON.stringify(examData)));
    const [activeW, setActiveW] = useState<number>(STUDY_WEEKS + 1);

    const update = (subId: string, field: keyof ExamEntry, val: string) => {
        const key = `w${activeW}_${subId}`;
        setLocal((prev) => ({ ...prev, [key]: { ...prev[key], [field]: val } }));
    };
    const saveExam = () => {
        setExamData(local);
        showToast('✅ Đã lưu lịch thi!');
        onClose();
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
                    <button style={{ ...css.primaryBtn, flex: 2, justifyContent: 'center' }} onClick={saveExam}>
                        💾 Lưu
                    </button>
                </>
            }
        >
            {/* Week tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #ffffff0f', margin: '-12px -16px 0', padding: '0 16px' }}>
                {[STUDY_WEEKS + 1, STUDY_WEEKS + 2].map((w) => (
                    <button
                        key={w}
                        onClick={() => setActiveW(w)}
                        style={{
                            flex: 1,
                            padding: '9px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: 13,
                            color: w === activeW ? '#FBBF24' : '#555',
                            borderBottom: w === activeW ? '2px solid #FBBF24' : '2px solid transparent',
                        }}
                    >
                        Tuần Thi {w - STUDY_WEEKS}
                    </button>
                ))}
            </div>

            {subjects.map((sub) => {
                const key = `w${activeW}_${sub.id}`;
                const exam = local[key] || {};
                return (
                    <div key={sub.id} style={{ background: '#1a1a32', borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${sub.color}` }}>
                        <div style={{ color: sub.color, fontWeight: 700, marginBottom: 8 }}>{sub.name}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            {(
                                [
                                    ['date', 'Ngày thi'],
                                    ['time', 'Giờ thi'],
                                    ['room', 'Phòng thi'],
                                    ['type', 'Hình thức'],
                                ] as [keyof ExamEntry, string][]
                            ).map(([f, ph]) => (
                                <input
                                    key={f}
                                    placeholder={ph}
                                    value={exam[f] || ''}
                                    onChange={(e) => update(sub.id, f, e.target.value)}
                                    style={{ ...css.input, fontSize: 11 }}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </ModalShell>
    );
}

// ── Subjects Modal ────────────────────────────────────────────────

interface SubjectsModalProps {
    subjects: Subject[];
    setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>;
    onClose: () => void;
    showToast: (msg: string) => void;
}

function SubjectsModal({ subjects, setSubjects, onClose, showToast }: SubjectsModalProps) {
    const [local, setLocal] = useState<Subject[]>(subjects.map((s) => ({ ...s })));
    const [newName, setNewName] = useState<string>('');
    const [newFull, setNewFull] = useState<string>('');
    const [newColor, setNewColor] = useState<string>(PRESET_COLORS[5]);

    const updateField = (idx: number, field: keyof Subject, val: string) =>
        setLocal((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: val } : s)));
    const remove = (idx: number) => setLocal((prev) => prev.filter((_, i) => i !== idx));

    const addSubject = () => {
        const name = newName.trim().toUpperCase();
        if (!name) return;
        if (local.find((s) => s.id === name)) {
            showToast('⚠️ Mã môn đã tồn tại!');
            return;
        }
        setLocal((prev) => [...prev, { id: name, name, full: newFull.trim() || name, color: newColor }]);
        setNewName('');
        setNewFull('');
    };

    const saveSubjects = () => {
        setSubjects(local);
        showToast('✅ Đã lưu môn học!');
        onClose();
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
                    <button style={{ ...css.primaryBtn, flex: 2, justifyContent: 'center' }} onClick={saveSubjects}>
                        💾 Lưu
                    </button>
                </>
            }
        >
            {/* Existing subjects */}
            {local.map((sub, i) => (
                <div key={sub.id} style={{ background: '#1a1a32', borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${sub.color}` }}>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 6 }}>
                        <input
                            value={sub.name}
                            onChange={(e) => updateField(i, 'name', e.target.value)}
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

            {/* Add new */}
            <div style={{ background: '#0d0d22', border: '1px dashed #ffffff15', borderRadius: 10, padding: '12px' }}>
                <div style={{ fontSize: 12, color: '#666', fontWeight: 600, marginBottom: 8 }}>➕ Thêm môn mới</div>
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

// ── Schedule Modal ────────────────────────────────────────────────

interface ScheduleModalProps {
    schedule: Schedule;
    setSchedule: React.Dispatch<React.SetStateAction<Schedule>>;
    subjects: Subject[];
    onClose: () => void;
    showToast: (msg: string) => void;
}

function ScheduleModal({ schedule, setSchedule, subjects, onClose, showToast }: ScheduleModalProps) {
    const [local, setLocal] = useState<Schedule>(JSON.parse(JSON.stringify(schedule)));

    const updateSlot = (day: number, idx: number, val: string) =>
        setLocal((prev) => ({
            ...prev,
            [day]: prev[day].map((s, i) => (i === idx ? val : s)),
        }));
    const addSlot = (day: number) => setLocal((prev) => ({ ...prev, [day]: [...(prev[day] || []), subjects[0]?.id || ''] }));
    const removeSlot = (day: number, idx: number) => setLocal((prev) => ({ ...prev, [day]: prev[day].filter((_, i) => i !== idx) }));

    const saveSchedule = () => {
        setSchedule(local);
        showToast('✅ Đã lưu lịch học!');
        onClose();
    };

    return (
        <ModalShell
            title="🗓 Lịch Học Theo Ngày"
            onClose={onClose}
            footer={
                <>
                    <button style={{ ...css.chip, flex: 1, padding: '10px', justifyContent: 'center' }} onClick={onClose}>
                        Hủy
                    </button>
                    <button style={{ ...css.primaryBtn, flex: 2, justifyContent: 'center' }} onClick={saveSchedule}>
                        💾 Lưu
                    </button>
                </>
            }
        >
            {[1, 2, 3, 4, 5].map((day) => (
                <div key={day} style={{ background: '#1a1a32', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{DAY_NAMES[day]}</div>
                    {(local[day] || []).map((sid, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: '#555', width: 16, flexShrink: 0 }}>S{i + 1}</span>
                            <select value={sid} onChange={(e) => updateSlot(day, i, e.target.value)} style={{ ...css.select, flex: 1 }}>
                                <option value="">— Trống —</option>
                                {subjects.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => removeSlot(day, i)}
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
                    ))}
                    <button style={css.smallBtn} onClick={() => addSlot(day)}>
                        + Thêm slot
                    </button>
                </div>
            ))}
        </ModalShell>
    );
}

// ── Online/Offline Modal ──────────────────────────────────────────

interface OnlineModalProps {
    onlineDays: OnlineDays;
    setOnlineDays: React.Dispatch<React.SetStateAction<OnlineDays>>;
    onClose: () => void;
    showToast: (msg: string) => void;
}

function OnlineModal({ onlineDays, setOnlineDays, onClose, showToast }: OnlineModalProps) {
    const [local, setLocal] = useState<OnlineDays>(JSON.parse(JSON.stringify(onlineDays)));

    const toggle = (week: number, day: number) => {
        setLocal((prev) => {
            const cur = prev[week] || [];
            const next = cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day].sort((a, b) => a - b);
            return { ...prev, [week]: next };
        });
    };
    const allOn = (w: number) => setLocal((prev) => ({ ...prev, [w]: [1, 2, 3, 4, 5] }));
    const allOff = (w: number) => setLocal((prev) => ({ ...prev, [w]: [] }));

    const saveOnline = () => {
        setOnlineDays(local);
        showToast('✅ Đã lưu lịch Online/Offline!');
        onClose();
    };

    return (
        <ModalShell
            title="🌐 Lịch Online / Offline"
            onClose={onClose}
            footer={
                <>
                    <button style={{ ...css.chip, flex: 1, padding: '10px', justifyContent: 'center' }} onClick={onClose}>
                        Hủy
                    </button>
                    <button style={{ ...css.primaryBtn, flex: 2, justifyContent: 'center' }} onClick={saveOnline}>
                        💾 Lưu
                    </button>
                </>
            }
        >
            <div style={{ fontSize: 11, color: '#555' }}>Nhấn vào ngày để bật/tắt Online. Mặc định = Offline.</div>

            {Array.from({ length: STUDY_WEEKS }, (_, i) => i + 1).map((w) => {
                const online = local[w] || [];
                return (
                    <div key={w} style={{ background: '#1a1a32', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>Tuần {w}</span>
                            <div style={{ display: 'flex', gap: 5 }}>
                                <button onClick={() => allOff(w)} style={{ ...css.smallBtn, fontSize: 9 }}>
                                    All Offline
                                </button>
                                <button onClick={() => allOn(w)} style={{ ...css.smallBtn, fontSize: 9, color: '#00C6FF', borderColor: '#00C6FF28' }}>
                                    All Online
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 5 }}>
                            {[1, 2, 3, 4, 5].map((day) => {
                                const on = online.includes(day);
                                return (
                                    <button
                                        key={day}
                                        onClick={() => toggle(w, day)}
                                        style={{
                                            flex: 1,
                                            padding: '7px 4px',
                                            borderRadius: 8,
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontWeight: 700,
                                            fontSize: 11,
                                            lineHeight: 1.4,
                                            background: on ? '#00C6FF' : '#ffffff08',
                                            color: on ? '#06061a' : '#555',
                                        }}
                                    >
                                        <div>{DAY_SHORT[day]}</div>
                                        <div style={{ fontSize: 9 }}>{on ? '🌐' : '🏫'}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </ModalShell>
    );
}

// ═══════════════════════════════════════════════════════════════════
// GLOBAL CSS (fonts, reset, keyframe animations)
// ═══════════════════════════════════════════════════════════════════

const globalCss = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');

    *, *::before, *::after { box-sizing: border-box; }

    input, select, textarea, button { font-family: inherit; }

    ::-webkit-scrollbar { width: 3px; }
    ::-webkit-scrollbar-thumb { background: #ffffff18; border-radius: 4px; }

    input[type="date"]::-webkit-calendar-picker-indicator,
    input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: invert(0.7); }

    @keyframes fadeUp   { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideUp  { from { opacity: 0; transform: translateY(50px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes bellWig  { 0%,100%{transform:rotate(0)} 20%{transform:rotate(18deg)} 40%{transform:rotate(-14deg)} 60%{transform:rotate(9deg)} 80%{transform:rotate(-4deg)} }
    @keyframes toastIn  { from { opacity: 0; transform: translateX(-50%) translateY(16px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
    @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.4} }

    .anim-fadeup  { animation: fadeUp  .22s ease forwards; }
    .anim-slideup { animation: slideUp .28s ease forwards; }
    .anim-bell    { animation: bellWig .55s ease; }
    .anim-pulse   { animation: pulse 2s ease-in-out infinite; }
    `;

// ═══════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════

const css: Record<string, CSSProperties> = {
    // Layout
    root: {
        fontFamily: "'Outfit', 'Segoe UI', sans-serif",
        background: '#06061a',
        minHeight: '100vh',
        color: '#e2e2f0',
        position: 'relative',
    },
    bgDots: {
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        backgroundImage: 'radial-gradient(#ffffff06 1px, transparent 1px)',
        backgroundSize: '28px 28px',
    },
    main: {
        position: 'relative',
        zIndex: 10,
        paddingTop: 8,
        paddingBottom: 36,
    },
    tab: {
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 11,
    },

    // Header
    header: {
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '11px 18px',
        background: 'rgba(6,6,26,0.96)',
        backdropFilter: 'blur(18px)',
        borderBottom: '1px solid #ffffff0a',
    },
    iconBtn: {
        background: '#ffffff0a',
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
        background: '#0d0d22',
        border: '1px solid #ffffff12',
        borderRadius: 14,
        zIndex: 300,
        overflow: 'hidden',
        boxShadow: '0 10px 36px rgba(0,0,0,.65)',
    },
    weekBadge: {
        textAlign: 'center',
        background: '#FF6B3512',
        border: '1px solid #FF6B3528',
        borderRadius: 10,
        padding: '4px 13px',
    },

    // Nav
    nav: {
        position: 'sticky',
        top: 58,
        zIndex: 90,
        display: 'flex',
        background: 'rgba(6,6,26,0.96)',
        backdropFilter: 'blur(18px)',
        borderBottom: '1px solid #ffffff0a',
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

    // Cards & inputs
    card: {
        background: '#0d0d22',
        border: '1px solid #ffffff0a',
        borderRadius: 13,
        padding: '12px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    cardTitle: { fontWeight: 700, fontSize: 14 },

    input: {
        background: '#1a1a32',
        border: '1px solid #ffffff10',
        color: '#e2e2f0',
        padding: '8px 10px',
        borderRadius: 8,
        fontSize: 12,
        width: '100%',
        outline: 'none',
    },
    select: {
        background: '#1a1a32',
        border: '1px solid #ffffff10',
        color: '#e2e2f0',
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
        border: '1px solid #ffffff10',
        color: '#888',
        padding: '3px 8px',
        borderRadius: 6,
        cursor: 'pointer',
    },
    chip: {
        background: '#ffffff0a',
        border: '1px solid #ffffff10',
        color: '#888',
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: 10,
        cursor: 'pointer',
        fontWeight: 600,
    },

    // Week navigation
    arrowBtn: {
        background: '#ffffff0a',
        border: '1px solid #ffffff10',
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
    nowTag: {
        background: '#FF6B35',
        color: '#fff',
        fontSize: 9,
        padding: '2px 7px',
        borderRadius: 20,
        fontWeight: 700,
    },

    // Modal
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
        background: '#0d0d22',
        border: '1px solid #ffffff10',
        borderRadius: 20,
        width: '100%',
        maxWidth: 460,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: '#555',
        fontSize: 18,
        cursor: 'pointer',
    },

    // Toast
    toast: {
        position: 'fixed',
        bottom: 22,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#1a1a32',
        border: '1px solid #FF6B3540',
        color: '#fff',
        padding: '9px 22px',
        borderRadius: 22,
        zIndex: 400,
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 20px rgba(0,0,0,.6)',
        animation: 'toastIn .22s ease forwards',
    },
};
