<?php

namespace App\Http\Controllers\MilestoneSurvey;

use App\Http\Controllers\Controller;
use App\Models\MilestoneSurvey;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class MilestoneSurveyController extends Controller
{
    // Thứ tự tăng dần — khi trả lời 1 mốc, các mốc nhỏ hơn còn thiếu cũng được đánh dấu
    // luôn (dùng chung rating, không có feedback riêng) để không bao giờ bị hỏi lại lúc
    // đã trễ hơn nhiều so với đúng thời điểm của mốc đó.
    private const ORDER = ['day1', 'day7', 'day30'];

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'milestone' => ['required', 'in:day1,day7,day30'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'feedback' => ['nullable', 'string', 'max:2000'],
        ]);

        $user = $request->user();
        $upTo = array_slice(self::ORDER, 0, array_search($data['milestone'], self::ORDER) + 1);

        foreach ($upTo as $milestone) {
            MilestoneSurvey::updateOrCreate(
                ['user_id' => $user->id, 'milestone' => $milestone],
                [
                    'rating' => $data['rating'],
                    'feedback' => $milestone === $data['milestone'] ? ($data['feedback'] ?? null) : null,
                ]
            );
        }

        return back();
    }
}
