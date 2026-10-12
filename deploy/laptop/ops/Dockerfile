FROM alpine:3.20

RUN apk add --no-cache docker-cli docker-cli-compose busybox-extras tzdata

COPY ops.sh /usr/local/bin/crm-ops
COPY cgi-bin /www/cgi-bin
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /usr/local/bin/crm-ops /entrypoint.sh /www/cgi-bin/*

ENTRYPOINT ["/entrypoint.sh"]
