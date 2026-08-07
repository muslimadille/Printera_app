<?php

namespace App\Models;

use App\Casts\JsonObject;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property array $quote_data opaque; the frontend owns its shape.
 */
class SavedQuote extends Model
{
    use HasUuids;

    protected $table = 'saved_quotes';

    protected $fillable = [
        'user_id', 'title', 'customer_name', 'quote_number', 'source_type', 'quote_data',
    ];

    /**
     * The default that used to be `DEFAULT '{}'` on the column. MySQL forbids a literal
     * default on a JSON column, so it lives here (BE-060).
     *
     * @var array<string,mixed>
     */
    protected $attributes = ['quote_data' => '{}'];

    protected function casts(): array
    {
        return ['quote_data' => JsonObject::class];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(AppUser::class, 'user_id');
    }
}
