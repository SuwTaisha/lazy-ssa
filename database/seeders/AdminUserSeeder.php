<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('ADMIN_EMAIL', 'admin@fpttime.local');
        $now = now();

        $existing = DB::table('users')->where('email', $email)->first();

        if ($existing) {
            // User đã tồn tại (vd. cài lại DB nhưng dùng email admin thật) — chỉ cấp
            // quyền admin, không đụng vào mật khẩu/tên đã có sẵn của họ.
            DB::table('users')->where('email', $email)->update([
                'is_admin' => true,
                'updated_at' => $now,
            ]);
        } else {
            DB::table('users')->insert([
                'name' => env('ADMIN_NAME', 'Admin'),
                'email' => $email,
                'password' => Hash::make(env('ADMIN_PASSWORD', 'password')),
                'email_verified_at' => $now,
                'is_admin' => true,
                'remember_token' => Str::random(10),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $this->command?->info("Đã đảm bảo tài khoản admin tồn tại: {$email}");
    }
}
