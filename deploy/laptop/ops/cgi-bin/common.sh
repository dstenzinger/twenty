#!/bin/sh

ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-"http://localhost:3000 http://127.0.0.1:3000"}

is_allowed_origin() {
  for origin in $ALLOWED_ORIGINS; do
    [ "$HTTP_ORIGIN" = "$origin" ] && return 0
  done
  return 1
}

write_headers() {
  printf 'Content-Type: application/json\r\nCache-Control: no-store\r\n'
  if is_allowed_origin; then
    printf 'Access-Control-Allow-Origin: %s\r\nVary: Origin\r\n' "$HTTP_ORIGIN"
  fi
  printf '\r\n'
}
