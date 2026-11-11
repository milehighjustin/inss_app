<#
.SYNOPSIS
    Gives the app its camera, microphone and notification permissions on a
    Windows kiosk, so nothing has to be clicked on an unattended machine.

.DESCRIPTION
    A kiosk is nobody's desk. The first incoming call would otherwise meet a
    permission bubble that the visitor in front of the screen cannot answer, and
    a lobby display that has never been touched has never granted anything. This
    writes the browser enterprise policies that grant the permissions outright,
    and turns on the Windows privacy switches that let desktop apps reach the
    camera and microphone at all - the ones that silently defeat everything
    above them.

    The grant is per origin (scheme + host, no path), so one entry covers the
    kiosk player at /kioskconnect/kiosk/<id> and the lobby display at
    /qr/<id>/kiosk alike.

    Policies are machine-wide (HKLM): they apply to every user of the machine
    and need no browser account or sign-in.

    Open PowerShell as Administrator before running this. If the machine blocks
    scripts, run it as:
        powershell -ExecutionPolicy Bypass -File .\provision-windows.ps1

.PARAMETER Origin
    The app's origin, e.g. https://app.inselfstorage.com. Scheme and host only -
    no path, no trailing slash.

.PARAMETER Browser
    Both (the default), Edge, or Chrome. Writing the policies for a browser that
    is not installed is harmless, so Both is the normal choice.

.PARAMETER NoNotifications
    Camera and microphone only. Use it for a wall display that should never
    raise a toast or start playing on its own.

.PARAMETER Remove
    Delete what this script wrote and put the Windows privacy switches back to
    their default, leaving no policy behind.

.EXAMPLE
    .\provision-windows.ps1

.EXAMPLE
    .\provision-windows.ps1 https://staging.example.com -Browser Edge

.EXAMPLE
    .\provision-windows.ps1 -Remove
#>

#Requires -RunAsAdministrator

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string] $Origin = 'https://app.inselfstorage.com',

    [ValidateSet('Both', 'Edge', 'Chrome')]
    [string] $Browser = 'Both',

    [switch] $NoNotifications,

    [switch] $Remove
)

$ErrorActionPreference = 'Stop'

function Fail([string] $Message) {
    Write-Host $Message -ForegroundColor Red
    exit 1
}

# ----------------------------------------------------------------- the origin -

$origin = $Origin.TrimEnd('/')

# The capture policies are matched against the requesting page's origin, and a
# path in the pattern is not meaningful - it can only fail to match. Catch that
# here rather than leaving someone staring at a kiosk that still prompts.
if ($origin -notmatch '^https?://[^/\s]+$') {
    Fail 'Origin must look like https://app.example.com - scheme and host only, no path, no trailing slash.'
}

$isLocal = $origin -match '://(localhost|127\.0\.0\.1)(:|$)'
if ($origin -notlike 'https://*' -and -not $isLocal) {
    Write-Host "Warning: $origin is not HTTPS. Browsers only grant camera and microphone on secure origins, so this kiosk will still be refused." -ForegroundColor Yellow
}

# ------------------------------------------------------------------ policies -

# Camera and microphone grant without a prompt. Notifications and autoplay are
# here because the operator console needs the first (an alert it cannot show is
# an alert nobody saw) and the kiosk needs the second (a playlist and a ringtone
# must start without a click).
$policies = [ordered]@{
    VideoCaptureAllowedUrls = $origin
    AudioCaptureAllowedUrls = $origin
}

if (-not $NoNotifications) {
    $policies['NotificationsAllowedForUrls'] = $origin
    $policies['AutoplayAllowlist'] = $origin
}

$roots = [ordered]@{}
if ($Browser -eq 'Both' -or $Browser -eq 'Edge') {
    $roots['Edge'] = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge'
}
if ($Browser -eq 'Both' -or $Browser -eq 'Chrome') {
    $roots['Chrome'] = 'HKLM:\SOFTWARE\Policies\Google\Chrome'
}

Write-Host ''
Write-Host "Kiosk permissions for $origin" -ForegroundColor Cyan
Write-Host ''

foreach ($browserName in $roots.Keys) {
    $root = $roots[$browserName]

    foreach ($name in $policies.Keys) {
        $path = Join-Path $root $name

        if ($Remove) {
            if (Test-Path $path) {
                Remove-Item -Path $path -Recurse -Force
                Write-Host ("  removed   {0,-6} {1}" -f $browserName, $name)
            }
            continue
        }

        # Registry lists are numbered REG_SZ values, and overwriting "1" leaves
        # any "2" or "3" from an earlier run in place. Rebuilding the key is the
        # only way to be sure the policy is exactly what was asked for.
        if (Test-Path $path) {
            Remove-Item -Path $path -Recurse -Force
        }
        New-Item -Path $path -Force | Out-Null
        New-ItemProperty -Path $path -Name '1' -Value $policies[$name] -PropertyType String -Force | Out-Null

        Write-Host ("  {0,-10} {1} = {2}" -f $browserName, $name, $policies[$name])
    }
}

# ------------------------------------------------- Windows privacy switches --
#
# Settings -> Privacy & security -> Camera (and Microphone) -> "Let desktop apps
# access your camera". Off is the default on some images and on any machine
# someone has hardened, and when it is off the browser policy above does nothing
# at all: getUserMedia fails with NotAllowedError and the kiosk shows its "access
# was refused" message. Machine scope covers every account.
#
# Removing the value rather than writing Deny leaves Windows at its own default.

$consentRoot = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore'

foreach ($device in @('webcam', 'microphone')) {
    $allApps = Join-Path $consentRoot $device
    $desktopApps = Join-Path $allApps 'NonPackaged'

    foreach ($key in @($allApps, $desktopApps)) {
        if ($Remove) {
            Remove-ItemProperty -Path $key -Name 'Value' -ErrorAction SilentlyContinue
            continue
        }

        if (-not (Test-Path $key)) {
            New-Item -Path $key -Force | Out-Null
        }
        New-ItemProperty -Path $key -Name 'Value' -Value 'Allow' -PropertyType String -Force | Out-Null
    }

    if ($Remove) {
        Write-Host ("  reset     Windows privacy: {0} (back to the Windows default)" -f $device)
    }
    else {
        Write-Host ("  allowed   Windows privacy: desktop apps may use the {0}" -f $device)
    }
}

# -------------------------------------------------------------------- next --

Write-Host ''

if ($Remove) {
    Write-Host 'Done. Restart the browser fully for the policies to be dropped.' -ForegroundColor Cyan
    Write-Host 'Check edge://policy or chrome://policy: the four policies should be gone.'
    exit 0
}

Write-Host 'Done. Now:' -ForegroundColor Cyan
Write-Host '  1. Close the browser completely - every window, and the background app in'
Write-Host '     the notification area. Policies are read at start-up, not per tab.'
Write-Host '  2. Reopen it and check edge://policy or chrome://policy: each policy must'
Write-Host '     show Source "Platform policy" and Status "OK". A value that is listed but'
Write-Host '     not OK is an invalid pattern, not a policy that is missing.'
Write-Host '  3. Open the kiosk page and place one test call. The camera should come on'
Write-Host '     with no prompt, and the camera-in-use icon should appear in the toolbar.'
Write-Host ''
Write-Host 'If it still prompts, in this order: check that the machine is not'
Write-Host 'domain-managed with a conflicting Group Policy for these same policies (a'
Write-Host 'GPO wins over the registry), and that Settings -> Privacy & security ->'
Write-Host 'Camera shows "Camera access" on.'
