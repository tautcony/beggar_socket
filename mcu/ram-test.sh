#!/usr/bin/env bash

set -euo pipefail

VOLUME_PATH="/Volumes/BEGGAR FAT"
RAM_PATH="$VOLUME_PATH/RAM"
TEST_FILE="/tmp/beggar_save_test.sav"
REMOTE_NAME="hosttest.sav"
REMOTE_PATH="$RAM_PATH/$REMOTE_NAME"
DOT_REMOTE_PATH="$RAM_PATH/._$REMOTE_NAME"
SAVE_SIZE=32768
WAIT_SECONDS=2
REGENERATE_TEST_FILE=0

usage() {
    cat <<'EOF'
Usage: ./ram-test.sh [options]

Options:
  --volume PATH       Mounted BEGGAR FAT volume path.
  --test-file PATH    Local test save file path.
  --remote-name NAME  File name copied into /RAM.
  --size BYTES        Generated test file size. Default: 32768.
  --wait SECONDS      Seconds to wait after copy. Default: 2.
  --regen             Force regenerate the local test file.
  -h, --help          Show this help.

The script performs a reusable RAM import verification flow:
1. Generate a deterministic local save file if needed.
2. Show baseline /RAM directory, STATUS.TXT, CURRENT.SAV hash.
3. Remove prior test artifacts under /RAM.
4. Copy the test file to /RAM/<remote-name>.
5. sync and wait.
6. Show post-copy status, hashes, and a quick compare result.
EOF
}

log() {
    printf '[ram-test] %s\n' "$*"
}

require_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        printf 'Missing required command: %s\n' "$1" >&2
        exit 1
    fi
}

generate_test_file() {
    local path="$1"
    local size="$2"

    log "Generating deterministic test file: $path ($size bytes)"
    awk -v size="$size" 'BEGIN {
        pattern = "ABCD";
        for (i = 0; i < size; ++i) {
            printf "%s", substr(pattern, (i % 4) + 1, 1);
        }
    }' >"$path"
}

show_snapshot() {
    local title="$1"

    log "$title: ls -la $RAM_PATH"
    ls -la "$RAM_PATH"

    log "$title: STATUS.TXT"
    cat "$RAM_PATH/STATUS.TXT"

    log "$title: sha1 CURRENT.SAV"
    shasum "$RAM_PATH/CURRENT.SAV"
}

cleanup_remote_artifacts() {
    if [ -e "$REMOTE_PATH" ]; then
        log "Removing stale remote file: $REMOTE_PATH"
        rm -f "$REMOTE_PATH"
    fi

    if [ -e "$DOT_REMOTE_PATH" ]; then
        log "Removing stale macOS dot file: $DOT_REMOTE_PATH"
        rm -f "$DOT_REMOTE_PATH"
    fi
}

post_check() {
    local current_hash
    local source_hash

    log "Post-copy: sha1 source and CURRENT.SAV"
    shasum "$TEST_FILE" "$RAM_PATH/CURRENT.SAV"

    source_hash="$(shasum "$TEST_FILE" | awk '{print $1}')"
    current_hash="$(shasum "$RAM_PATH/CURRENT.SAV" | awk '{print $1}')"

    if [ "$source_hash" = "$current_hash" ]; then
        log "SUCCESS: CURRENT.SAV matches test input."
        return 0
    fi

    log "MISMATCH: CURRENT.SAV does not match test input."
    return 1
}

while [ $# -gt 0 ]; do
    case "$1" in
        --volume)
            VOLUME_PATH="$2"
            RAM_PATH="$VOLUME_PATH/RAM"
            shift 2
            ;;
        --test-file)
            TEST_FILE="$2"
            shift 2
            ;;
        --remote-name)
            REMOTE_NAME="$2"
            shift 2
            ;;
        --size)
            SAVE_SIZE="$2"
            shift 2
            ;;
        --wait)
            WAIT_SECONDS="$2"
            shift 2
            ;;
        --regen)
            REGENERATE_TEST_FILE=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            printf 'Unknown argument: %s\n' "$1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

REMOTE_PATH="$RAM_PATH/$REMOTE_NAME"
DOT_REMOTE_PATH="$RAM_PATH/._$REMOTE_NAME"

require_cmd awk
require_cmd cp
require_cmd ls
require_cmd rm
require_cmd shasum
require_cmd sync

if [ ! -d "$RAM_PATH" ]; then
    printf 'RAM path not found: %s\n' "$RAM_PATH" >&2
    exit 1
fi

if [ "$REGENERATE_TEST_FILE" -eq 1 ] || [ ! -f "$TEST_FILE" ] || [ "$(wc -c <"$TEST_FILE")" -ne "$SAVE_SIZE" ]; then
    generate_test_file "$TEST_FILE" "$SAVE_SIZE"
fi

show_snapshot "Baseline"
cleanup_remote_artifacts

log "Copying $TEST_FILE -> $REMOTE_PATH"
cp "$TEST_FILE" "$REMOTE_PATH"

log "sync"
sync

log "Waiting ${WAIT_SECONDS}s"
sleep "$WAIT_SECONDS"

show_snapshot "Post-copy"
post_check
