#!/bin/bash
# 查詢 Turso 本月讀取配額使用量
# 需要環境變數：TURSO_API_TOKEN, TURSO_ORG
# 超過 80%（400M）印警告；超過 90%（450M）以 exit 1 觸發 GitHub Actions 失敗通知

set -e

if [ -z "${TURSO_API_TOKEN}" ]; then
  echo "TURSO_API_TOKEN 未設定，跳過配額檢查。"
  echo "請至 Turso 儀表板 → Account Settings → API Tokens 建立 token，加入 GitHub Secrets。"
  exit 0
fi

LIMIT=500000000
WARN_AT=400000000   # 80%
FAIL_AT=450000000   # 90%

RESP=$(curl -sf -H "Authorization: Bearer ${TURSO_API_TOKEN}" \
  "https://api.turso.tech/v1/organizations/${TURSO_ORG}/usage")

ROWS_READ=$(echo "$RESP" | jq '.usage.rows_read')

PCT=$(echo "scale=1; $ROWS_READ * 100 / $LIMIT" | bc)

echo "本月已讀取：${ROWS_READ} rows（${PCT}% of 500M）"

if [ "$ROWS_READ" -gt "$FAIL_AT" ]; then
  echo "🚨 CRITICAL：已超過 90% 配額（${ROWS_READ}），緊急處理！"
  exit 1
elif [ "$ROWS_READ" -gt "$WARN_AT" ]; then
  echo "⚠️  WARNING：已超過 80% 配額（${ROWS_READ}），注意監控。"
fi
