#!/bin/bash
# 远程对象存储上传占位脚本
# 用法：backup-planning-db-to-oss.sh <dump_file> <provider> <bucket> <endpoint> <access_key> <secret_key>
# 当前不实际执行上传，仅输出配置提示，便于后续手动启用 aliyun oss / aws s3 / tencent cos / rclone。
set -e

DUMP_FILE=$1
PROVIDER=$2
BUCKET=$3
ENDPOINT=$4
ACCESS_KEY=$5
SECRET_KEY=$6

echo "$(date '+%Y-%m-%d %H:%M:%S') [远程备份占位] provider=$PROVIDER, bucket=$BUCKET, file=$DUMP_FILE"
echo "$(date '+%Y-%m-%d %H:%M:%S') 提示：请根据所选云厂商安装对应 CLI（如 aliyun/ossutil/aws/rclone）并取消下面上传命令的注释。"

# 示例（aliyun ossutil）：
# ossutil cp -f "$DUMP_FILE" "oss://$BUCKET/planning-app-backups/$(basename $DUMP_FILE)"

# 示例（aws cli）：
# aws s3 cp "$DUMP_FILE" "s3://$BUCKET/planning-app-backups/$(basename $DUMP_FILE)" --endpoint-url "$ENDPOINT"

# 示例（rclone）：
# rclone copy "$DUMP_FILE" "remote:$BUCKET/planning-app-backups/"

echo "$(date '+%Y-%m-%d %H:%M:%S') [远程备份占位] 未执行实际上传"
