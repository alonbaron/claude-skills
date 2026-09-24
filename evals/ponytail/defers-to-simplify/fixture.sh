#!/usr/bin/env bash
set -e
git init -q .
mkdir -p src
cat > src/utils.ts <<'EOF'
export function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `${fmt(start)} - ${fmt(end)}`;
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
EOF
cat > src/report.ts <<'EOF'
import { formatDateRange } from "./utils";

export function renderReportHeader(start: Date, end: Date): string {
  return `Report: ${formatDateRange(start, end)}`;
}
EOF
cat > src/routes.ts <<'EOF'
import { isValidSlug } from "./utils";

export function resolveRoute(slug: string): string {
  if (!isValidSlug(slug)) {
    throw new Error(`invalid slug: ${slug}`);
  }
  return `/articles/${slug}`;
}
EOF
git add src
git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "report header + slug routing"
