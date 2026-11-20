# Đảo Đèn Lồng

> Video demo: _(sẽ thêm ở Phase 4)_

Game 3D góc nhìn thứ ba (Three.js, chạy trên trình duyệt). Mây, người giữ đèn nhỏ tuổi đội nón lá quàng khăn đỏ, phải **giữ các Đèn Lồng Lớn cháy tới bình minh** trên ba hòn đảo trong ba đêm. Đèn cạn dầu dần, Bóng Mực tìm tới hút dầu, Gió Lạc rình cướp đom đóm. Có chế độ **headless tất định** theo **Test Contract v1.2** ([game.contract.json](game.contract.json)).

## Cài đặt và chạy (macOS / Linux / Windows, cần Node ≥ 18)

```bash
npm install
npm start          # mở http://localhost:5173
```

Chạy test và bằng chứng: `npm test` · `npm run proof`

## Ba đêm

| Đêm | Đảo | Đèn (cần sáng lúc bình minh) | Thời gian | Điểm đặc biệt |
|---|---|---|---|---|
| 1 | Đảo Bến: đảo tròn 40 m | 5 (cần 3) | 4:00 | Bóng Mực mỗi 8 s, tối đa 6 |
| 2 | Đảo Cau: 2 đảo nối bằng cầu tre | 6 (cần 4) | 4:30 | Bục nhảy bắn sang đảo kia, Gió Lạc, Bùa Gió trên cầu |
| 3 | Đảo Chuông: 3 tầng, tháp chuông | 7 (cần 5) | 5:00 | Dốc lên tầng 1, bục nhảy lên tầng 2, gió mạnh mỗi 30 s, Bóng Mực nhanh hơn |

Menu → giới thiệu Đêm (lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. Thắng Đêm 3 thì tới màn **Bình Minh** với tổng điểm. Thua thì chơi lại Đêm đó.

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` / mũi tên | Di chuyển (theo hướng camera) |
| Kéo chuột trái, `Q` / `C` | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| `Space` | Nhảy |
| `Shift` | Lướt: 14 m/s trong 0.2 s, hồi 1.5 s |
| `E` | Đứng cách đèn ≤ 2 m: thắp (10 đom đóm), thắp lại (5), hoặc châm dầu (1 đom đóm = 10 dầu) |
| `F` | Tỏa Sáng: tốn 3 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 5 m, hồi 3 s |
| `Esc` / `P` | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |

Cài đặt gồm âm lượng, độ nhạy chuột và **Bảng màu dễ phân biệt** (chế độ mù màu). Tất cả được lưu lại.

## Luật chơi

- **Dầu đèn:**
  - Đèn vừa thắp có 100 dầu, hao 1 dầu/giây.
  - Đèn hết dầu thì tắt. Đèn đã từng sáng chỉ cần 5 đom đóm để thắp lại.
  - Đèn còn dưới 30 dầu thì nhấp nháy và **mất vùng an toàn 6 m**.
- **Bóng Mực:**
  - Tìm tới đèn yếu và **hút dầu** 5/giây.
  - Lại gần (≤ 6 m) thì chúng bỏ đèn và đuổi theo bạn. Tỏa Sáng trúng con đang hút thì được thêm điểm.
- **Đom đóm:**
  - Tự nhặt khi tới gần (≤ 1 m).
  - Sức chứa ban đầu 10, mỗi lần thắp thành công +2, tối đa 20.
- **Ngọn Lửa:**
  - Có 3 Ngọn Lửa. Bị Bóng Mực chạm thì mất 1 lửa và rơi một nửa số đom đóm đang mang.
  - Rơi khỏi đảo thì mất 1 lửa và toàn bộ đom đóm.
- **Gió Lạc** (Đêm 2–3) cướp 3 đom đóm khi bạn mang ≥ 5. **Bùa Gió** cho 10 s chạy nhanh và lướt không cần hồi chiêu.
- **Thắng:** còn sống lúc bình minh với ít nhất 60% số đèn **đang sáng**. Thắp hết đèn sớm **không** kết thúc Đêm.
- **Thua:** hết Ngọn Lửa, hoặc tới bình minh mà không đủ đèn sáng.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn (thắp, thắp lại, châm dầu) | +5 |
| Thắp lần đầu / thắp lại | +100 / +40 |
| Mỗi Bóng Mực trúng Tỏa Sáng (đang hút dầu) | +5 (+15) |
| Bình minh, khi thắng: mỗi đèn đang sáng | +50 + số dầu còn lại (làm tròn xuống) |
| Bình minh, khi thắng: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game là tổng điểm các Đêm đã thắng.

## Chế độ headless (Test Contract v1.2)

```bash
node src/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl \
  [--scenario f.json] [--inputs f.json] [--snapshot-every 10]
```

- **Chạy:** 60 tick/giây cố định, không cần cửa sổ hay GPU. `--night` nhận 1, 2 hoặc 3. Một Đêm đầy đủ chạy dưới 1 s.
- **Mã thoát:**
  - `0`: bình thường.
  - `2`: file inputs/scenario sai định dạng hoặc không đọc được.
  - `1`: tham số dòng lệnh sai.
- **Sự kiện:** dòng `night_start` được ghi ở tick 0.

**Ghi chú về `tuning`:** mọi số là số chuẩn của Ticket-02/03.

- `score.per_second_left = 0` vì thưởng thời gian đã bị bỏ.
- Điểm thắp lại (40), Tỏa Sáng trúng bóng đang hút (15) và đèn sáng lúc bình minh (50) không có khóa riêng trong contract; chúng nằm trong `WORLD` ở [src/sim/config.js](src/sim/config.js).
- Các chỗ ticket chưa nói rõ được ghi thành giả định trong [phase-2.md](docs/notes/phase-2.md) (A2-xx) và [phase-3.md](docs/notes/phase-3.md) (A3-xx).

## Tài liệu

- Phase 3:
  - Quyết định thiết kế [ADR 0001](docs/adr/0001-lantern-fuel-and-dawn-win.md).
  - Ghi chú: [docs/notes/phase-3.md](docs/notes/phase-3.md).
  - Bằng chứng: [docs/proof/phase-3/README.md](docs/proof/phase-3/README.md).
  - Breaking change: [CHANGELOG.md](CHANGELOG.md).
- Phase 2: [docs/notes/phase-2.md](docs/notes/phase-2.md) · [docs/proof/phase-2/README.md](docs/proof/phase-2/README.md)
- Phase 1: [docs/notes/phase-1.md](docs/notes/phase-1.md) · [docs/proof/phase-1/README.md](docs/proof/phase-1/README.md)
- Harness AI:
  - [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md).
  - [.claude/settings.json](.claude/settings.json) (hooks).
  - Skill [.claude/skills/verify-game](.claude/skills/verify-game/SKILL.md).
  - CI [.github/workflows/ci.yml](.github/workflows/ci.yml) (Node 20/22/24) + [pre-push hook](.githooks/pre-push).

## Đề bài lab

Tài liệu đề bài gốc của giảng viên (README, GUIDE, CHECKPOINTS, SUBMISSION, RULES, RUBRIC) được giữ trong [docs/lab/](docs/lab/).
