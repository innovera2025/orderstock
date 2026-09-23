#!/usr/bin/env bash
# orderstock — deploy script สำหรับเครื่อง production (Linux + Docker หลัง caddy-gen)
#
# รันในโฟลเดอร์ deploy (ปกติคือ /opt/orderstock):
#
#   ./scripts/deploy.sh              ตรวจ → ดึงโค้ด → build → ขึ้น → เช็กสุขภาพ
#   ./scripts/deploy.sh --check      ตรวจอย่างเดียว ไม่แตะอะไร (ดูว่าพร้อมไหมก่อนลงมือจริง)
#   ./scripts/deploy.sh --no-pull    build + restart จากโค้ดที่มีอยู่แล้ว ไม่ดึงใหม่
#   ./scripts/deploy.sh --rollback   ย้อนไป commit ก่อน deploy ล่าสุด แล้ว build ใหม่
#
# สิ่งที่สคริปต์นี้ "ไม่ทำ" โดยตั้งใจ:
#   - ไม่แตะฐานข้อมูลเลย ไม่รัน migration ไม่รัน seed
#     (db_TCL คือฐาน ERP จริงของลูกค้าที่ orderstock ไปอาศัยอยู่ด้วย —
#      ดู process/context/database/all-database.md §DANGER guardrails)
#   - ไม่อ่านและไม่แก้ไฟล์ตั้งค่าสภาพแวดล้อมบนเครื่อง
#   - ไม่ลบ image หรือ volume เก่า
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
COMPOSE_FILE="docker-compose.prod.yml"
DC="docker compose -f ${COMPOSE_FILE}"
SHA_FILE=".deploy-last-sha"
ENV_FILE=".env"
PUBLIC_URL="https://orderstock.krs.co.th"

MODE="deploy"
PULL=1
for arg in "$@"; do
  case "$arg" in
    --check)    MODE="check" ;;
    --rollback) MODE="rollback" ;;
    --no-pull)  PULL=0 ;;
    -h|--help)  sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "ไม่รู้จักตัวเลือก: $arg  (ดู --help)" >&2; exit 2 ;;
  esac
done

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()   { printf '   \033[32m OK \033[0m %s\n' "$*"; }
warn() { printf '   \033[33m !! \033[0m %s\n' "$*"; }
die()  { printf '\n\033[31mหยุด: %s\033[0m\n' "$*" >&2; exit 1; }

# ------------------------------------------------------------------ ตรวจก่อนเริ่ม
say "ตรวจความพร้อม"

[ -f "$COMPOSE_FILE" ] || die "ไม่พบ $COMPOSE_FILE — ต้องรันในโฟลเดอร์ deploy (ปกติคือ /opt/orderstock)"
ok "พบ $COMPOSE_FILE ที่ $ROOT"

command -v docker >/dev/null 2>&1 || die "ไม่พบคำสั่ง docker"
docker compose version >/dev/null 2>&1 || die "ไม่พบ docker compose v2 — สคริปต์นี้ใช้ 'docker compose' ไม่ใช่ 'docker-compose'"
ok "docker + docker compose พร้อม"

[ -f "$ENV_FILE" ] || die "ไม่พบไฟล์ตั้งค่า $ENV_FILE — แอปจะขึ้นไม่ได้"
ok "พบไฟล์ตั้งค่า (สคริปต์ไม่อ่านค่าข้างในและไม่แก้ไข)"

# ERP_TEST_FORCE_DOWN เป็นสวิตช์จำลอง ERP ล่มสำหรับเทสต์เท่านั้น ห้ามติดมาบน production
if grep -qE '^[[:space:]]*ERP_TEST_FORCE_DOWN[[:space:]]*=[[:space:]]*1' "$ENV_FILE" 2>/dev/null; then
  die "พบสวิตช์ทดสอบ ERP_TEST_FORCE_DOWN=1 ค้างอยู่ — เอาออกก่อน deploy"
fi
ok "ไม่มีสวิตช์ทดสอบค้างอยู่"

git rev-parse --git-dir >/dev/null 2>&1 || die "โฟลเดอร์นี้ไม่ใช่ git repo — ดึงโค้ดใหม่ไม่ได้"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] || warn "ตอนนี้อยู่ branch '$BRANCH' ไม่ใช่ main"

DIRTY="$(git status --porcelain | grep -v '^?? ' || true)"
if [ -n "$DIRTY" ]; then
  warn "มีไฟล์ถูกแก้บนเครื่องนี้และยังไม่ commit:"
  echo "$DIRTY" | sed 's/^/        /'
  [ "$PULL" = "1" ] && die "การดึงโค้ดใหม่จะทับของพวกนี้ — จัดการก่อน หรือใช้ --no-pull"
fi
ok "working tree สะอาดพอจะ deploy"

CURRENT_SHA="$(git rev-parse HEAD)"
ok "commit ปัจจุบัน: $(git log --oneline -1)"

if [ "$MODE" = "check" ]; then
  say "โหมด --check: ตรวจอย่างเดียว ไม่ได้เปลี่ยนอะไรเลย"
  exit 0
fi

# ------------------------------------------------------------------ rollback
if [ "$MODE" = "rollback" ]; then
  [ -f "$SHA_FILE" ] || die "ไม่พบ $SHA_FILE จึงไม่รู้ว่าจะย้อนไปไหน — ต้องย้อนเองด้วย git checkout <sha>"
  TARGET="$(cat "$SHA_FILE")"
  say "ย้อนกลับไปที่"
  git log --oneline -1 "$TARGET" | sed 's/^/   /' || die "ไม่รู้จัก commit $TARGET"
  printf '   พิมพ์ yes แล้ว Enter เพื่อยืนยัน: '
  read -r CONFIRM
  [ "$CONFIRM" = "yes" ] || die "ยกเลิกแล้ว ไม่มีอะไรเปลี่ยน"
  git checkout "$TARGET"
  PULL=0
fi

# ------------------------------------------------------------------ ดึงโค้ด
if [ "$PULL" = "1" ]; then
  say "ดึงโค้ดใหม่"
  echo "$CURRENT_SHA" > "$SHA_FILE"   # เก็บไว้ให้ --rollback ใช้
  git fetch --prune origin
  if git merge-base --is-ancestor HEAD "origin/${BRANCH}" 2>/dev/null; then
    git merge --ff-only "origin/${BRANCH}"
  else
    die "ดึงแบบ fast-forward ไม่ได้ (โค้ดบนเครื่องนี้แยกทางกับ origin/${BRANCH}) — ตรวจด้วยมือก่อน"
  fi
  NEW_SHA="$(git rev-parse HEAD)"
  if [ "$NEW_SHA" = "$CURRENT_SHA" ]; then
    ok "ไม่มีอะไรใหม่ (จะ build ใหม่ตามเดิม)"
  else
    ok "อัปเดตเป็น:"
    git log --oneline "${CURRENT_SHA}..${NEW_SHA}" | sed 's/^/        /'
    printf '\n   ไฟล์ที่เปลี่ยน:\n'
    git diff --stat "${CURRENT_SHA}..${NEW_SHA}" | tail -20 | sed 's/^/        /'
  fi
fi

# ------------------------------------------------------------------ build + ขึ้น
say "build แล้วสั่งขึ้น (ใช้เวลาสักพัก)"
$DC up -d --build
ok "สั่งขึ้นเรียบร้อย"

# ------------------------------------------------------------------ เช็กสุขภาพ
say "รอแอปพร้อมรับงาน"
HEALTHY=0
for i in $(seq 1 60); do
  if $DC exec -T app node -e 'fetch("http://127.0.0.1:3000/api/health").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then
    HEALTHY=1
    ok "แอปตอบ /api/health แล้ว (หลัง ${i} วินาที)"
    break
  fi
  sleep 1
done

if [ "$HEALTHY" != "1" ]; then
  printf '\n'
  warn "แอปยังไม่ตอบภายใน 60 วินาที — log 40 บรรทัดล่าสุด:"
  $DC logs --tail=40 app || true
  die "deploy ไม่สำเร็จ ย้อนกลับด้วย: ./scripts/deploy.sh --rollback"
fi

say "ตรวจการเชื่อมต่อ ERP"
ERP_JSON="$($DC exec -T app node -e 'fetch("http://127.0.0.1:3000/api/health/erp").then(r=>r.text()).then(t=>process.stdout.write(t)).catch(e=>process.stdout.write("{\"ok\":false,\"error\":\""+e.message+"\"}"))' 2>/dev/null || echo '{"ok":false}')"
echo "   $ERP_JSON"
case "$ERP_JSON" in
  *'"ok":true'*) ok "ต่อ ERP ได้" ;;
  *)             warn "ต่อ ERP ไม่ได้ — หน้าแดชบอร์ดจะขึ้นข้อความแจ้ง ไม่ได้พังทั้งหน้า ให้ตรวจค่า ERP_DATABASE_URL" ;;
esac
case "$ERP_JSON" in
  *'"loginCheck":"read-only"'*)     ok "ใช้ login แบบอ่านอย่างเดียว (ถูกต้องแล้ว)" ;;
  *'"loginCheck":"write-capable"'*) warn "ยังใช้ login ที่เขียนฐานข้อมูลได้ — ตัวแอปไม่เขียน ERP อยู่แล้ว แต่ควรให้ DBA สร้าง login อ่านอย่างเดียวตาม db/create-erp-readonly-login.sql" ;;
esac

if command -v curl >/dev/null 2>&1; then
  say "ตรวจทางเข้าจากภายนอก"
  CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${PUBLIC_URL}/api/health" || echo "000")"
  case "$CODE" in
    200) ok "${PUBLIC_URL} ตอบ 200" ;;
    000) warn "เรียก ${PUBLIC_URL} จากเครื่องนี้ไม่ได้ — อาจเป็นเรื่อง DNS หรือไฟร์วอลล์ ลองเปิดจากเบราว์เซอร์" ;;
    *)   warn "${PUBLIC_URL} ตอบ HTTP ${CODE} — ตรวจ caddy-gen" ;;
  esac
fi

# ------------------------------------------------------------------ สรุป
say "deploy เสร็จแล้ว"
git log --oneline -1 | sed 's/^/   /'
cat <<EOF

   ตรวจต่อด้วยตาอีก 4 อย่าง:
     1. เปิด ${PUBLIC_URL}/dashboards/sales ด้วยบัญชีผู้ดูแลระบบ
        ต้องเห็นสองส่วน "ยอดขาย" (ตามใบแจ้งหนี้) อยู่บน และ "การส่งมอบ" อยู่ล่าง
     2. เปิดด้วยบัญชีพนักงาน — ต้องไม่เห็นตัวเลขเงินที่ไหนเลย
     3. กดส่งออก CSV ทั้งฝั่งใบแจ้งหนี้และใบส่งสินค้า ต้องได้ไฟล์ ไม่ใช่ error
     4. เปิดหน้ายอดซื้อและหน้าการผลิต พร้อมกดส่งออกด้วย (ใช้โค้ดส่งออกร่วมกัน)

   ถ้าต้องย้อนกลับ:  ./scripts/deploy.sh --rollback
   ดู log สด:        ${DC} logs -f app

EOF
