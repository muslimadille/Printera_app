<?php

namespace App\Services\Storage;

/**
 * Where OPS-071 reads the montage objects FROM.
 *
 * The copy itself is trivial — same key, same bytes — and all the difficulty lives in
 * enumerating the source. Naming that as an interface buys two things:
 *
 *  - the transfer can be tested against a real filesystem full of real bytes, instead of
 *    only against canned HTTP responses that encode the same assumptions as the code under
 *    test;
 *  - the production run gains a second route. If the bucket is exported first (the
 *    Supabase dashboard, or `supabase storage cp -r`), `--from-disk` copies from that
 *    folder and the service-role key is never needed at all — which is the better option
 *    whenever handing out that key is the awkward part of the window.
 */
interface ObjectSource
{
    /**
     * Every object key, optionally limited to one prefix.
     *
     * Keys are returned in the exact form they must be written under. Sorted, so a run is
     * reproducible and its progress output comparable between attempts.
     *
     * @return array<int,string>
     *
     * @throws \RuntimeException when the source cannot be enumerated
     */
    public function keys(string $prefix = ''): array;

    /**
     * The bytes of one object.
     *
     * @throws \RuntimeException when the object cannot be read
     */
    public function get(string $key): string;

    /** How to name this source in the console output, e.g. "bucket montage-files". */
    public function describe(): string;
}
