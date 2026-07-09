# คู่มือการติดตั้งระบบ orderstock ด้วย Docker + caddy-gen (Linux)

คู่มือนี้สำหรับติดตั้งระบบ orderstock บนเครื่อง **Linux** ด้วย **Docker** โดยให้บริการที่
`https://app.krs.co.th/orderstock` ผ่าน reverse proxy **caddy-gen** ที่มีอยู่แล้วบนเครื่อง
และเชื่อมต่อกับ **Microsoft SQL Server ภายนอก** (ฐานข้อมูลชื่อ `db_TCL`)

> ทางเลือกสำหรับ Windows/NSSM (ไม่ใช้ Docker) ดูที่ `docs/deployment-guide.md`
> คู่มือฉบับนี้คือแนวทาง Linux/Docker/caddy-gen สำหรับโฮสต์ที่ `app.krs.co.th`

> หมายเหตุสำคัญ: แอปให้บริการที่ **subpath `/orderstock`** ไม่ใช่ที่ราก `/` — caddy-gen ต้องส่งต่อ
> prefix `/orderstock` ไปยังแอป **โดยไม่ตัดทิ้ง** (แอปเป็นเจ้าของ prefix เอง ผ่าน Next.js `basePath`)

---

## ค่าที่ต้องเตรียม (Required values — แทนที่ `__PLACEHOLDER__` ก่อนติดตั้ง)

ระบบมีค่า 4 ตัวที่ผู้ติดตั้งต้องกรอกเอง (ยังไม่ทราบตอนสร้างชุดติดตั้ง):

| ค่า | อยู่ที่ | วิธีหา |
|---|---|---|
| `__PLACEHOLDER_CADDY_NETWORK__` | `docker-compose.prod.yml` (`networks.caddy.name`) | เครือข่าย Docker ภายนอกที่ container caddy-gen ต่ออยู่ — ดูจาก `docker network ls` แล้ว `docker inspect <caddy-gen-container>` |
| `__PLACEHOLDER_TLS_EMAIL__` | `docker-compose.prod.yml` (label `virtual.tls-email`) | อีเมลฝ่ายไอทีสำหรับออกใบรับรอง Let's Encrypt (ACME) |
| `__PLACEHOLDER_COMPAT_LEVEL__` | `db/create-database-and-login.sql` | เวอร์ชัน SQL Server ภายนอก: 140 = 2017, 150 = 2019, 160 = 2022 (ดู `SELECT SERVERPROPERTY('ProductVersion')`) |
| host/path ของ `qtso-app` | ตรวจสอบอย่างเดียว (ไม่มี placeholder) | ยืนยันว่า matcher `/orderstock*` ไม่ชนกับ caddy label ของ `qtso-app` บน `app.krs.co.th` — ดู `docker inspect qtso-app` หรือ compose ของมัน |

---

## 1. สิ่งที่ต้องเตรียม (Prerequisites)

- เครื่อง **Linux** ที่มี **Docker** และ **Docker Compose (v2, `docker compose`)**
- **caddy-gen** ที่กำลังรันอยู่บนเครื่อง พร้อม **เครือข่าย Docker ภายนอก** ที่มันต่ออยู่
- สิทธิ์เข้าถึง **SQL Server ภายนอก** (เวอร์ชัน 2017 ขึ้นไป) ในฐานะ sysadmin เพื่อรันสคริปต์สร้างฐานข้อมูล
- เว็บเบราว์เซอร์ **Chrome หรือ Microsoft Edge** สำหรับการพิมพ์ (ดูข้อ 7)

---

## 2. สร้างฐานข้อมูลและผู้ใช้บน SQL Server ภายนอก

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

## 3. ตั้งค่าไฟล์ `.env` บนโฮสต์

วางโปรเจกต์ไว้ที่ `/opt/orderstock` แล้วสร้างไฟล์ `.env` (คัดลอกจาก `.env.example` แล้วแก้ค่าในบล็อก PRODUCTION):

- **`DATABASE_URL`** — ชี้ไปที่ SQL Server ภายนอก ฐานข้อมูล `db_TCL`:
  ```
  DATABASE_URL="sqlserver://<EXTERNAL-HOST>:1433;database=db_TCL;user=orderstock_app;password={รหัสผ่านที่ตั้งไว้};encrypt=true;trustServerCertificate=true"
  ```
  อักขระพิเศษในรหัสผ่าน ( `: \ = ; / [ ] { }` ) ต้องครอบด้วยปีกกา เช่น `password={Pa:ss;word}`
- **`AUTH_SECRET`** — สร้างด้วย `openssl rand -base64 32`
- **`AUTH_TRUST_HOST=true`** — จำเป็น (caddy-gen เป็นตัวส่งต่อ host/X-Forwarded-*)
- **`AUTH_URL`** — **ปล่อยว่าง (แนะนำ)** เมื่อ caddy-gen ส่งต่อ Host/X-Forwarded-* ถูกต้อง
  - หากจำเป็นต้องตั้ง ให้ใส่เฉพาะ **origin เปล่า** `https://app.krs.co.th` เท่านั้น
  - **ห้าม** ต่อท้ายด้วย `/orderstock` หรือ `/api/auth` เด็ดขาด (จะทำให้ Auth.js error `UnknownAction: Cannot parse action` 400)
- **`NEXT_PUBLIC_BASE_PATH=/orderstock`** — subpath ของแอป (ต้องตรงกับ build ARG ใน compose)

> หมายเหตุ: `MSSQL_SA_PASSWORD` และ `DATABASE_URL` แบบ sandbox (localhost) เป็นค่าสำหรับ **dev เท่านั้น** production ใช้ SQL Server ภายนอก

---

## 4. ตั้งค่า compose แล้วสั่ง build + รัน

1. เปิด `docker-compose.prod.yml` แล้วแทนที่ `__PLACEHOLDER__` ทั้งสอง:
   - `networks.caddy.name` → ชื่อเครือข่ายภายนอกของ caddy-gen (จาก `docker network ls`)
   - label `virtual.tls-email` → อีเมล ACME
2. ยืนยันว่า matcher `/orderstock*` ไม่ชนกับ caddy label ของ `qtso-app` บน `app.krs.co.th`
3. สั่ง build + รัน (จาก `/opt/orderstock`):
   ```
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   - `NEXT_PUBLIC_BASE_PATH=/orderstock` ถูกฝังตอน build (build ARG) และตั้งเป็น runtime env ด้วย (ต้องตรงกัน)
   - ไม่มีการเปิดพอร์ตบนโฮสต์ (`ports:` ไม่มี) เพราะพอร์ต 3000 ถูก `qtso-app` ใช้อยู่ — เข้าถึงผ่าน caddy-gen เท่านั้น

---

## 5. สร้างผู้ดูแลระบบเริ่มต้น (Admin seed)

รันครั้งเดียว (ส่งรหัสผ่านผ่าน env ชั่วคราว ไม่ต้องเก็บถาวร):

```
docker compose -f docker-compose.prod.yml run --rm -e SEED_ADMIN_PASSWORD=<รหัสผ่านที่ปลอดภัย> app pnpm tsx prisma/seed.ts
```

ระบบจะสร้างบัญชี ADMIN เริ่มต้น หากไม่ได้ตั้ง `SEED_ADMIN_PASSWORD` ระบบจะสุ่มและแสดงบนหน้าจอ (จดไว้)
**เปลี่ยนรหัสผ่านหลังเข้าสู่ระบบครั้งแรก** และส่งมอบรหัสผ่านแบบ out-of-band

---

## 6. ตรวจสอบ (Verify)

- เปิด `https://app.krs.co.th/orderstock` — เมื่อยังไม่ล็อกอินต้องถูกพาไปที่ `/orderstock/login`
- เข้าสู่ระบบด้วยบัญชี ADMIN ที่ seed ไว้ — ต้องมาที่ `/orderstock/` และไฟแสดงสถานะฐานข้อมูลเป็นสีเขียว
- ตรวจ health: เปิด `https://app.krs.co.th/orderstock/api/health` (หลังล็อกอิน) — ต้องได้ `{"ok":true}`

---

## 7. คำแนะนำการพิมพ์ (สำคัญมากเพื่อให้ตรงแบบฟอร์ม)

- ใช้ **Chrome หรือ Microsoft Edge เท่านั้น** (เบราว์เซอร์อื่นเลย์เอาต์อาจเพี้ยน)
- ในหน้าต่างพิมพ์ (Print):
  - **Scale (มาตราส่วน) = 100%** (อย่าใช้ "Fit to page")
  - **ปิด Headers และ Footers**
  - ขนาดกระดาษ **A4** แนวนอน (Landscape)
- **ทดสอบพิมพ์จริงที่หน้างานอย่างน้อยหนึ่งครั้ง** ก่อนใช้งานจริง เพื่อยืนยันขนาด (มิลลิเมตร) ตรงตามแบบฟอร์ม

---

## 8. เปลี่ยนการเชื่อมต่อฐานข้อมูลผ่านหน้าแอป (ภายใต้ Docker)

1. เข้าสู่ระบบด้วยบัญชี **ADMIN** แล้วเข้าเมนู **"ตั้งค่าฐานข้อมูล"** (`/orderstock/settings/db`)
2. กรอกข้อมูลการเชื่อมต่อ หรือวาง connection string แล้วกด "เติมค่า"
3. กด **"ทดสอบการเชื่อมต่อ"** — ต้องผ่านก่อน
4. กด **"บันทึกและรีสตาร์ท"** — ระบบสำรอง `.env` เดิมเป็น `.env.bak` เขียนค่าใหม่ แล้วปิดตัวเอง (`process.exit(0)`)

**การใช้งานภายใต้ Docker:**
- compose ตั้ง `restart: unless-stopped` และ **bind-mount `.env` แบบเขียนได้** (`./.env:/app/.env`)
  ดังนั้นเมื่อแอปปิดตัวเอง container จะ **รีสตาร์ทอัตโนมัติ** และอ่านค่าใหม่ตอนบูต
- ไฟล์ `.env` และ `.env.bak` อยู่บน **โฮสต์** (`/opt/orderstock/.env`) จึงคงอยู่ข้ามการรีสตาร์ท/รีบิลด์
- หากรีสตาร์ทไม่สำเร็จเอง สั่งด้วยมือ:
  ```
  docker compose -f docker-compose.prod.yml up -d
  ```

---

## 9. การกู้คืนเมื่อถูกล็อกเอาต์ + การสำรองข้อมูล

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

## 10. การแก้ปัญหา (Troubleshooting)

| อาการ | วิธีแก้ |
|---|---|
| เปิด `https://app.krs.co.th/orderstock` ไม่ได้ / 404 | ตรวจว่า container ต่อเครือข่าย caddy-gen ที่ถูกต้อง, matcher `/orderstock*` ไม่ชนกับ `qtso-app`, label host/tls-email ถูกต้อง |
| หน้า login วนซ้ำ หรือ error `Cannot parse action` | ตรวจว่า **ไม่ได้** ตั้ง `AUTH_URL` ให้มี `/orderstock` หรือ `/api/auth`; ตั้ง `AUTH_SECRET` และ `AUTH_TRUST_HOST=true` แล้ว |
| ไฟสถานะฐานข้อมูลแดง / `/orderstock/api/health` ได้ `ok:false` | ตรวจ `DATABASE_URL` (ชี้ `db_TCL` บน host ภายนอก), SQL Server รันอยู่, ไฟร์วอลล์พอร์ต 1433 |
| พิมพ์แล้วขนาดเพี้ยน | Scale = 100%, ปิด headers/footers, ใช้ Chrome/Edge |
| บันทึกการตั้งค่าฐานข้อมูลแล้วแอปไม่กลับมา | ตรวจ `restart: unless-stopped` และ bind-mount `.env`; สั่ง `docker compose -f docker-compose.prod.yml up -d` ด้วยมือ |

---

## ภาคผนวก — หมายเหตุทางเทคนิค (สำหรับผู้ดูแลระบบ)

- **subpath ผ่าน caddy-gen:** matcher `/orderstock*` ต้องเป็นแบบ path-through — caddy-gen ส่ง prefix `/orderstock` ต่อให้แอปโดยไม่ตัด เพราะ Next.js `basePath` เป็นเจ้าของ prefix
- **`NEXT_PUBLIC_BASE_PATH`:** ค่านี้ถูกฝังในโค้ดฝั่ง client ตอน **build** (build ARG) จึงต้องตรงกับค่า runtime ใน `environment:` เสมอ หากไม่ตรง `/orderstock/api/health` จะเรียกผิด path
- **ไฟล์ชื่อไม่ตรง DB:** `create-orderstock-schema.sql` รันกับฐานข้อมูล `db_TCL` (ชื่อไฟล์คงเดิมโดยตั้งใจ)
- **ความปลอดภัย:** `AUTH_SECRET` และ `DATABASE_URL` อยู่ในไฟล์ `.env` บนโฮสต์เท่านั้น (gitignored + `.dockerignore` กันไม่ให้เข้า image)
