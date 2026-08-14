#!/bin/bash
set -e

BACKUP_DIR=/opt/backups/planning-app
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONTAINER=planning-app-postgres
DUMP_FILE=$BACKUP_DIR/planning_app_$TIMESTAMP.dump

# 可选远程备份配置（默认关闭）
REMOTE_BACKUP_ENABLED=${REMOTE_BACKUP_ENABLED:-false}
REMOTE_PROVIDER=${REMOTE_PROVIDER:-oss} # oss / s3 / cos
REMOTE_BUCKET=${REMOTE_BUCKET:-}
REMOTE_ENDPOINT=${REMOTE_ENDPOINT:-}
REMOTE_ACCESS_KEY=${REMOTE_ACCESS_KEY:-}
REMOTE_SECRET_KEY=${REMOTE_SECRET_KEY:-}

mkdir -p $BACKUP_DIR

echo "$(date '+%Y-%m-%d %H:%M:%S') 开始本地备份: $DUMP_FILE"
docker exec $CONTAINER pg_dump -U postgres -d planning_app -Fc > $DUMP_FILE
LOCAL_SIZE=$(du -h $DUMP_FILE | cut -f1)
echo "$(date '+%Y-%m-%d %H:%M:%S') 本地备份完成, 大小: $LOCAL_SIZE"

# 保留最近 7 天本地备份
find $BACKUP_DIR -name 'planning_app_*.dump' -mtime +7 -delete
LOCAL_COUNT=$(find $BACKUP_DIR -name 'planning_app_*.dump' | wc -l)
echo "$(date '+%Y-%m-%d %H:%M:%S') 本地保留备份数: $LOCAL_COUNT"

# 可选远程上传占位
if [ "$REMOTE_BACKUP_ENABLED" = "true" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') 远程备份已启用，provider=$REMOTE_PROVIDER"
    if [ -x /opt/backups/backup-planning-db-to-oss.sh ]; then
        /opt/backups/backup-planning-db-to-oss.sh "$DUMP_FILE" "$REMOTE_PROVIDER" "$REMOTE_BUCKET" "$REMOTE_ENDPOINT" "$REMOTE_ACCESS_KEY" "$REMOTE_SECRET_KEY"
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') 警告: /opt/backups/backup-planning-db-to-oss.sh 不存在，跳过远程上传"
    fi
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') 远程备份未启用，跳过"
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') 备份流程结束"
