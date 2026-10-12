#!/bin/sh

STATE_DIRECTORY=${STATE_DIRECTORY:-/state}
LOCK_DIRECTORY=$STATE_DIRECTORY/update.lock
BACKUP_DIRECTORY=${BACKUP_DIRECTORY:-/backups}
BACKUPS_TO_KEEP=${BACKUPS_TO_KEEP:-14}
UPDATE_INTERVAL_SECONDS=$((7 * 24 * 3600))
BACKUP_INTERVAL_SECONDS=$((24 * 3600))
PROD_PROJECT=${CRM_PROJECT:-twenty-crm}
DEV_PROJECT=${CRM_DEV_PROJECT:-twenty-crm-dev}

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*"
}

compose() {
  project=$1
  env_file=$2
  shift 2
  docker compose -p "$project" --env-file "$env_file" -f ${CRM_DIRECTORY:-/crm}/docker-compose.yml "$@"
}

is_project_running() {
  [ -n "$(docker ps -q --filter "label=com.docker.compose.project=$1")" ]
}

seconds_since() {
  stamp_file=$1
  if [ ! -f "$stamp_file" ]; then
    echo 999999999
    return
  fi
  echo $(($(date +%s) - $(cat "$stamp_file")))
}

update_project() {
  compose "$1" "$2" pull --quiet server worker &&
    compose "$1" "$2" up -d --no-deps server worker
}

run_update() {
  if ! mkdir "$LOCK_DIRECTORY" 2>/dev/null; then
    log "update already running"
    return 0
  fi
  trap 'rmdir "$LOCK_DIRECTORY"' EXIT
  log "update started"
  if update_project "$PROD_PROJECT" ${CRM_DIRECTORY:-/crm}/.env; then
    date +%s > "$STATE_DIRECTORY/last-update"
    log "production updated"
  else
    log "production update failed"
  fi
  if is_project_running "$DEV_PROJECT" && [ -f ${CRM_DIRECTORY:-/crm}/.env.dev ]; then
    update_project "$DEV_PROJECT" ${CRM_DIRECTORY:-/crm}/.env.dev && log "working copy updated"
  fi
}

run_backup() {
  if ! is_project_running "$PROD_PROJECT"; then
    return 0
  fi
  stamp=$(date +%Y-%m-%d_%H%M)
  database_file="$BACKUP_DIRECTORY/crm-database_$stamp.dump"
  files_file="$BACKUP_DIRECTORY/crm-files_$stamp.tgz"
  if compose "$PROD_PROJECT" ${CRM_DIRECTORY:-/crm}/.env exec -T db pg_dump -U postgres -d default -Fc > "$database_file" &&
    compose "$PROD_PROJECT" ${CRM_DIRECTORY:-/crm}/.env exec -T server tar czf - -C /app/packages/twenty-server .local-storage > "$files_file"; then
    date +%s > "$STATE_DIRECTORY/last-backup"
    for pattern in 'crm-database_*.dump' 'crm-files_*.tgz'; do
      # shellcheck disable=SC2086
      ls -1t $BACKUP_DIRECTORY/$pattern 2>/dev/null | tail -n +$((BACKUPS_TO_KEEP + 1)) | xargs -r rm -f
    done
    log "backup saved ($stamp)"
  else
    rm -f "$database_file" "$files_file"
    log "backup failed"
  fi
}

read_stamp() {
  if [ -f "$STATE_DIRECTORY/$1" ]; then
    cat "$STATE_DIRECTORY/$1"
  else
    echo 0
  fi
}

case "$1" in
  update)
    run_update
    ;;
  update-async)
    nohup /usr/local/bin/crm-ops update >> "$STATE_DIRECTORY/ops.log" 2>&1 &
    ;;
  maybe-update)
    [ "$(seconds_since "$STATE_DIRECTORY/last-update")" -ge "$UPDATE_INTERVAL_SECONDS" ] && run_update
    ;;
  backup)
    run_backup
    ;;
  maybe-backup)
    [ "$(seconds_since "$STATE_DIRECTORY/last-backup")" -ge "$BACKUP_INTERVAL_SECONDS" ] && run_backup
    ;;
  status)
    if [ -d "$LOCK_DIRECTORY" ]; then state=updating; else state=idle; fi
    printf '{"state":"%s","lastUpdate":%s,"lastBackup":%s}' "$state" "$(read_stamp last-update)" "$(read_stamp last-backup)"
    ;;
  *)
    echo "usage: crm-ops update|update-async|maybe-update|backup|maybe-backup|status" >&2
    exit 1
    ;;
esac
exit 0
