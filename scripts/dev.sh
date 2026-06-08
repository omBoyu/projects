#!/bin/bash
set -Eeuo pipefail


PORT=5000
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-${PORT}}"


cd "${COZE_WORKSPACE_PATH}"

get_listening_pids() {
    local port="$1"
    if command -v lsof >/dev/null 2>&1; then
        lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true
    elif command -v ss >/dev/null 2>&1; then
        ss -H -lntp 2>/dev/null | awk -v port="${port}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true
    fi
}

is_port_listening() {
    [[ -n "$(get_listening_pids "$1")" ]]
}

kill_port_if_listening() {
    local pids proc_name
    pids=$(get_listening_pids "${DEPLOY_RUN_PORT}")
    if [[ -z "${pids}" ]]; then
        echo "Port ${DEPLOY_RUN_PORT} is free."
        return 0
    fi

    for pid in ${pids}; do
        proc_name=$(ps -p "${pid}" -o comm= 2>/dev/null || echo "unknown")
        if [[ "${proc_name}" == *"ControlCenter"* ]]; then
            echo "Port ${DEPLOY_RUN_PORT} is used by macOS AirPlay Receiver (${proc_name}, PID ${pid})."
            return 1
        fi
    done

    echo "Port ${DEPLOY_RUN_PORT} in use by PIDs: ${pids} (SIGKILL)"
    echo "${pids}" | xargs -I {} kill -9 {} 2>/dev/null || true
    sleep 1

    if is_port_listening "${DEPLOY_RUN_PORT}"; then
        echo "Warning: port ${DEPLOY_RUN_PORT} still busy after SIGKILL."
        return 1
    fi

    echo "Port ${DEPLOY_RUN_PORT} cleared."
    return 0
}

ensure_available_port() {
    if kill_port_if_listening; then
        return 0
    fi

    if [[ "${DEPLOY_RUN_PORT}" == "5000" ]]; then
        echo "Falling back to port 3000. Open http://localhost:3000"
        DEPLOY_RUN_PORT=3000
        return 0
    fi

    echo "Port ${DEPLOY_RUN_PORT} is unavailable."
    echo "Try: PORT=3000 pnpm run dev"
    echo "Or disable AirPlay Receiver: System Settings → General → AirDrop & Handoff"
    exit 1
}

echo "Clearing port ${DEPLOY_RUN_PORT} before start."
ensure_available_port
echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for dev..."

PORT=${DEPLOY_RUN_PORT} pnpm tsx watch src/server.ts
