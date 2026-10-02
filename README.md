# Beat Store — Vercel + Stripe PromptPay (Dynamic QR อัตโนมัติ)

## ขั้นตอน Deploy
1. push โฟลเดอร์นี้ขึ้น GitHub แล้ว Import ใน Vercel
2. Vercel → Storage: เพิ่ม **Neon (Postgres)** และ **Blob** (จะเติม `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN` ให้เอง)
3. Stripe Dashboard → เปิด **PromptPay** ใน Payment methods (ต้องเป็นบัญชี Stripe ไทย)
4. Stripe → Developers → Webhooks → Add endpoint: `https://<โดเมนของคุณ>/api/webhook`
   events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
5. ตั้ง Environment Variables ใน Vercel: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SESSION_SECRET` (`openssl rand -hex 32`)
6. Redeploy — ตารางและแอดมิน 4 บัญชีถูกสร้างอัตโนมัติเมื่อมี request แรก

## แอดมิน
บัญชี `admin1`–`admin4` (รหัสผ่านที่ให้ไว้ในแชท เก็บเป็น scrypt hash ใน `lib/admins.seed.json`)
เข้าระบบโดยกดปุ่ม "แอดมิน" ในหน้าเว็บ

## Flow การชำระเงิน
ลูกค้ากรอกอีเมล → `/api/checkout` คิดยอดจาก DB แล้วสร้าง PromptPay QR (ยอดล็อกตามตะกร้า) →
ลูกค้าสแกนจ่าย → Stripe ยิง webhook → ออเดอร์เป็น `paid` → หน้าเว็บโพลล์เจอแล้วแสดงลิงก์ดาวน์โหลดทันที
