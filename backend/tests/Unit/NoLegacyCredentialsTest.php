<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/**
 * BE-003 — "No legacy passwords anywhere in database/".
 *
 * The old Supabase migrations seeded demo accounts. CLAUDE.md §10 and AGENTS.md §6 forbid
 * carrying them into the rebuild, and a seeder is exactly the kind of file where one gets
 * pasted back in "just for local testing". This guards the whole directory.
 */
class NoLegacyCredentialsTest extends TestCase
{
    /** Literal demo secrets from supabase/migrations that must never reappear. */
    private const FORBIDDEN = ['1234', 'M123123'];

    /** @return list<string> */
    private function databaseFiles(): array
    {
        $root = dirname(__DIR__, 2).'/database';
        $files = [];

        /** @var \SplFileInfo $file */
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root)) as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $files[] = $file->getPathname();
            }
        }

        return $files;
    }

    /**
     * Every string literal in a PHP file, comments excluded — a comment that *names* the
     * forbidden passwords in order to warn about them is not a leak.
     *
     * @return list<string>
     */
    private function stringLiterals(string $path): array
    {
        $literals = [];

        foreach (token_get_all((string) file_get_contents($path)) as $token) {
            if (is_array($token) && in_array($token[0], [T_CONSTANT_ENCAPSED_STRING, T_ENCAPSED_AND_WHITESPACE], true)) {
                $literals[] = $token[1];
            }
        }

        return $literals;
    }

    public function test_database_directory_contains_no_legacy_demo_passwords(): void
    {
        $offenders = [];

        foreach ($this->databaseFiles() as $path) {
            foreach ($this->stringLiterals($path) as $literal) {
                foreach (self::FORBIDDEN as $secret) {
                    if (str_contains($literal, $secret)) {
                        $offenders[] = basename($path).' has a string literal containing "'.$secret.'"';
                    }
                }
            }
        }

        $this->assertSame([], $offenders, implode("\n", $offenders));
    }

    public function test_the_guard_actually_detects_a_planted_secret(): void
    {
        // Guard the guard: tokenizing must not make this a no-op that passes vacuously.
        $planted = tempnam(sys_get_temp_dir(), 'seed').'.php';
        file_put_contents($planted, "<?php\n// harmless mention of 1234 in a comment\n\$p = 'M123123';\n");

        $literals = $this->stringLiterals($planted);
        unlink($planted);

        // The literal is caught...
        $this->assertContains("'M123123'", $literals);

        // ...while the comment-only mention of 1234 is correctly ignored.
        foreach ($literals as $literal) {
            $this->assertStringNotContainsString('1234', $literal);
        }
    }

    public function test_no_seeder_hardcodes_a_password(): void
    {
        // Credentials must come from config/printera.php (env-backed), never a literal.
        foreach ($this->databaseFiles() as $path) {
            if (! str_contains($path, 'seeders')) {
                continue;
            }

            $contents = (string) file_get_contents($path);

            $this->assertDoesNotMatchRegularExpression(
                "/Hash::make\(\s*['\"]/",
                $contents,
                basename($path).' hashes a hardcoded string literal'
            );
        }
    }

    public function test_seeders_do_not_read_env_directly(): void
    {
        // F2: env() outside a config file silently returns defaults under config:cache.
        foreach ($this->databaseFiles() as $path) {
            if (! str_contains($path, 'seeders')) {
                continue;
            }

            $this->assertStringNotContainsString(
                'env(',
                (string) file_get_contents($path),
                basename($path).' calls env() at runtime; use config(\'printera.*\') instead'
            );
        }
    }
}
