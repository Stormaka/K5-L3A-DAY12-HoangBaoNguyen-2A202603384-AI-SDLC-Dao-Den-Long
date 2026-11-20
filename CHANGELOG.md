# Changelog

## phase-2 — Ticket-02 "Ba hòn đảo" + Test Contract v1.1
- Số liệu chuẩn của ticket thay toàn bộ số tự chọn ở Phase 1; thứ tự xử lý trong một tick theo ticket.
- 3 Đêm với bản đồ chuẩn:
  - Đêm 1: Đảo Bến.
  - Đêm 2: Đảo Cau, gồm 2 đảo, cầu tre và bục nhảy.
  - Đêm 3: Đảo Chuông, gồm 3 tầng, dốc, bục nhảy, tháp chuông và gió.
- Lướt, rơi khỏi đảo, đom đóm rơi có thời hạn, vùng an toàn đẩy Bóng Mực, trạng thái Bóng Mực spawning/wander/chase/recoil/stunned.
- Gió Lạc, Bùa Gió, tạm dừng.
- Client web:
  - Menu → giới thiệu Đêm → kết quả → Bình Minh.
  - Cài đặt được lưu lại.
  - Âm thanh WebAudio.
  - HUD đầy đủ, mũi tên chỉ đèn.
  - Bảng màu chuẩn.
- Headless v1.1: `--night 1..3`, các trường snapshot, scenario, input và sự kiện mới.
- Kiểm chứng:
  - 53 test.
  - 19 kịch bản headless tất định.
  - Bot tìm đường thắng được cả 3 Đêm.
  - Đo FPS bằng Chrome DevTools Protocol.

## phase-1 — PRD-0 + Test Contract v1.0
- Đêm 1 – Đảo Bến: di chuyển, nhảy, camera 3D, đom đóm, nạp đèn, Bóng Mực đuổi, tỏa sáng, thắng/thua, điểm, HUD, chơi lại.
- Chế độ headless tất định + game.contract.json.
- 26 test tự động, 5 kịch bản headless có bằng chứng, hook Stop chặn khi test đỏ, CI.
