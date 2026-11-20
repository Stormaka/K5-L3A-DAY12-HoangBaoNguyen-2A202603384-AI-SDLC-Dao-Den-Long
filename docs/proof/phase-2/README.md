# Bằng chứng Phase 2 — Ticket-02 "Ba hòn đảo" (Contract v1.1)

Chạy lại tất cả (ở tag `phase-2`): `npm install && npm test && npm run proof`. Đo FPS: `PORT=5199 npm start` rồi `npm run fps`.

- Báo cáo test: [test-report.txt](test-report.txt) (53/53 đạt: 19 test Phase 1 chạy lại với số chuẩn, 25 test Phase 2, 9 test contract)
- Kịch bản headless qua CLI thật, mỗi kịch bản chạy 2 lần để kiểm tra tất định, có đo thời gian: [headless-evidence.md](headless-evidence.md) (19/19 PASS), output trong [runs/](runs/)
- Giả định và tiêu chí nghiệm thu: [docs/notes/phase-2.md](../../notes/phase-2.md)
- Ảnh (Chrome headless, 1280×720): [img/](img/)

## Truy vết yêu cầu → bằng chứng

| Yêu cầu (Ticket-02) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| **P1** Số liệu chuẩn thay số tự chọn; `tuning` khớp | So `game.contract.json` với bảng của ticket | C-01 | Đạt |
| **P1** Thứ tự xử lý trong tick | Test theo từng bước: nhặt trước nạp, nạp trước vùng an toàn, Gió Lạc cướp trước Bóng Mực, spawn tương tác từ tick sau | P2-08, P2-12, P2-20, AC-08 | Đạt |
| **P1** Di chuyển 6 m/s, nhảy 7 m/s / −20, chỉ nhảy khi chạm đất | Vị trí sau N tick | AC-02, AC-03, AC-05, P2-03 | Đạt |
| **P1** Lướt 14 m/s / 0.2 s / hồi 1.5 s, theo hướng di chuyển hoặc hướng mặt, giữ độ cao trên không | Vị trí, sự kiện `dash` | P2-04, P2-05, headless P2-dash | Đạt |
| **P1** Đom đóm: sức chứa 10, nhặt XZ ≤ 1 và chênh cao ≤ 1.5, 20 lúc đầu, +1 mỗi 240 tick, trần 30, bỏ lượt khi hết điểm | Đếm `motes_active` theo tick | AC-06, AC-07, P2-01, P2-02, P2-06 | Đạt |
| **P1** Đèn: 10 đom đóm, nạp nhiều lần, r 2 m, gần nhất / id nhỏ | Sự kiện `deposit` | AC-08 … AC-10, P2-07, headless P1-lantern | Đạt |
| **P1** Vùng an toàn 6 m; đẩy bóng ra mép ≤ 30 tick, không sát thương | Vị trí theo tick | AC-16, P2-08, headless P2-safezone | Đạt |
| **P1** Tỏa Sáng 3 / 5 m (3D, chân + 0.8) / 3 s; choáng 120; đẩy 4 m trong 15 tick; vật cản; +X; làm mới; +5 | Vị trí, trạng thái, điểm | AC-14, AC-15, P2-09, P2-10, headless P2-pulse | Đạt |
| **P1** Bóng Mực 4 (Đêm 3: 4.5) m/s, phát hiện 12 / bỏ 18, lịch sinh, tối đa, ≥ 15 m, id S1… | Sự kiện `shade_spawned`, vị trí | AC-12, AC-18, P2-11, headless P2-idle-n2 | Đạt |
| **P1** Bị đánh: −1 lửa, rơi floor(n/2) ra vành 1.5–2.5 m (TTL 480), bất tử 90, bóng lùi 2 m/60 tick | Sự kiện `player_hit`, mảng `motes` | AC-13, P2-12, P2-13 | Đạt |
| **P1** Rơi khỏi đảo (Y < −10), bỏ qua bất tử, chờ 60 tick, hồi sinh | Sự kiện `player_hit {by:"fall", lost}` | AC-04, P2-14, headless P2-fall | Đạt |
| **P1** Thắng/thua: no_flames > all_lit (kể cả tick hết giờ) > dawn | `game_over` | AC-11, AC-17, P2-15, headless P1-dawn | Đạt |
| **P1** Điểm chuẩn hóa (+10 nạp, +100 đèn, +5 trúng, thưởng thắng) | `score` | AC-06, AC-08, AC-11, P2-09, P2-15 | Đạt |
| **P2** Đêm 1 chuẩn hóa: đèn, điểm sinh, mép biển | Snapshot tick 0 | AC-01, P2-01 | Đạt |
| **P2** Đêm 2: 2 đảo, cầu tre, bục nhảy, đèn L1…L6, sinh mỗi 7 s, tối đa 8 | Snapshot, vị trí sau khi bay | P2-01, P2-17, headless P2-pad-n2, P2-idle-n2 | Đạt |
| **P2** Đêm 3: 3 tầng, vách, 2 dốc, bục lên tầng 2, tháp, đèn L1…L7, gió | Vị trí khi đi vào vách/dốc/tháp | P2-01, P2-18, P2-19, headless P2-terrain-n3, P2-wind-n3 | Đạt |
| **P2** Mỗi Đêm thắng được | Bot tìm đường chơi trên sim thật, ghi inputs, chạy lại qua headless | headless P1-win-n1 (tick 10024), P2-win-n2 (tick 18770), P2-win-n3 (tick 20842) | Đạt |
| **P3** Gió Lạc: idle/chase/flee/removed, cướp 3, bị Tỏa Sáng, thả lại, sinh @1200, tối đa 2 | Sự kiện `drifter_steal` / `drifter_drop`, mảng `drifters` | P2-20, P2-21, P2-22, headless P2-drifter-steal, P2-drifter-pulse | Đạt |
| **P3** Bùa Gió: 7.2 m/s + lướt không hồi chiêu trong 600 tick, hồi lại sau 2700 | Sự kiện `charm_picked`, vị trí | P2-23, P2-24, headless P2-charm | Đạt |
| **P3** Chuỗi 3 Đêm: menu → giới thiệu (Ông Đăng) → chơi → kết quả → Đêm kế; Bình Minh với tổng điểm; thua thì chơi lại | Ảnh từng màn hình | [menu](img/menu.png), [intro-n2](img/intro-n2.png), [result](img/result.png), [dawn](img/dawn.png) | Đạt (ảnh). **Chưa kiểm chứng bằng chơi tay** qua đủ 3 Đêm |
| **P3** Tạm dừng: logic dừng; Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu | Headless `paused` (tick tăng, sim_tick đứng); ảnh menu | P2-16, headless P2-pause, [pause](img/pause.png) | Đạt |
| **P3** Cài đặt âm lượng, độ nhạy chuột, lưu giữa các lần mở | Ảnh; code `localStorage` (`ddl-settings`) | [settings](img/settings.png) | Đạt (ảnh). **Việc lưu chưa kiểm chứng tự động** |
| **P3** Âm thanh: nhạc nền + 10 loại hiệu ứng | WebAudio tổng hợp, gắn theo sự kiện sim (`web/audio.js`) | — | **Chưa kiểm chứng**: agent không nghe được, cần người chơi thử |
| **P3** HUD đủ vị trí; đồng hồ đỏ nhấp nháy ≤ 30 s; nhắc "E — Nạp ánh sáng (x/10)"; mũi tên tới đèn ngoài màn hình | Ảnh | [n1-play](img/n1-play.png), [n1-prompt](img/n1-prompt.png), [n2-play](img/n2-play.png), [n3-play](img/n3-play.png) | Đạt (ảnh tĩnh) |
| **P3** Bảng màu chuẩn; ambient = 0.15 + 0.55 × tiến độ | Mã hex trong `web/main.js` (`C`), công thức trong `sync()`; ảnh 0 → 7 đèn | [n1-play](img/n1-play.png), [n3-tier2](img/n3-tier2.png), [n3-wind](img/n3-wind.png) | Đạt |
| **P4** Contract v1.1: `--night 1..3`, trường snapshot mới, scenario/input/sự kiện mới, tên trạng thái Bóng Mực | Chạy CLI thật cả 3 Đêm, kiểm từng trường | C-02 … C-08 | Đạt |
| **P4** Một Đêm đầy đủ ≤ 30 s | Đo thời gian CLI 21.600 tick × 3 Đêm | C-09; cột "Time" trong headless-evidence.md (116–464 ms) | Đạt |
| **DoD** Test ẩn Phase 1 vẫn đạt với số chuẩn | 19 test AC Phase 1 viết lại với số chuẩn (thay đổi ghi trong notes §4) | AC-01 … AC-19 | Đạt (với test của bài; test ẩn chưa biết) |
| **DoD** ≥ 30 FPS trung bình ở 1280×720 | `scripts/fps.js`: Chrome + DevTools Protocol, 10 s, camera di chuyển, tất cả đèn sáng | Xem bảng FPS bên dưới | Đạt trên GPU thật |
| **DoD** AGENTS.md và skill cập nhật | git log | [AGENTS.md](../../../AGENTS.md), [verify-game](../../../.claude/skills/verify-game/SKILL.md) | Đạt |

## FPS (1280×720, Chrome 1280×720, trung bình 10 s, camera chạy vòng)

Máy dev: Intel i7-13620H, NVIDIA GeForce RTX 5050 Laptop GPU, Windows 11.

| Cảnh | GPU thật (ANGLE D3D11) | SwiftShader (CPU, không GPU) |
|---|---|---|
| Đêm 1, 5/5 đèn sáng | TB **132.5** FPS, thấp nhất 46.1 | — |
| Đêm 2, 6/6 đèn sáng | TB **149.2** FPS, thấp nhất 36.2 | — |
| Đêm 3, 7/7 đèn sáng, gió (cảnh nặng nhất) | TB **130.6** FPS, thấp nhất 39.5 | TB 5.3 FPS |

SwiftShader dựng hình hoàn toàn bằng CPU, không đại diện cho máy chơi thật. Con số được ghi lại cho minh bạch.

## Việc còn phải làm tay (người chơi)

- Chơi qua menu → Đêm 1 → 2 → 3 → Bình Minh bằng bàn phím/chuột; ghi cảm giác điều khiển.
- Nghe nhạc nền và hiệu ứng, đổi âm lượng, tải lại trang xem cài đặt còn giữ.
