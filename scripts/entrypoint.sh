#!/bin/sh
# 容器入口：同时拉起任务服务与 Caddy，收到 SIGTERM 时两个都优雅退出。
# 任务服务先起，Caddy 后起（健康检查会立即打 /api/health）。
set -eu

export DOCS1_PORT="${DOCS1_PORT:-8787}"
export DOCS1_WORKSPACE="${DOCS1_WORKSPACE:-/var/lib/docs1-tasks}"
export PYTHONUNBUFFERED=1
mkdir -p "$DOCS1_WORKSPACE"

echo "[entrypoint] 启动任务服务：端口 $DOCS1_PORT，工作区 $DOCS1_WORKSPACE" >&2
python3 -m service.app &
SERVICE_PID=$!

echo "[entrypoint] 启动 Caddy" >&2
caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
CADDY_PID=$!

stop() {
	trap - TERM INT
	echo "[entrypoint] 收到停止信号，开始退出" >&2
	kill -TERM "$CADDY_PID" 2>/dev/null || true
	kill -TERM "$SERVICE_PID" 2>/dev/null || true
	wait "$CADDY_PID" 2>/dev/null || true
	wait "$SERVICE_PID" 2>/dev/null || true
	exit 0
}
trap stop TERM INT

# 任一进程退出即认为容器该退出，交给编排层重启。
while kill -0 "$SERVICE_PID" 2>/dev/null && kill -0 "$CADDY_PID" 2>/dev/null; do
	sleep 2
done

echo "[entrypoint] 有子进程退出，容器退出" >&2
stop
