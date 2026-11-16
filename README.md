# subimage 🎨

**สร้างและแก้รูปใน Claude Code ด้วย subscription ที่คุณจ่ายอยู่แล้ว ไม่ต้องใช้ API key**

- ใช้ได้ทั้ง **Google AI Pro/Ultra** (ผ่าน Antigravity CLI, Nano Banana) และ **ChatGPT Plus/Pro** (ผ่าน Codex CLI)
- เลือกได้ว่าจะใช้ตัวไหนเป็นหลัก ถ้าโควตาหมด จะสลับไปใช้อีกตัวให้เอง
- รูปบันทึกไว้ในโฟลเดอร์ `generated-images/` ของโปรเจกต์

<img src="docs/floating-market.png" alt="ตลาดน้ำไทยสไตล์สีน้ำ สร้างด้วย subimage" width="640">

## ติดตั้ง

ต้องมีอย่างน้อยหนึ่งบริการ

**Google (AI Pro/Ultra)**

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
mkdir -p ~/agy-home && cd ~/agy-home && agy   # ล็อกอิน Google แล้วออก (Ctrl+C)
```

แนะนำให้ตั้ง **AI Credit Overages = Never** ใน settings ของ Antigravity เพื่อไม่ให้ใช้เครดิตที่ซื้อไว้

**ChatGPT (Plus/Pro)**

```bash
npm i -g @openai/codex
codex login
```

**ติดตั้ง plugin**

```bash
claude plugin marketplace add sombass002/subimage
claude plugin install subimage@subimage
```

เปิด Claude Code ใหม่ เท่านี้ก็ใช้ได้

## วิธีใช้

พิมพ์ธรรมดาได้เลย:

```
สร้างรูปแมวส้มนั่งบนโต๊ะทำงาน สไตล์การ์ตูน
สร้างรูปปกคลิป ตลาดน้ำยามเช้า 9:16 แนวตั้ง
ให้แมวใส่แว่น            ← แก้รูปล่าสุด
```

หรือเรียกตรง ๆ: `/subimage:create <สิ่งที่อยากได้>`

**เปลี่ยนบริการหลัก** บอก Claude ได้เลย เช่น "ใช้ ChatGPT เป็นหลัก" หรือ "ปิด fallback"

## ค่าใช้จ่าย

ใช้โควตาของแพ็กเกจที่คุณสมัครอยู่ ไม่มีค่าใช้จ่ายเพิ่ม
- Google: Claude จะบอกโควตาที่เหลือหลังสร้างรูปทุกครั้ง
- ChatGPT: สร้างรูปหนึ่งครั้งกินโควตาประมาณ 3–5 เท่าของการแชตข้อความ
- สคริปต์ลบ `OPENAI_API_KEY` / `GEMINI_API_KEY` ออกจาก environment ก่อนเรียก CLI ทุกครั้ง จึงไม่มีทางเผลอไปคิดเงินผ่าน API

## ข้อจำกัด

- รองรับ macOS และ Linux (ยังไม่รองรับ Windows)
- ตัวหนังสือในรูปอาจเพี้ยน และไม่รองรับพื้นหลังโปร่งใส
- สคริปต์เรียกแค่ CLI ทางการ (`agy`, `codex`) ไม่อ่านไฟล์ล็อกอินหรือ token ใด ๆ

---

## English

Generate images in Claude Code using your Google AI Pro/Ultra (Antigravity CLI) or ChatGPT Plus/Pro (Codex CLI) subscription. No API key. Choose a primary service; the other is used automatically when the primary is out of quota or not set up. Install with the two `claude plugin` commands above. macOS/Linux only.

## Credits

- Gemini bridge (`scripts/gemini_image.mjs`) from [Amityst12/BananoClaude-Images](https://github.com/Amityst12/BananoClaude-Images) (MIT), based on [inyounglee-datapopcorn/gemini-media-skill](https://github.com/inyounglee-datapopcorn/gemini-media-skill). See `LICENSE.BananoClaude`.
- Codex approach inspired by [mijatovicmilan/image-gen](https://github.com/mijatovicmilan/image-gen) (MIT).

Not affiliated with Google, OpenAI or Anthropic. MIT license.
