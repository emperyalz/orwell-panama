#!/usr/bin/env bash
# Park or resume every Orwell agent poller that reads Convex prod (fleet-vole-527).
#
#   scripts/orwell-park.sh park     stop + disable them (survives reboot)
#   scripts/orwell-park.sh resume   enable + start them again
#   scripts/orwell-park.sh status   show what is running
#
# While the fleet is held (dispatchPaused, e.g. the 2026-10-16 unpersisted-usage receipt)
# these jobs only re-read unchanged status, ~850 full-status reads a day. Parked, nothing
# polls Convex; the site still renders from Convex reactively. Paperclip itself, the free
# router and the Monitor workers do not read Politica and are left alone.
set -euo pipefail
VPS="${ORWELL_VPS:-root@srv1352816.hstgr.cloud}"
TIMERS="orwell-agent-controller.timer orwell-groq-free-preparation.timer orwell-groq-free-backlog.timer orwell-parallel-preparation.timer"
SERVICES="orwell-paperclip-bridge.service orwell-pilot-observer.service"
MAC_AGENT="com.orwell.agent-activity"
PLIST="$HOME/Library/LaunchAgents/$MAC_AGENT.plist"
DOMAIN="gui/$(id -u)"

case "${1:-status}" in
 park)
  ssh -o BatchMode=yes "$VPS" "systemctl disable --now $TIMERS $SERVICES"
  launchctl disable "$DOMAIN/$MAC_AGENT"
  launchctl bootout "$DOMAIN/$MAC_AGENT" 2>/dev/null || true
  echo "parked";;
 resume)
  ssh -o BatchMode=yes "$VPS" "systemctl enable --now $TIMERS $SERVICES"
  launchctl enable "$DOMAIN/$MAC_AGENT"
  launchctl bootstrap "$DOMAIN" "$PLIST" 2>/dev/null || launchctl kickstart -k "$DOMAIN/$MAC_AGENT"
  echo "resumed";;
 status) ;;
 *) echo "usage: $0 park|resume|status" >&2; exit 2;;
esac
ssh -o BatchMode=yes "$VPS" "for u in $TIMERS $SERVICES; do printf '%-40s %-9s %s\n' \$u \$(systemctl is-enabled \$u) \$(systemctl is-active \$u); done"
if launchctl print "$DOMAIN/$MAC_AGENT" >/dev/null 2>&1; then echo "$MAC_AGENT (Mac)                  loaded"; else echo "$MAC_AGENT (Mac)                  not loaded"; fi
