# Đảo Đèn Lồng

> Video demo: _(sẽ thêm ở Phase 4)_

Game 3D góc nhìn thứ ba (Three.js, chạy trên trình duyệt). Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại 5 Đèn Lồng Lớn của Đảo Bến trước bình minh và né Bóng Mực. Có chế độ **headless tất định** theo **Test Contract v1.0** ([game.contract.json](game.contract.json)).

## Cài đặt và chạy (macOS / Linux / Windows, cần Node ≥ 18)

```bash
npm install
npm start          # mở http://localhost:5173
```

Chạy test và bằng chứng: `npm test` · `npm run proof`

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` / mũi tên lên xuống | Di chuyển (theo hướng camera) |
| Kéo chuột trái, `Q` / `C` | Xoay camera |
| `Space` | Nhảy |
| `E` | Nạp đom đóm đang mang vào đèn gần nhất (trong 3 m) |
| `F` (hoặc Shift trái) | Tỏa sáng: tốn 1 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 6 m |
| `Enter` / `R` | Bắt đầu / chơi lại |

## Luật chơi và cách tính điểm

- Đom đóm tự nhặt khi đi tới gần (≤ 1.5 m), mang tối đa 10. Mỗi đèn cần **5** đom đóm (nạp được từng phần).
- Có **3 ngọn lửa** (máu). Bóng Mực chạm (≤ 1 m) → mất 1 lửa, rơi mất một nửa số đom đóm đang mang, bất tử 1.5 s.
- Bóng Mực không vào được vòng **5 m quanh đèn đã thắp** → đứng cạnh đèn sáng là an toàn.
- **Thắng**: thắp đủ 5 đèn. **Thua**: hết lửa, hoặc hết 300 s (bình minh) mà chưa thắp xong.

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực bị làm choáng | +20 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi ngọn lửa còn lại | +50 |

## Chế độ headless (Test Contract v1.0)

```bash
node src/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl \
  [--scenario f.json] [--inputs f.json] [--snapshot-every 10]
```

60 tick/giây cố định, không cần cửa sổ/GPU. Mã thoát: `0` bình thường, `2` khi file inputs/scenario sai định dạng (hoặc không đọc được), `1` khi tham số dòng lệnh sai. Snapshot có thêm mảng `motes` (khuyến nghị).

**Ghi chú về `tuning`:**
- `fall_enabled: false` — mép đảo là tường vô hình, không rơi được, nên không bao giờ có `player_hit` với `by: "fall"`.
- `safe_radius` chỉ áp dụng quanh đèn **đã thắp**.
- `pulse_cost` tính bằng đom đóm đang mang; không đủ thì nhấn tỏa sáng không có tác dụng.
- `dash` không có trong game (bỏ qua nếu có trong inputs).

## Tài liệu

- Giả định, tiêu chí nghiệm thu, nhật ký AI, đánh giá: [docs/notes/phase-1.md](docs/notes/phase-1.md)
- Bằng chứng: [docs/proof/phase-1/README.md](docs/proof/phase-1/README.md)
- Harness AI: [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), [.claude/settings.json](.claude/settings.json) (hooks), [.claude/skills/verify-game](.claude/skills/verify-game/SKILL.md), CI [.github/workflows/ci.yml](.github/workflows/ci.yml)
