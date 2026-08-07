<?php

namespace App\Services\Storage;

use Illuminate\Contracts\Filesystem\Filesystem;

/**
 * Reads the montage objects from a filesystem instead of the live Supabase API.
 *
 * Two uses, and they are the same code path:
 *
 *  - **Tests.** A `Storage::fake()` disk holding real bytes under real keys, which
 *    exercises the transfer without also asserting a hand-written model of Supabase's
 *    REST responses.
 *  - **Production, via `--from-disk`.** Export the bucket first, then copy from the
 *    export. Slower to set up, but it needs no service-role key and the export doubles as
 *    the backup the runbook demands anyway.
 *
 * `allFiles()` is recursive and already returns keys relative to the disk root, which is
 * exactly the form they must be written under — so this class does nothing to them.
 */
final class DiskObjectSource implements ObjectSource
{
    public function __construct(
        private readonly Filesystem $disk,
        private readonly string $label = 'source disk',
    ) {}

    public function describe(): string
    {
        return $this->label;
    }

    /** @return array<int,string> */
    public function keys(string $prefix = ''): array
    {
        $keys = $this->disk->allFiles(trim($prefix, '/'));

        // The bucket's own empty-folder markers travel with an export; they are not
        // objects, and copying them would leave litter on the new disk.
        $keys = array_values(array_filter(
            $keys,
            fn (string $key): bool => basename($key) !== '.emptyFolderPlaceholder',
        ));

        sort($keys);

        return $keys;
    }

    public function get(string $key): string
    {
        $body = $this->disk->get($key);

        if ($body === null) {
            throw new \RuntimeException('unreadable on the source disk');
        }

        return $body;
    }
}
