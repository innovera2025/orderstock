# คู่มือการติดตั้งระบบ orderstock ด้วย Docker + caddy-gen (Linux)

คู่มือนี้สำหรับติดตั้งระบบ orderstock บนเครื่อง **Linux** ด้วย **Docker** โดยให้บริการที่
`https://orderstock.krs.co.th` (โดเมนย่อยของตัวเอง ให้บริการที่ **ราก `/`**) ผ่าน reverse proxy
**caddy-gen** ที่มีอยู่แล้วบนเครื่อง และเชื่อมต่อกับ **Microsoft SQL Server ภายนอก**
(ฐานข้อมูลชื่อ `db_TCL`)

> ทางเลือกสำหรับ Windows/NSSM (ไม่ใช้ Docker) ดูที่ `docs/deployment-guide.md`
> คู่มือฉบับนี้คือแนวทาง Linux/Docker/caddy-gen สำหรับโฮสต์ที่โดเมนย่อย `orderstock.krs.co.th`

> หมายเหตุ: แอปให้บริการที่ **ราก `/`** ของโดเมนย่อยของตัวเอง (ไม่มี subpath / ไม่มี Next.js
> `basePath`) — caddy-gen เพียงกำหนดเส้นทางตาม **host** (`orderstock.krs.co.th`) ไปยังแอป
> โดยตรง ไม่ต้องมี path matcher และไม่มี prefix ให้ตัดหรือส่งต่อ

---

## ⚠️ คำเตือนสำคัญ: `db_TCL` คือฐานข้อมูล ERP จริงของลูกค้า

**ฐานข้อมูล `db_TCL` บนเซิร์ฟเวอร์ SQL Server ภายนอกของลูกค้า ไม่ใช่ฐานข้อมูลเฉพาะของ orderstock
— แต่เป็นฐานข้อมูล ERP/บัญชีที่ใช้งานจริงของลูกค้า** ซึ่งมีตารางอื่นอีกหลายร้อยตารางที่ไม่เกี่ยวกับ
orderstock (เช่น Customer, Supplier, SalesInvoiceHdr/Dtl, InventoryItem, AccountChart ฯลฯ)
ตาราง 9 ตารางของ orderstock อยู่ร่วมในฐานข้อมูลเดียวกันนี้ **ห้ามแตะต้องตารางอื่นนอกเหนือจาก
9 ตารางของ orderstock โดยเด็ดขาด**

**กฎความปลอดภัยที่ต้องปฏิบัติตามเสมอ:**

1. **ห้ามรัน `prisma migrate reset`, `prisma migrate dev`, หรือ `prisma db push --force-reset`
   กับ `db_TCL` โดยเด็ดขาด** — คำสั่งเหล่านี้จะ **ลบตารางทั้งหมด** ในฐานข้อมูล ซึ่งหมายถึงข้อมูล ERP
   ทั้งระบบของลูกค้าจะหายไปด้วย ไม่ใช่แค่ตารางของ orderstock
2. **ห้ามรันสคริปต์ `db/create-database-and-login.sql` ซ้ำกับเซิร์ฟเวอร์จริงอีก** — สคริปต์นี้ถูกใช้ไปแล้วครั้งเดียว
   ตอนติดตั้งครั้งแรก (ดูคำเตือนภายในไฟล์สคริปต์)
3. **ห้ามแก้ไข `COMPATIBILITY_LEVEL`** ของฐานข้อมูล `db_TCL` — ฐานข้อมูลนี้ตั้งไว้ที่ 130 อยู่แล้ว
   และแอปทำงานได้ปกติที่ระดับนี้ การเปลี่ยนค่านี้จะกระทบ query plan ของระบบ ERP ทั้งระบบของลูกค้า
   ไม่ใช่แค่ orderstock
4. การใช้งานแอปตามปกติ (เพิ่ม/แก้ไขร้านค้า สินค้า บันทึกออเดอร์) และการ seed ข้อมูลเริ่มต้น
   (`prisma/seed.ts`) เป็นการดำเนินการที่ปลอดภัย เพราะแตะเฉพาะ 9 ตารางของ orderstock เท่านั้น

รายละเอียดทางเทคนิคเพิ่มเติม: `process/context/database/all-database.md` หัวข้อ
"Production DB: shared ERP database db_TCL — DANGER guardrails"

---

## ค่าที่ต้องเตรียม (Required values — แทนที่ `__PLACEHOLDER__` และเตรียม DNS ก่อนติดตั้ง)

ระบบมีค่า 4 ตัวที่ผู้ติดตั้งต้องเตรียมเอง (ยังไม่ทราบตอนสร้างชุดติดตั้ง):

| ค่า | อยู่ที่ | วิธีหา / จัดการ |
|---|---|---|
| DNS A-record `orderstock.krs.co.th` | ระบบ DNS ของโดเมน `krs.co.th` (ไม่มี placeholder) | สร้าง A-record ชี้ `orderstock.krs.co.th` → **IP สาธารณะของเครื่องโฮสต์** (ดูข้อ 2) |
| `__PLACEHOLDER_CADDY_NETWORK__` | `docker-compose.prod.yml` (`networks.caddy.name`) | เครือข่าย Docker ภายนอกที่ container caddy-gen ต่ออยู่ — ดูจาก `docker network ls` แล้ว `docker inspect <caddy-gen-container>` |
| `__PLACEHOLDER_TLS_EMAIL__` | `docker-compose.prod.yml` (label `virtual.tls-email`) | อีเมลฝ่ายไอทีสำหรับออกใบรับรอง Let's Encrypt (ACME) |
| `__PLACEHOLDER_COMPAT_LEVEL__` | `db/create-database-and-login.sql` | เวอร์ชัน SQL Server ภายนอก: 140 = 2017, 150 = 2019, 160 = 2022 (ดู `SELECT SERVERPROPERTY('ProductVersion')`) |

---

## 1. สิ่งที่ต้องเตรียม (Prerequisites)

- เครื่อง **Linux** ที่มี **Docker** และ **Docker Compose (v2, `docker compose`)**
- **caddy-gen** ที่กำลังรันอยู่บนเครื่อง พร้อม **เครือข่าย Docker ภายนอก** ที่มันต่ออยู่
- สิทธิ์จัดการ **DNS ของโดเมน `krs.co.th`** เพื่อสร้าง A-record ของโดเมนย่อย (ดูข้อ 2)
- สิทธิ์เข้าถึง **SQL Server ภายนอก** (เวอร์ชัน 2017 ขึ้นไป) ในฐานะ sysadmin เพื่อรันสคริปต์สร้างฐานข้อมูล
- เว็บเบราว์เซอร์ **Chrome หรือ Microsoft Edge** สำหรับการพิมพ์ (ดูข้อ 8)

---

## 2. สร้าง DNS A-record ของโดเมนย่อย

แอปให้บริการที่โดเมนย่อยของตัวเอง caddy-gen จะออกใบรับรอง TLS และกำหนดเส้นทางตาม **host** ดังนั้น
โดเมนย่อยต้องชี้มาที่เครื่องโฮสต์ก่อน:

1. ที่ระบบจัดการ DNS ของ `krs.co.th` สร้าง **A-record**:
   - ชื่อ (host): `orderstock` (จะได้ FQDN เป็น `orderstock.krs.co.th`)
   - ชนิด: `A`
   - ค่า: **IP สาธารณะของเครื่องโฮสต์** (เครื่องเดียวกับที่รัน caddy-gen)
   - (ถ้าใช้ IPv6 ด้วย ให้เพิ่ม `AAAA`-record ชี้ IPv6 ของโฮสต์)
2. รอให้ DNS แพร่กระจาย แล้วตรวจว่าชี้ถูกต้อง:
   ```
   dig +short orderstock.krs.co.th
   ```
   ต้องได้ IP ของเครื่องโฮสต์ ก่อนไปข้อถัดไป (caddy-gen ต้องเห็นโดเมนชี้มาที่มันจึงจะออกใบรับรอง
   Let's Encrypt ได้สำเร็จ)

> หมายเหตุ: หากมีไฟร์วอลล์ ต้องเปิดพอร์ต **80 และ 443** เข้าเครื่องโฮสต์ เพื่อให้ ACME (Let's Encrypt)
> ตรวจสอบและออกใบรับรองได้

---

## 3. สร้างฐานข้อมูลและผู้ใช้บน SQL Server ภายนอก

รันสคริปต์ SQL **ตามลำดับ** บนเซิร์ฟเวอร์ SQL ภายนอก (ด้วยล็อกอินสิทธิ์ผู้ดูแล เช่น `sa`):

1. **`db/create-database-and-login.sql`** — สร้างฐานข้อมูล **`db_TCL`**, ล็อกอิน `orderstock_app`, ผู้ใช้ และสิทธิ์
   - **สำคัญ (ก่อนรัน):**
     - แก้รหัสผ่านในบรรทัด `CREATE LOGIN ... WITH PASSWORD = N'REPLACE_WITH_A_STRONG_PASSWORD'` ให้เป็นรหัสผ่านที่ปลอดภัย
     - เปิดใช้และตั้งค่า `COMPATIBILITY_LEVEL` แทนที่ `__PLACEHOLDER_COMPAT_LEVEL__` ให้ตรงเวอร์ชัน SQL Server
2. **`db/create-orderstock-schema.sql`** — สร้างตารางทั้งหมด
   - **ต้องเลือกฐานข้อมูล `db_TCL` ก่อนรัน:** `USE [db_TCL];`
   - หมายเหตุ: ชื่อไฟล์ยังเป็น `create-orderstock-schema.sql` แต่ฐานข้อมูลชื่อ `db_TCL` (ตั้งใจให้ชื่อไฟล์ไม่ตรงชื่อ DB เพื่อลดการเปลี่ยนแปลง)

> สิทธิ์: สคริปต์ให้ `db_owner` สำหรับการติดตั้งครั้งแรก หากต้องการจำกัดสิทธิ์ภายหลัง ดูหมายเหตุในไฟล์สคริปต์ (`db_datareader` + `db_datawriter`)

---

## 4. ตั้งค่าไฟล์ `.env` บนโฮสต์

วางโปรเจกต์ไว้ที่ `/opt/orderstock` แล้วสร้างไฟล์ `.env` (คัดลอกจาก `.env.example` แล้วแก้ค่าในบล็อก PRODUCTION):

- **`DATABASE_URL`** — ชี้ไปที่ SQL Server ภายนอก ฐานข้อมูล `db_TCL`:
  ```
  DATABASE_URL="sqlserver://<EXTERNAL-HOST>:1433;database=db_TCL;user=orderstock_app;password={รหัสผ่านที่ตั้งไว้};encrypt=true;trustServerCertificate=true"
  ```
  อักขระพิเศษในรหัสผ่าน ( `: \ = ; / [ ] { }` ) ต้องครอบด้วยปีกกา เช่น `password={Pa:ss;word}`
- **`AUTH_SECRET`** — สร้างด้วย `openssl rand -base64 32`
- **`AUTH_TRUST_HOST=true`** — จำเป็น (caddy-gen เป็นตัวส่งต่อ host/X-Forwarded-*)
- **`AUTH_URL`** — **ปล่อยว่าง (แนะนำ)** เมื่อ caddy-gen ส่งต่อ Host/X-Forwarded-* ถูกต้อง
  - หากจำเป็นต้องตั้ง ให้ใส่เฉพาะ **origin ของโดเมนย่อยเปล่า** `https://orderstock.krs.co.th` เท่านั้น (ห้ามต่อท้าย path ใดๆ)

> หมายเหตุ: `MSSQL_SA_PASSWORD` และ `DATABASE_URL` แบบ sandbox (localhost) เป็นค่าสำหรับ **dev เท่านั้น** production ใช้ SQL Server ภายนอก
> ไม่ต้องตั้ง `NEXT_PUBLIC_BASE_PATH` — แอปให้บริการที่รากของโดเมนย่อย ไม่มี basePath

---

## 5. ตั้งค่า compose แล้วสั่ง build + รัน

1. เปิด `docker-compose.prod.yml` แล้วแทนที่ `__PLACEHOLDER__` ทั้งสอง:
   - `networks.caddy.name` → ชื่อเครือข่ายภายนอกของ caddy-gen (จาก `docker network ls`)
   - label `virtual.tls-email` → อีเมล ACME
2. ยืนยันว่า DNS ของ `orderstock.krs.co.th` ชี้มาที่เครื่องโฮสต์แล้ว (ข้อ 2) — caddy-gen ต้องออกใบรับรองตามโดเมนนี้ได้
3. สั่ง build + รัน (จาก `/opt/orderstock`):
   ```
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   - caddy-gen จะกำหนดเส้นทาง `orderstock.krs.co.th` → container พอร์ต 3000 ตาม label `virtual.host`
   - ไม่มีการเปิดพอร์ตบนโฮสต์ (`ports:` ไม่มี) เข้าถึงผ่าน caddy-gen เท่านั้น (พอร์ต 3000 บนโฮสต์อาจถูก `qtso-app` ใช้อยู่)

---

## 6. สร้างผู้ดูแลระบบเริ่มต้น (Admin seed)

รันครั้งเดียว (ส่งรหัสผ่านผ่าน env ชั่วคราว ไม่ต้องเก็บถาวร):

```
docker compose -f docker-compose.prod.yml run --rm -e SEED_ADMIN_PASSWORD=<รหัสผ่านที่ปลอดภัย> app pnpm tsx prisma/seed.ts
```

ระบบจะสร้างบัญชี ADMIN เริ่มต้น หากไม่ได้ตั้ง `SEED_ADMIN_PASSWORD` ระบบจะสุ่มและแสดงบนหน้าจอ (จดไว้)
**เปลี่ยนรหัสผ่านหลังเข้าสู่ระบบครั้งแรก** และส่งมอบรหัสผ่านแบบ out-of-band

---

## 7. ตรวจสอบ (Verify)

- เปิด `https://orderstock.krs.co.th` — เมื่อยังไม่ล็อกอินต้องถูกพาไปที่ `/login`
- เข้าสู่ระบบด้วยบัญชี ADMIN ที่ seed ไว้ — ต้องมาที่ราก `/` และไฟแสดงสถานะฐานข้อมูลเป็นสีเขียว
- ตรวจ health: เปิด `https://orderstock.krs.co.th/api/health` (หลังล็อกอิน) — ต้องได้ `{"ok":true}`

---

## 8. คำแนะนำการพิมพ์ (สำคัญมากเพื่อให้ตรงแบบฟอร์ม)

- ใช้ **Chrome หรือ Microsoft Edge เท่านั้น** (เบราว์เซอร์อื่นเลย์เอาต์อาจเพี้ยน)
- ในหน้าต่างพิมพ์ (Print):
  - **Scale (มาตราส่วน) = 100%** (อย่าใช้ "Fit to page")
  - **ปิด Headers และ Footers**
  - ขนาดกระดาษ **A4** แนวนอน (Landscape)
- **ทดสอบพิมพ์จริงที่หน้างานอย่างน้อยหนึ่งครั้ง** ก่อนใช้งานจริง เพื่อยืนยันขนาด (มิลลิเมตร) ตรงตามแบบฟอร์ม

---

## 9. เปลี่ยนการเชื่อมต่อฐานข้อมูล (แก้ไฟล์ `.env` + รีสตาร์ท)

การเปลี่ยนการเชื่อมต่อฐานข้อมูลทำที่ไฟล์ `.env` บนโฮสต์โดยตรง แล้วรีสตาร์ท container
(ไม่มีหน้าตั้งค่าในแอปแล้ว):

1. แก้ไฟล์ `.env` บนโฮสต์ (`/opt/orderstock/.env`) — แก้บรรทัด `DATABASE_URL=` ให้เป็นสายการเชื่อมต่อใหม่
   (รูปแบบ JDBC ของ Prisma; อักขระพิเศษในรหัสผ่านครอบด้วยปีกกา เช่น `password={Pa:ss;word}`)
2. แนะนำให้สำรองไฟล์เดิมก่อนแก้: `cp /opt/orderstock/.env /opt/orderstock/.env.bak`
3. รีสตาร์ทแอปเพื่อให้ค่าใหม่มีผล:
   ```
   docker compose -f docker-compose.prod.yml restart
   ```
   (หรือ `docker restart orderstock-app-1` ตามชื่อ container จริง)

**หมายเหตุ:**
- ไฟล์ `.env` อยู่บน **โฮสต์** และ bind-mount เข้า container จึงคงอยู่ข้ามการรีสตาร์ท/รีบิลด์
- แอปอ่านค่า `DATABASE_URL` ใหม่ตอนบูตเสมอ (`resolve-database-url.ts` อ่านค่าดิบจากไฟล์โดยตรง)
- ตรวจสถานะหลังรีสตาร์ทที่ `/api/health` — ควรได้ `{"ok":true}`

---

## 10. การกู้คืนเมื่อถูกล็อกเอาต์ + การสำรองข้อมูล

- **Lockout recovery:** ระบบตรวจการเชื่อมต่อก่อนบันทึกเสมอ แต่หากฐานข้อมูลล่มภายหลังจนเข้าไม่ได้:
  แก้ที่ไฟล์ `.env` บนโฮสต์โดยตรง — แก้ `DATABASE_URL` ให้ถูก **หรือ** กู้จากสำรอง:
  ```
  cp /opt/orderstock/.env.bak /opt/orderstock/.env
  docker compose -f docker-compose.prod.yml up -d
  ```
  ระบบไม่มีทางลัดเข้าโดยไม่ผ่านการยืนยันตัวตน (ออกแบบเพื่อความปลอดภัย)
- **สำรองข้อมูล:**
  - **ฐานข้อมูล `db_TCL`:** เป็นความรับผิดชอบของ DBA ลูกค้า (SQL Server Backup / Maintenance Plan) — SQL Server อยู่ภายนอก Docker
  - **ไฟล์ตั้งค่า:** สำรอง `/opt/orderstock/.env` (และ `.env.bak`) ไว้ในที่ปลอดภัย — มีรหัสผ่านฐานข้อมูลและ `AUTH_SECRET` **อย่าเก็บใน source control**

---

## 11. การแก้ปัญหา (Troubleshooting)

| อาการ | วิธีแก้ |
|---|---|
| เปิด `https://orderstock.krs.co.th` ไม่ได้ / 404 หรือใบรับรอง TLS ไม่ออก | ตรวจว่า DNS `orderstock.krs.co.th` ชี้มาที่โฮสต์ (`dig +short`), เปิดพอร์ต 80/443, container ต่อเครือข่าย caddy-gen ที่ถูกต้อง, label `virtual.host`/`virtual.tls-email` ถูกต้อง |
| หน้า login วนซ้ำ หรือ error `Cannot parse action` | ตรวจว่า **ไม่ได้** ตั้ง `AUTH_URL` ผิด (ถ้าตั้ง ต้องเป็น `https://orderstock.krs.co.th` เปล่าๆ ไม่มี path); ตั้ง `AUTH_SECRET` และ `AUTH_TRUST_HOST=true` แล้ว |
| ไฟสถานะฐานข้อมูลแดง / `/api/health` ได้ `ok:false` | ตรวจ `DATABASE_URL` (ชี้ `db_TCL` บน host ภายนอก), SQL Server รันอยู่, ไฟร์วอลล์พอร์ต 1433 |
| พิมพ์แล้วขนาดเพี้ยน | Scale = 100%, ปิด headers/footers, ใช้ Chrome/Edge |
| แก้ `.env` แล้วรีสตาร์ทแต่ค่าไม่เปลี่ยน / แอปไม่กลับมา | ตรวจว่าแก้ไฟล์ `/opt/orderstock/.env` ถูกไฟล์และ bind-mount ถูกต้อง; สั่ง `docker compose -f docker-compose.prod.yml up -d` ด้วยมือ; ตรวจ `/api/health` |

---

## ภาคผนวก — หมายเหตุทางเทคนิค (สำหรับผู้ดูแลระบบ)

- **โดเมนย่อยผ่าน caddy-gen:** caddy-gen กำหนดเส้นทางตาม **host** (`virtual.host: orderstock.krs.co.th`)
  ไปยัง container พอร์ต 3000 โดยตรง แอปให้บริการที่ราก `/` — ไม่มี path matcher, ไม่มี prefix ให้ตัดหรือส่งต่อ
- **DNS ต้องมาก่อน:** ต้องมี A-record `orderstock.krs.co.th` → IP โฮสต์ ก่อน `docker compose up` เพราะ
  caddy-gen ขอใบรับรอง Let's Encrypt ตามโดเมนนี้ (ต้องเปิดพอร์ต 80/443 ให้ ACME ตรวจสอบได้)
- **ไม่มี `NEXT_PUBLIC_BASE_PATH` / ไม่มี `basePath`:** ตั้งแต่ย้ายมาใช้โดเมนย่อย แอปเสิร์ฟที่รากเสมอ
  ไม่ต้องส่ง build ARG หรือ runtime env ใดๆ เกี่ยวกับ subpath
- **ไฟล์ชื่อไม่ตรง DB:** `create-orderstock-schema.sql` รันกับฐานข้อมูล `db_TCL` (ชื่อไฟล์คงเดิมโดยตั้งใจ)
- **ความปลอดภัย:** `AUTH_SECRET` และ `DATABASE_URL` อยู่ในไฟล์ `.env` บนโฮสต์เท่านั้น (gitignored + `.dockerignore` กันไม่ให้เข้า image)
