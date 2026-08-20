#!/bin/bash
set -e
LOGIN=$(curl -s -X POST http://127.0.0.1:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"planning-test@example.com","password":"Test@123456"}')
TOKEN=$(echo "$LOGIN" | grep -o '"accessToken":"[^"]*"' | head -1 | cut -d'"' -f4)
TASK=$(curl -s -X POST http://127.0.0.1:3001/api/v1/tasks -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"title":"后台FCM推送测试"}' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
TRIGGER=$(date -u -d "+25 seconds" +%Y-%m-%dT%H:%M:%SZ)
REM=$(curl -s -X POST http://127.0.0.1:3001/api/v1/reminders -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"targetType":"task","targetId":"'"$TASK"'","channel":"push","triggerAt":"'"$TRIGGER"'"}' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "任务=$TASK 提醒=$REM 触发时间=$TRIGGER"
echo "等待 60 秒后读取服务端日志..."
sleep 60
echo "=== 后端 FCM/提醒日志 ==="
journalctl -u planning-api --since "90 seconds ago" --no-pager -q | grep -iE "fcm|推送|messaging|reminder|到期提醒" || echo "无匹配日志"
echo "=== mihomo FCM 代理日志 ==="
journalctl -u mihomo --since "90 seconds ago" --no-pager -q | grep -iE "fcm.googleapis.com" || echo "无匹配日志"
