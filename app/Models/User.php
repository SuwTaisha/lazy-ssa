<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use NotificationChannels\WebPush\HasPushSubscriptions;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasPushSubscriptions, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            // Cố tình KHÔNG có trong $fillable — is_admin không bao giờ được phép gán
            // hàng loạt từ request, chỉ set trực tiếp qua tinker/seeder.
            'is_admin' => 'boolean',
        ];
    }

    public function semesters(): HasMany
    {
        return $this->hasMany(Semester::class);
    }

    public function milestoneSurveys(): HasMany
    {
        return $this->hasMany(MilestoneSurvey::class);
    }
}
