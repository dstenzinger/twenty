#!/bin/sh
set -e

mkdir -p /state

# Checks run often but only act when a job is due, so a laptop that was off catches up on wake
cat > /etc/crontabs/root <<'EOF'
*/30 * * * * /usr/local/bin/crm-ops maybe-backup >> /state/ops.log 2>&1
15 * * * * /usr/local/bin/crm-ops maybe-update >> /state/ops.log 2>&1
EOF

crond -b -L /state/cron.log

(sleep 120 && /usr/local/bin/crm-ops maybe-backup >> /state/ops.log 2>&1) &

exec httpd -f -p 8080 -h /www
