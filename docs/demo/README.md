# Video demo và Release v1.0.0

## Video demo (< 5 phút): kịch bản quay

Agent không quay được màn hình hay chơi bằng bàn phím, nên **video do bạn tự quay**. Có thể dùng Xbox Game Bar (`Win + Alt + R`) hoặc OBS, quay ở 1280×720 trở lên. Lưu thành `docs/demo/demo.mp4` (nếu < 50 MB) hoặc đính kèm vào Release v1.0.0.

| Thời điểm | Quay gì | Lệnh |
|---|---|---|
| 0:00–0:20 | Giới thiệu: tên game, mục tiêu "giữ đèn tới bình minh" | — |
| 0:20–2:00 | **Chơi trực tiếp Đêm 1:** gom đom đóm → thắp đèn → thanh dầu → châm dầu → Tỏa Sáng một Bóng Mực đang hút dầu (tia tím) → phụ đề "Bóng Mực xuất hiện" | `npm start` |
| 2:00–2:30 | Tạm dừng → Cài đặt: Đổi phím (thử gán trùng để thấy cảnh báo, rồi Khôi phục mặc định), bật Bảng màu dễ phân biệt, Chữ lớn | — |
| 2:30–2:50 | Thua hoặc thắng → nhập tên → Bảng xếp hạng → tắt và mở lại game, bảng vẫn còn | `node server.js --export-leaderboard out.json` |
| 2:50–3:30 | Test và headless | `npm test` (73/73) · `npm run proof` (28 PASS) |
| 3:30–4:30 | Benchmark (cửa sổ mở 33 s) và soak | `node scripts/bench.js --seed 42 --duration 30 --out bench.json` · `node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json` |
| 4:30–4:50 | Lướt qua README / CHANGELOG / ADR / AGENTS.md | — |

## Tạo GitHub Release v1.0.0

Máy dev không cài `gh`, nên tạo trên web sau khi đã push tag `phase-4` và `v1.0.0`:

1. Chạy `npm run package` để tạo `dist/dao-den-long-v1.0.0.zip` và `dist/dao-den-long-v1.0.0.tar.gz`.
2. Mở GitHub → **Releases** → **Draft a new release** → chọn tag `v1.0.0`, đặt tiêu đề **Đảo Đèn Lồng v1.0.0**.
3. Ghi chú phát hành: chép mục `phase-4` và phần tóm tắt trong [CHANGELOG.md](../../CHANGELOG.md).
4. Kéo thả vào phần tài sản (assets):
   - hai file trong `dist/`;
   - `docs/proof/phase-4/bench.json`;
   - `docs/proof/phase-4/soak.json`;
   - video `demo.mp4`.
5. **Publish release**.

Cách chạy bản Release: giải nén rồi chạy `node server.js` (chỉ cần Node ≥ 18, không cần `npm install`). Xem file `CHAY-GAME.txt` trong gói.
