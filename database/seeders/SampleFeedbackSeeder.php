<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SampleFeedbackSeeder extends Seeder
{
    private const FEEDBACK_SAMPLES = [
        [5, 'App rất tiện, mình theo dõi lịch học với deadline dễ dàng hơn hẳn so với FAP.'],
        [4, 'Giao diện đẹp, nhưng mong có thêm chế độ xem theo tháng cho phần task.'],
        [5, 'Tính năng nhắc deadline cứu mình mấy lần nộp bài trễ rồi.'],
        [3, 'Thỉnh thoảng nhập lịch từ file .ics bị lệch giờ, mong sửa sớm.'],
        [5, 'Ca làm cố định tự động lên lịch tuần rất tiện cho sinh viên đi làm thêm như mình.'],
        [4, 'Mong có thêm dark mode đẹp hơn nữa và widget ngoài màn hình chính.'],
        [2, 'Bị lỗi khi nhập file lịch thi, phải thử lại vài lần mới được.'],
        [5, 'Đúng thứ mình cần — thay thế hẳn Google Calendar cho việc học.'],
        [4, 'Ổn, chỉ mong tốc độ tải trang nhanh hơn một chút.'],
        [5, 'Ghi chú theo môn với theo ngày phân biệt rõ ràng, dễ tra cứu lại.'],
        [3, 'Bình thường, chưa thấy khác biệt nhiều so với lịch giấy.'],
        [4, 'Ca làm với lịch học cảnh báo trùng giờ là tính năng mình thích nhất.'],
    ];

    private const SURVEY_SAMPLES = [
        'day1' => [
            [5, 'Cài đặt nhanh, giao diện dễ hiểu ngay lần đầu dùng.'],
            [4, null],
            [3, 'Chưa quen lắm nhưng có vẻ hữu ích.'],
            [5, 'Nhập lịch từ FAP qua rất mượt.'],
            [4, 'Màu sắc theo môn học dễ phân biệt.'],
        ],
        'day7' => [
            [5, 'Dùng ổn định cả tuần, chưa gặp lỗi gì.'],
            [4, 'Thích tính năng nhắc task, mong thêm nhắc qua Zalo.'],
            [2, 'Bị mất dữ liệu 1 lần khi đổi ngày bắt đầu học kỳ.'],
            [5, null],
            [4, 'Lịch dạng calendar nhìn giống Google Calendar, quen mắt.'],
        ],
        'day30' => [
            [5, 'Dùng cả tháng rồi, giờ không thể thiếu app này khi đi học.'],
            [4, 'Tốt, mong ra thêm bản mobile app riêng.'],
            [5, 'Quản lý ca làm thêm + lịch học trong 1 app tiện thật sự.'],
            [3, 'Ổn định nhưng UI mục cài đặt hơi rối.'],
        ],
    ];

    // 40 user mẫu, mỗi user random 1 mức độ "dùng thật":
    // - 'ghost'   : chỉ đăng ký, chưa từng đụng tới gì khác (mô phỏng tài khoản ma).
    // - 'light'   : có xem app nhưng chỉ dừng ở feedback/đánh giá, không tạo dữ liệu học tập.
    // - 'engaged' : có tạo task/ghi chú/môn học — dấu hiệu dùng thật.
    private const PROFILE_WEIGHTS = ['ghost' => 20, 'light' => 30, 'engaged' => 50];

    public function run(): void
    {
        $now = Carbon::now();
        $password = Hash::make('password');

        for ($i = 1; $i <= 40; $i++) {
            $joinedDaysAgo = rand(0, 45);
            $createdAt = $now->copy()->subDays($joinedDaysAgo);
            $profile = $this->weightedProfile();

            $userId = DB::table('users')->insertGetId([
                'name' => "Sample User {$i}",
                'email' => "sample{$i}.".Str::random(6).'@example.test',
                'password' => $password,
                'email_verified_at' => $createdAt,
                'is_admin' => false,
                'remember_token' => Str::random(10),
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            $semesterId = DB::table('semesters')->insertGetId([
                'user_id' => $userId,
                'name' => null,
                'start_date' => $now->copy()->startOfWeek(Carbon::MONDAY)->toDateString(),
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            if ($profile === 'engaged') {
                $subjectId = DB::table('subjects')->insertGetId([
                    'semester_id' => $semesterId,
                    'code' => 'SUB'.$i,
                    'full_name' => "Sample Subject {$i}",
                    'color' => ['#FF6B35', '#00C6FF', '#A78BFA', '#34D399', '#FBBF24'][$i % 5],
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ]);

                DB::table('tasks')->insert([
                    'semester_id' => $semesterId,
                    'subject_id' => $subjectId,
                    'text' => 'Sample task '.$i,
                    'deadline' => $now->copy()->addDays(rand(1, 10)),
                    'remind_minutes_before' => 1440,
                    'done' => (bool) rand(0, 1),
                    'created_at' => $createdAt->copy()->addHours(rand(1, 48)),
                    'updated_at' => $createdAt,
                ]);

                if ($i % 3 === 0) {
                    DB::table('notes')->insert([
                        'subject_id' => $subjectId,
                        'content' => 'Ghi chú mẫu cho môn '.$i,
                        'created_at' => $createdAt->copy()->addHours(rand(1, 48)),
                        'updated_at' => $createdAt,
                    ]);
                }
            }

            // Feedback: 'ghost' không bao giờ gửi feedback; 2 nhóm còn lại có ~55% khả năng gửi.
            if ($profile !== 'ghost' && rand(1, 100) <= 55) {
                [$rating, $content] = self::FEEDBACK_SAMPLES[array_rand(self::FEEDBACK_SAMPLES)];
                DB::table('feedback')->insert([
                    'user_id' => $userId,
                    'rating' => $rating,
                    'content' => $content,
                    'created_at' => $createdAt->copy()->addDays(rand(1, max(1, $joinedDaysAgo))),
                    'updated_at' => $createdAt,
                ]);
            }

            // Milestone survey: chỉ mốc đã tới hạn theo created_at mới có thể có; 'ghost' bỏ qua hẳn.
            if ($profile === 'ghost') {
                continue;
            }
            foreach (['day1' => 1, 'day7' => 7, 'day30' => 30] as $milestone => $threshold) {
                if ($joinedDaysAgo < $threshold || rand(1, 100) > 70) {
                    continue;
                }
                [$rating, $comment] = self::SURVEY_SAMPLES[$milestone][array_rand(self::SURVEY_SAMPLES[$milestone])];
                DB::table('milestone_surveys')->insert([
                    'user_id' => $userId,
                    'milestone' => $milestone,
                    'rating' => $rating,
                    'feedback' => $comment,
                    'created_at' => $createdAt->copy()->addDays($threshold),
                    'updated_at' => $createdAt,
                ]);
            }
        }

        $this->command?->info('Đã tạo 40 user mẫu kèm feedback + đánh giá mốc thời gian.');
    }

    private function weightedProfile(): string
    {
        $roll = rand(1, 100);
        $cumulative = 0;
        foreach (self::PROFILE_WEIGHTS as $profile => $weight) {
            $cumulative += $weight;
            if ($roll <= $cumulative) {
                return $profile;
            }
        }

        return 'ghost';
    }
}
