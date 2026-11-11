#!/usr/bin/env bash
#
# Gives the app its camera, microphone and notification permissions on a Linux
# kiosk, so nothing has to be clicked on an unattended machine.
#
# A kiosk is nobody's desk. The first incoming call would otherwise meet a
# permission bubble that the visitor in front of the screen cannot answer, and a
# lobby display that has never been touched has never granted anything. This
# writes the browser enterprise policy that grants the permissions outright.
#
# The grant is per origin (scheme + host, no path), so one entry covers the kiosk
# player at /kioskconnect/kiosk/<id> and the lobby display at /qr/<id>/kiosk
# alike. It is a managed policy, so it applies to every user of the machine and
# needs no browser account or sign-in.
#
# Usage:
#   sudo ./provision-linux.sh                        # this machine's browsers
#   sudo ./provision-linux.sh https://staging.example.com
#   sudo ./provision-linux.sh --all                  # every known policy dir
#   sudo ./provision-linux.sh --no-notifications     # camera and microphone only
#   sudo ./provision-linux.sh --remove               # take the policy back out
#
# The file written is inss-kiosk.json inside each browser's managed policy
# directory. Nothing else in those directories is touched — other policies on the
# machine are left alone, and two files may never set the same policy (which one
# wins is undefined), so do not also name these four policies elsewhere.

set -euo pipefail

# Kept for the "run it again as…" line: $* is empty by the time that is printed.
INVOCATION="$*"

ORIGIN='https://app.inselfstorage.com'
# auto: only browsers installed on this machine. all: every known policy dir.
SCOPE='auto'
NOTIFICATIONS=1
REMOVE=0

usage() {
    # The comment block at the top of this file is the help text; print it and
    # stop at the first line that is not a comment.
    awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
}

while [ $# -gt 0 ]; do
    case "$1" in
        --origin)
            [ $# -ge 2 ] || { echo "--origin needs a value" >&2; exit 1; }
            ORIGIN="$2"
            shift 2
            ;;
        --origin=*)
            ORIGIN="${1#*=}"
            shift
            ;;
        --all)
            SCOPE='all'
            shift
            ;;
        --no-notifications)
            NOTIFICATIONS=0
            shift
            ;;
        --remove)
            REMOVE=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            echo "Unknown option: $1" >&2
            usage
            exit 1
            ;;
        *)
            ORIGIN="$1"
            shift
            ;;
    esac
done

if [ "$(id -u)" -ne 0 ]; then
    echo "Root is required: managed policy lives under /etc and is ignored if a normal user can write it." >&2
    echo "Run it again as: sudo $0 $INVOCATION" >&2
    exit 1
fi

# The capture policies are matched against the requesting page's origin, and a
# path in the pattern is not meaningful — it can only fail to match. Catch that
# here rather than leaving someone staring at a kiosk that still prompts.
ORIGIN="${ORIGIN%/}"
if ! printf '%s' "$ORIGIN" | grep -Eq '^https?://[^/[:space:]]+$'; then
    echo "Origin must look like https://app.example.com — scheme and host only, no path, no trailing slash." >&2
    exit 1
fi

if ! printf '%s' "$ORIGIN" | grep -Eq '^https://'; then
    if ! printf '%s' "$ORIGIN" | grep -Eq '://(localhost|127\.0\.0\.1)(:|$)'; then
        echo "Warning: $ORIGIN is not HTTPS. Browsers only grant camera and microphone on secure origins, so this kiosk will still be refused." >&2
    fi
fi

# Browser, its executable, and the directory its managed policy is read from.
# The Chromium entry covers the snap; the chromium-browser entry is the Ubuntu
# and Debian package, which reads a different directory and is silently ignored
# if written to the wrong one.
NAMES=(
    'Google Chrome'
    'Chromium'
    'Chromium (Ubuntu/Debian package)'
    'Microsoft Edge'
)
BINS=(
    'google-chrome'
    'chromium'
    'chromium-browser'
    'microsoft-edge'
)
DIRS=(
    '/etc/opt/chrome/policies/managed'
    '/etc/chromium/policies/managed'
    '/etc/chromium-browser/policies/managed'
    '/etc/opt/edge/policies/managed'
)

TARGETS=()
for i in "${!BINS[@]}"; do
    if [ "$SCOPE" = 'all' ] || command -v "${BINS[$i]}" >/dev/null 2>&1; then
        TARGETS+=("$i")
    fi
done

if [ ${#TARGETS[@]} -eq 0 ]; then
    echo "No known browser found on this machine (looked for: ${BINS[*]})." >&2
    echo "If the browser is installed another way, write all the policy directories with --all." >&2
    exit 1
fi

# Camera and microphone grant without a prompt. Notifications and autoplay are
# here because the operator console needs the first (an alert it cannot show is
# an alert nobody saw) and the kiosk needs the second (a playlist and a ringtone
# must start without a click).
if [ "$NOTIFICATIONS" -eq 1 ]; then
    POLICY=$(cat <<JSON
{
  "VideoCaptureAllowedUrls": ["$ORIGIN"],
  "AudioCaptureAllowedUrls": ["$ORIGIN"],
  "NotificationsAllowedForUrls": ["$ORIGIN"],
  "AutoplayAllowlist": ["$ORIGIN"]
}
JSON
)
else
    POLICY=$(cat <<JSON
{
  "VideoCaptureAllowedUrls": ["$ORIGIN"],
  "AudioCaptureAllowedUrls": ["$ORIGIN"]
}
JSON
)
fi

echo
echo "Kiosk permissions for $ORIGIN"
echo

for i in "${TARGETS[@]}"; do
    name="${NAMES[$i]}"
    dir="${DIRS[$i]}"
    file="$dir/inss-kiosk.json"

    if [ "$REMOVE" -eq 1 ]; then
        if [ -f "$file" ]; then
            rm -f "$file"
            printf '  removed   %-32s %s\n' "$name" "$file"
        fi
        continue
    fi

    install -d -m 0755 -o root -g root "$dir"
    # The directory itself has to be root-only writable, or the browser treats
    # the policy as untrusted and drops it without a word.
    chown root:root "$dir"
    chmod 0755 "$dir"

    printf '%s\n' "$POLICY" > "$file"
    chown root:root "$file"
    chmod 0644 "$file"

    printf '  written   %-32s %s\n' "$name" "$file"
done

echo

if [ "$REMOVE" -eq 1 ]; then
    echo 'Done. Restart the browser for the policy to drop out.'
    echo 'Check chrome://policy or edge://policy: the four policies should be gone.'
    exit 0
fi

# Snap and Flatpak are the two ways this quietly does nothing: the snap is
# reported to read /etc/chromium/policies, and a Flatpak is sandboxed away from
# /etc entirely unless the policy directory is mounted into it.
if command -v snap >/dev/null 2>&1 && snap list 2>/dev/null | grep -Eq '^(chromium|microsoft-edge)'; then
    echo 'Note: a snap-installed browser is included above. If its policy does not show'
    echo 'up, check chrome://policy in that build before concluding the file is wrong.'
    echo
fi
if command -v flatpak >/dev/null 2>&1 && flatpak list --app 2>/dev/null | grep -Eqi 'chrome|chromium|edge'; then
    echo 'Note: a Flatpak browser is sandboxed and does not see /etc. Its policy needs the'
    echo 'directory mounted into the sandbox, or a policy extension point — the files'
    echo 'written above will not reach it.'
    echo
fi

echo 'Done. Now:'
echo '  1. Close the browser completely, then reopen it. Policies are read at'
echo '     start-up, so a running browser keeps the old ones until it restarts.'
echo '  2. Check chrome://policy or edge://policy: each policy must show Source'
echo '     "Platform policy" and Status "OK". A policy that is listed but not OK is'
echo '     an invalid pattern, not a missing file.'
echo '  3. Open the kiosk page and place one test call. The camera should come on'
echo '     with no prompt, and the camera-in-use indicator should appear in the'
echo '     toolbar.'
echo
echo 'Nothing on Linux needs the Windows privacy toggle, but the kiosk account must'
echo 'be able to open /dev/video0: on a distro where the logged-in session does not'
echo 'already grant it, add the user to the video and audio groups.'
