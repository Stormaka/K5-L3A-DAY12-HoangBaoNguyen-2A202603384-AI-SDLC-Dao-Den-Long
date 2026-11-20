# Bằng chứng Phase 1

Chạy lại tất cả: `npm install && npm test && npm run proof` (ở tag `phase-1`).

- Báo cáo test: [test-report.txt](test-report.txt) (26/26 pass)
- Kịch bản headless qua CLI thật, mỗi kịch bản chạy 2 lần để kiểm tra tất định: [headless-evidence.md](headless-evidence.md), output nằm trong [runs/](runs/)
- Ảnh: [img/](img/)

## Truy vết yêu cầu → bằng chứng

| Yêu cầu (PRD-0 / Contract) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Đảo tròn, 5 Đèn Lồng Lớn, người chơi xuất phát ở (0,0,0) | Snapshot tick 0 | AC-01 | Đạt |
| Đi lại theo hướng camera, vector chuẩn hóa | Đo vị trí sau 60 tick | AC-02, AC-03 | Đạt |
| Không rơi khỏi đảo (`fall_enabled` = false) | Chạy thẳng 10 s | AC-04 | Đạt |
| Nhảy | Có y > 0 rồi đáp xuống | AC-05 | Đạt |
| Nhặt đom đóm trong `pickup_radius` (tính cả biên), tối đa `carry_capacity` | Tick nhặt tính trước = 35 | AC-06, AC-07 | Đạt |
| Nạp ánh sáng để thắp đèn, interact theo cạnh lên, nạp từng phần, có giới hạn tầm | Sự kiện deposit/lantern_lit | AC-08, AC-09, AC-10, P1-lantern | Đạt |
| Thắng khi thắp hết đèn, có điểm thưởng, dừng chạy | game_over won/all_lit | AC-11, P1-win | Đạt |
| Bóng Mực đuổi với `shade_speed` | Vị trí sau 1 s | AC-12 | Đạt |
| Chạm → mất lửa, rơi đom đóm, bất tử `invuln_s`; hết lửa → thua | Tick bị đánh 18/108/198 | AC-13, P1-idle-lose | Đạt |
| Tỏa sáng: tốn ánh sáng, choáng và đẩy trong bán kính, có hồi chiêu | Sự kiện pulse, vị trí, trạng thái | AC-14, AC-15 | Đạt |
| Bóng Mực sợ đèn (`safe_radius`) | Mọi snapshot trong 15 s | AC-16 | Đạt |
| Hết đêm → thua (`dawn`) | game_over ở tick 60 / 300 | AC-17, P1-dawn | Đạt |
| Bóng Mực xuất hiện thêm (`shade_spawned`), id duy nhất | Tick 1800 / 3600 | AC-18 | Đạt |
| Dựng scenario không phát sự kiện, không cộng điểm | Không có event ở tick 0 | AC-19 | Đạt |
| `game.contract.json` đủ trường, `tuning` khớp game | So với `config.js` | C-01 | Đạt |
| CLI: JSONL, snapshot mỗi N tick từ tick 0, dòng `end` ở cuối | Chạy CLI thật | C-02 | Đạt |
| Tọa độ làm tròn 3 chữ số | Quét mọi tọa độ | C-03 | Đạt |
| Tất định (cùng seed → output giống từng byte) | Chạy 2 lần, so file | C-04 + cột "Deterministic" trong headless-evidence.md | Đạt |
| File inputs/scenario sai định dạng → mã thoát 2 kèm stderr | 7 loại lỗi | C-05 | Đạt |
| Tham số sai → mã thoát khác 0; không có inputs → đứng yên | | C-06, C-07 | Đạt |
| Chơi được Đêm 1 từ đầu tới thắng | Bot chơi trên sim thật, ghi lại inputs, chạy lại bằng headless | P1-win (thắng ở tick 2632) | Đạt |
| Camera 3D, HUD (lửa, đom đóm, đèn, thời gian, điểm, tỏa sáng) | Ảnh Chrome headless | [img/start.png](img/start.png) | Đạt (ảnh tĩnh) |
| Đảo sáng dần khi thắp đèn; vàng cam là tốt, tím đen là nguy hiểm | Ảnh với 0 / 3 / 4 đèn đã thắp | [img/start.png](img/start.png), [img/lit3.png](img/lit3.png), [img/lit5-almost.png](img/lit5-almost.png) | Đạt (ảnh tĩnh) |
| Mây đội nón lá có treo đèn lồng nhỏ | Ảnh | [img/start.png](img/start.png) | Đạt |
| Màn hình bắt đầu, màn hình thắng/thua, chơi lại | Ảnh màn hình bắt đầu; logic `newGame()` | [img/title.png](img/title.png) | **Chưa kiểm chứng bằng chơi tay**: cần người chơi thử |
| Cảm giác điều khiển khi chơi thật | Chơi tay | — | **Chưa kiểm chứng**: agent không điều khiển được bàn phím |
