<?php

namespace App\Http\Controllers\ExamEntry;

use App\Http\Controllers\Controller;
use App\Models\ExamEntry;
use App\Models\Semester;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Sabre\VObject\ParseException;
use Sabre\VObject\Reader;

class ExamEntryImportController extends Controller
{
    // Đúng theo STUDY_WEEKS trong HomeController/home.tsx: tuần thi bắt đầu ngay sau
    // tuần học cuối. "Tuần thi N" = STUDY_WEEKS + N.
    private const STUDY_WEEKS = 7;

    // File lịch thi dùng giờ UTC thật ("Z"), phải quy đổi về giờ Việt Nam để không lệch ngày.
    private const APP_TZ = 'Asia/Ho_Chi_Minh';

    public function import(Request $request, Semester $semester): RedirectResponse
    {
        abort_unless($semester->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'ics_file' => ['required', 'file', 'max:5120'],
        ]);

        $file = $data['ics_file'];
        if (strtolower($file->getClientOriginalExtension()) !== 'ics') {
            throw ValidationException::withMessages([
                'ics_file' => 'File phải có định dạng .ics',
            ]);
        }

        try {
            $calendar = Reader::read(file_get_contents($file->getRealPath()), Reader::OPTION_FORGIVING);
        } catch (ParseException) {
            throw ValidationException::withMessages([
                'ics_file' => 'Không thể đọc file .ics: file bị lỗi định dạng.',
            ]);
        }

        $tz = new DateTimeZone(self::APP_TZ);
        $events = [];

        foreach ($calendar->VEVENT ?? [] as $event) {
            $summary = trim((string) $event->SUMMARY);
            if ($summary === '' || ! isset($event->DTSTART)) {
                continue;
            }

            // SUMMARY dạng "PRF192 - PE" / "CSI106 - FE" -> mã môn + hình thức thi.
            [$code, $kind] = array_pad(array_map('trim', explode('-', $summary, 2)), 2, null);
            if ($code === '' || $code === null) {
                continue;
            }

            $start = $event->DTSTART->getDateTime()->setTimezone($tz);

            $description = isset($event->DESCRIPTION) ? trim((string) $event->DESCRIPTION) : '';
            $type = match ($description) {
                'Practical_Exam' => 'Thực hành',
                'Multiple_Choices' => 'Trắc nghiệm',
                default => $description !== '' ? str_replace('_', ' ', $description) : $kind,
            };

            $location = isset($event->LOCATION) ? trim((string) $event->LOCATION) : null;

            $events[] = [
                'code' => $code,
                'date' => $start->format('Y-m-d'),
                'time' => $start->format('H:i'),
                'room' => $location ?: null,
                'type' => $type,
                'week_start' => $this->mondayOf($start)->format('Y-m-d'),
                'sort' => $start,
            ];
        }

        if (empty($events)) {
            throw ValidationException::withMessages([
                'ics_file' => 'Không tìm thấy lịch thi nào trong file .ics.',
            ]);
        }

        // "Tuần thi N" được đánh số theo thứ tự thời gian thực tế của các tuần (Thứ 2 -
        // Chủ nhật) xuất hiện trong file, không phụ thuộc vào ngày bắt đầu kỳ học — vì lịch
        // thi có thể rơi vào bất kỳ thời điểm nào, không cố định đúng 2 tuần như trước.
        $weekRanks = collect($events)->pluck('week_start')->unique()->sort()->values()
            ->mapWithKeys(fn ($weekStart, $i) => [$weekStart => $i + 1]);

        foreach ($events as &$e) {
            $e['week_number'] = self::STUDY_WEEKS + $weekRanks[$e['week_start']];
        }
        unset($e);

        $eventsByCode = collect($events)->groupBy('code');

        DB::transaction(function () use ($semester, $eventsByCode) {
            $subjectIdByCode = $semester->subjects()->pluck('id', 'code');

            foreach ($eventsByCode as $code => $codeEvents) {
                if (! isset($subjectIdByCode[$code])) {
                    continue; // môn chưa có trong hệ thống -> bỏ qua, không tự tạo môn thi
                }

                $subjectId = $subjectIdByCode[$code];

                // Xoá lịch thi cũ của môn này để tránh trùng/lệch số tuần thi từ lần import trước.
                ExamEntry::where('subject_id', $subjectId)->delete();

                foreach ($codeEvents as $e) {
                    ExamEntry::create([
                        'subject_id' => $subjectId,
                        'week_number' => $e['week_number'],
                        'exam_date' => $e['date'],
                        'exam_time' => $e['time'],
                        'room' => $e['room'],
                        'type' => $e['type'],
                    ]);
                }
            }
        });

        return back();
    }

    private function mondayOf(DateTimeImmutable $date): DateTimeImmutable
    {
        $isoDayOfWeek = (int) $date->format('N'); // 1 (Thứ 2) .. 7 (Chủ nhật)

        return $date->modify('-'.($isoDayOfWeek - 1).' days')->setTime(0, 0, 0);
    }
}
