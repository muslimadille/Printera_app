<?php

namespace App\Services\Storage;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

/**
 * Reads the live Supabase Storage bucket over its REST API.
 *
 * Extracted from MigrateSupabaseStorage (OPS-071) when the source became an interface, so
 * the walk and the transfer can be tested apart. Behaviour is unchanged.
 *
 * Authenticates with the **service-role key**, which is what lets one call read every
 * tenant's objects. Treat it as a secret: use it for the migration, then rotate it.
 */
final class SupabaseApiObjectSource implements ObjectSource
{
    /** Supabase's list endpoint caps a page at 100 by default; ask for its maximum. */
    private const PAGE = 100;

    public function __construct(
        private readonly string $url,
        private readonly string $serviceRoleKey,
        private readonly string $bucket,
    ) {}

    public function describe(): string
    {
        return "bucket {$this->bucket}";
    }

    /**
     * Supabase's list endpoint is one level deep and reports folders as entries with a
     * null id, so this walks the tree: the top level is one folder per user, and the
     * objects sit inside. Paginated, because a busy tenant can exceed one page on its own.
     *
     * @return array<int,string>
     */
    public function keys(string $prefix = ''): array
    {
        $prefix = trim($prefix, '/');
        $keys = [];
        $folders = [];

        if ($prefix !== '') {
            $folders[] = $prefix;
        } else {
            foreach ($this->listPrefix('') as $entry) {
                // A null id marks a folder — one per user under this key scheme. A real
                // object at the root would be unexpected, but carry it rather than drop it.
                $entry['id'] === null
                    ? $folders[] = $entry['name']
                    : $keys[] = $entry['name'];
            }
        }

        foreach ($folders as $folder) {
            foreach ($this->listPrefix($folder) as $entry) {
                if ($entry['id'] === null) {
                    continue; // nested folder — this key scheme has none
                }
                $keys[] = "{$folder}/{$entry['name']}";
            }
        }

        sort($keys);

        return $keys;
    }

    public function get(string $key): string
    {
        $response = $this->client()->get("{$this->baseUrl()}/object/{$this->bucket}/".$this->encodeKey($key));

        if (! $response->successful()) {
            throw new \RuntimeException("HTTP {$response->status()}");
        }

        return $response->body();
    }

    /**
     * One directory level, following pagination.
     *
     * @return array<int,array{name:string,id:?string}>
     */
    private function listPrefix(string $prefix): array
    {
        $entries = [];
        $offset = 0;

        while (true) {
            $response = $this->client()->post("{$this->baseUrl()}/object/list/{$this->bucket}", [
                'prefix' => $prefix === '' ? '' : "{$prefix}/",
                'limit' => self::PAGE,
                'offset' => $offset,
                'sortBy' => ['column' => 'name', 'order' => 'asc'],
            ]);

            if (! $response->successful()) {
                throw new \RuntimeException("list {$prefix} → HTTP {$response->status()}");
            }

            $page = $response->json();

            if (! is_array($page) || $page === []) {
                break;
            }

            foreach ($page as $entry) {
                // Supabase emits a placeholder row for empty folders; it is not an object.
                if (($entry['name'] ?? '') === '.emptyFolderPlaceholder') {
                    continue;
                }
                $entries[] = ['name' => (string) $entry['name'], 'id' => $entry['id'] ?? null];
            }

            if (count($page) < self::PAGE) {
                break;
            }

            $offset += self::PAGE;
        }

        return $entries;
    }

    private function client(): PendingRequest
    {
        return Http::withToken($this->serviceRoleKey)
            ->withHeaders(['apikey' => $this->serviceRoleKey])
            ->timeout(120)
            ->retry(3, 500);
    }

    private function baseUrl(): string
    {
        return rtrim($this->url, '/').'/storage/v1';
    }

    /** Path segments are URL-encoded individually so the `/` separators survive. */
    private function encodeKey(string $key): string
    {
        return implode('/', array_map('rawurlencode', explode('/', $key)));
    }
}
