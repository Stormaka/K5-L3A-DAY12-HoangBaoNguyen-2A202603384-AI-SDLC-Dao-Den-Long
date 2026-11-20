# Đảo Đèn Lồng

> Video demo: _(sẽ thêm ở Phase 4)_

Game 3D góc nhìn thứ ba (Three.js, chạy trên trình duyệt). Mây, người giữ đèn nhỏ tuổi đội nón lá quàng khăn đỏ, gom đom đóm để thắp lại Đèn Lồng Lớn trên **ba hòn đảo trong ba đêm** trước bình minh, vừa né Bóng Mực vừa giữ giỏ đom đóm khỏi Gió Lạc. Có chế độ **headless tất định** theo **Test Contract v1.1** ([game.contract.json](game.contract.json)).

## Cài đặt và chạy (macOS / Linux / Windows, cần Node ≥ 18)

```bash
npm install
npm start          # mở http://localhost:5173
```

Chạy test và bằng chứng: `npm test` · `npm run proof`

## Ba đêm

| Đêm | Đảo | Đèn | Thời gian | Điểm đặc biệt |
|---|---|---|---|---|
| 1 | Đảo Bến: đảo tròn 40 m | 5 | 5:00 | Bóng Mực mỗi 8 s, tối đa 6 |
| 2 | Đảo Cau: 2 đảo nối bằng cầu tre | 6 | 5:30 | Bục nhảy bắn sang đảo kia, Gió Lạc, Bùa Gió trên cầu |
| 3 | Đảo Chuông: 3 tầng, tháp chuông | 7 | 6:00 | Dốc lên tầng 1, bục nhảy lên tầng 2, gió mạnh mỗi 30 s, Bóng Mực nhanh hơn (4.5 m/s) |

Menu → giới thiệu Đêm (lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. Thắng Đêm 3 thì tới màn **Bình Minh** với tổng điểm. Thua thì chơi lại Đêm đó.

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` / mũi tên | Di chuyển (theo hướng camera) |
| Kéo chuột trái, `Q` / `C` | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| `Space` | Nhảy |
| `Shift` | Lướt: 14 m/s trong 0.2 s, hồi 1.5 s |
| `E` | Nạp đom đóm vào đèn gần nhất (trong 2 m) |
| `F` | Tỏa Sáng: tốn 3 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 5 m, hồi 3 s |
| `Esc` / `P` | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |

## Luật chơi và cách tính điểm

- Đom đóm tự nhặt khi tới gần (≤ 1 m), mang tối đa 10. Mỗi đèn cần **10** đom đóm, nạp được nhiều lần.
- Có **3 Ngọn Lửa**, hồi đầy mỗi Đêm. Bóng Mực chạm → mất 1 lửa, rơi một nửa số đom đóm ra xung quanh (nhặt lại được trong 8 s), bất tử 1.5 s.
- Rơi khỏi đảo → mất 1 lửa và toàn bộ đom đóm, hồi sinh ở điểm xuất phát sau 1 s.
- Bóng Mực không vào được vòng **6 m quanh đèn đã thắp**.
- **Gió Lạc** (Đêm 2–3) đuổi khi bạn mang ≥ 5 đom đóm và cướp 3 con. Tỏa Sáng trúng nó lúc đang chạy trốn thì nó đánh rơi lại đồ đã cướp.
- **Bùa Gió** (lá bùa đỏ): 10 s chạy nhanh 7.2 m/s và lướt không cần hồi chiêu.
- **Thắng**: thắp hết đèn. **Thua**: hết lửa, hoặc hết giờ.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng | +5 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game là tổng điểm các Đêm đã thắng.

## Chế độ headless (Test Contract v1.1)

```bash
node src/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl \
  [--scenario f.json] [--inputs f.json] [--snapshot-every 10]
```

- **Chạy:** 60 tick/giây cố định, không cần cửa sổ hay GPU. `--night` nhận 1, 2 hoặc 3. Một Đêm đầy đủ (21.600 tick) chạy dưới 1 s.
- **Mã thoát:**
  - `0`: bình thường.
  - `2`: file inputs/scenario sai định dạng hoặc không đọc được.
  - `1`: tham số dòng lệnh sai.
- **Sự kiện:** dòng `night_start` được ghi ở tick 0.

**Ghi chú về `tuning` và các lựa chọn:** mọi số là số chuẩn của Ticket-02. Các điểm ticket chưa nói rõ được ghi thành giả định A2-01 … A2-20 trong [docs/notes/phase-2.md](docs/notes/phase-2.md), đáng chú ý:

- Đêm 3 xuất phát ở (0, 0, −30), vì (0, 0, 0) nằm trong tháp chuông.
- Trạng thái `spawning` của Bóng Mực kéo dài 60 tick.
- Bóng Mực bay theo địa hình nên qua được vách tầng.

## Tài liệu

- Phase 2: giả định, tiêu chí nghiệm thu, nhật ký AI, đánh giá: [docs/notes/phase-2.md](docs/notes/phase-2.md) · bằng chứng: [docs/proof/phase-2/README.md](docs/proof/phase-2/README.md)
- Phase 1: [docs/notes/phase-1.md](docs/notes/phase-1.md) · [docs/proof/phase-1/README.md](docs/proof/phase-1/README.md)
- Harness AI:
  - [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md)
  - [.claude/settings.json](.claude/settings.json) (hooks)
  - skill [.claude/skills/verify-game](.claude/skills/verify-game/SKILL.md)
  - CI [.github/workflows/ci.yml](.github/workflows/ci.yml) (Node 20/22/24) + [pre-push hook](.githooks/pre-push); lịch sử sự cố CI ở [ci-status](docs/notes/ci-status.md)

## Đề bài lab

Tài liệu đề bài gốc của giảng viên (README, GUIDE, CHECKPOINTS, SUBMISSION, RULES, RUBRIC) được giữ trong [docs/lab/](docs/lab/).
