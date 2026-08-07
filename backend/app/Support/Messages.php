<?php

namespace App\Support;

/**
 * Arabic user-facing strings, copied VERBATIM from
 * supabase/functions/manage-users/index.ts. These are part of the API contract —
 * the SPA shows them directly. Do not translate, reword, or "improve" them.
 */
final class Messages
{
    // ── Auth / credentials ──
    public const BAD_CREDENTIALS = 'اسم المستخدم أو كلمة المرور غير صحيحة';

    public const ACCOUNT_EXPIRED = 'انتهت صلاحية هذا الحساب';

    public const ACCOUNT_DISABLED = 'حساب غير مفعّل';

    // ── Sessions ──
    public const SESSION_INVALID = 'جلسة غير صالحة';   // returned with session_expired:true

    public const SESSION_ENDED = 'جلسة منتهية';        // returned with session_expired:true

    public const SESSION_EXPIRED_CLIENT = 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى';

    // ── Device limits ──
    public const DEVICE_LIMIT_REACHED = 'تم الوصول للحد الأقصى من الأجهزة المسموح بها. يرجى تسجيل الخروج من جهاز آخر أولاً';

    public const STILL_TOO_MANY_DEVICES = 'لا يزال عدد الأجهزة النشطة يتجاوز الحد المسموح';

    // ── Change password ──
    public const INCOMPLETE_DATA = 'البيانات غير مكتملة';

    public const PASSWORD_TOO_SHORT = 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل';

    public const PASSWORD_MUST_DIFFER = 'كلمة المرور الجديدة يجب أن تختلف عن القديمة';

    public const CURRENT_PASSWORD_WRONG = 'كلمة المرور الحالية غير صحيحة';

    public const PASSWORD_UPDATE_FAILED = 'تعذر تحديث كلمة المرور';

    // ── Admin auth (legacy per-request; kept for parity of messages) ──
    public const ADMIN_LOGIN_REQUIRED = 'يجب تسجيل الدخول كمدير';

    public const ADMIN_PASSWORD_WRONG = 'كلمة مرور المدير غير صحيحة';

    // ── Authorization ──
    public const NOT_AUTHORIZED = 'غير مصرح';

    public const ONLY_MAIN_USER = 'غير مصرح - فقط المستخدم الرئيسي';

    // ── Users / employees ──
    public const USERNAME_EXISTS = 'اسم المستخدم موجود مسبقاً';

    public const TARGET_USER_NOT_FOUND = 'المستخدم المستهدف غير موجود';

    // ── Quotes ──
    public const QUOTE_NOT_FOUND = 'العرض غير موجود';

    // ── Files ──
    public const FILE_NAME_REQUIRED = 'اسم الملف مطلوب';

    public const FILE_PATH_REQUIRED = 'مسار الملف مطلوب';

    // ── Activity ──
    public const ACTIVITY_LOG_FAILED = 'تعذر تسجيل النشاط';

    // ── Generic ──
    public const UNKNOWN_ACTION = 'إجراء غير معروف';

    public const SERVER_ERROR = 'حدث خطأ في الخادم';

    public const GENERIC_ERROR = 'حدث خطأ';

    /**
     * Max-employees message includes the cap, e.g. "وصلت للحد الأقصى من الموظفين (3)".
     */
    public static function maxEmployees(int $cap): string
    {
        return "وصلت للحد الأقصى من الموظفين ({$cap})";
    }
}
