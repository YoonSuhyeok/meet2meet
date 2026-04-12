#!/bin/bash
# PostToolUse hook: ts/tsx 파일 작성 후 biome check --write 실행
# stdin으로 전달받은 JSON에서 파일 경로를 추출하여 biome 실행

set -euo pipefail

INPUT=$(cat)

# 도구 이름 확인 (파일 편집 도구만 처리)
TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ "$TOOL_NAME" != "create_file" && "$TOOL_NAME" != "replace_string_in_file" && "$TOOL_NAME" != "multi_replace_string_in_file" ]]; then
    exit 0
fi

# 파일 경로 추출 (toolInput.filePath 또는 첫 번째 filePath)
FILE_PATH=$(echo "$INPUT" | grep -o '"filePath":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -z "$FILE_PATH" ]]; then
    exit 0
fi

# ts/tsx 파일만 처리
if [[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx ]]; then
    exit 0
fi

# biome 실행
npx @biomejs/biome check --write "$FILE_PATH" 2>/dev/null || true
