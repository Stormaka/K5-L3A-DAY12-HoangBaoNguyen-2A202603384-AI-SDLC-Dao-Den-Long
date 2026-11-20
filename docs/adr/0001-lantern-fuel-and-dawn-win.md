# ADR 0001 — Đèn có nhiên liệu và luật thắng "giữ sáng tới bình minh"

- **Trạng thái:** Đã chấp nhận (Phase 3, Ticket-03 "Đèn cạn dầu", Test Contract v1.2)
- **Ngày:** 2026-11-20
- **Thay thế:** luật Phase 1–2 "đèn đã sáng thì sáng mãi", "Bóng Mực không bao giờ vào vùng an toàn", "thắng ngay khi thắp hết đèn"

## Bối cảnh

Playtest cho thấy người chơi giỏi thắp hết đèn trong khoảng 2 phút là thắng, nên cuối Đêm không còn gì căng thẳng. Ticket-03 đổi mục tiêu thành **giữ đủ đèn sáng tới bình minh**: đèn cạn dầu rồi tắt, Bóng Mực hút dầu của đèn yếu.

Trước Phase 3, mỗi đèn chỉ có hai trạng thái, đi một chiều:

```
chưa sáng (deposited < 10) --nạp đủ--> đã sáng (mãi mãi, luôn có vùng an toàn 6 m)
```

Luật thắng lúc đó được xét ở mọi tick: hết lửa thì thua, mọi đèn sáng thì thắng ngay, hết giờ thì thua.

## Quyết định

### 1. Mô hình trạng thái đèn

Mỗi đèn có thêm các trường:
- `fuel`: số nguyên, **đơn vị 1/60** (100 dầu = 6000 đơn vị).
- `everLit`: đã từng sáng chưa.
- `relit`: số lần thắp lại.

Vùng an toàn **không** phải trạng thái lưu trữ. Nó được suy ra mỗi lần dùng bằng hàm `hasZone(l) = lit && fuel ≥ 30`.

```
            nạp đủ 10 (lần đầu, +100)                     châm dầu (+5/đom đóm)
 CHƯA SÁNG ───────────────────────────► SÁNG, fuel = 100 ◄──────────────┐
 everLit=false                           │  hao 1/s, bị hút 5/s/bóng     │
     ▲                                   │  fuel ≥ 30: có vùng an toàn   │
     │                                   │  fuel < 30: YẾU, mất vùng,    │
     │                                   │             hút Bóng Mực ─────┘
     │                                   ▼ fuel ≤ 0 (lantern_out)
     │                              ĐÃ TẮT, everLit=true, deposited=0
     │                                   │
     └── (không quay lại được)           └── nạp đủ 5 (thắp lại, +40, relit_count+1) ──► SÁNG, fuel = 100
```

- **Một hàm chọn đèn khi tương tác** cho cả ba hành động. Đèn "nhận được" là đèn chưa sáng, hoặc đèn sáng mà `used > 0`. Chọn đèn gần nhất, bằng nhau thì id nhỏ hơn. Đèn chưa sáng thì nạp vào (chi phí `lightCost = everLit ? 5 : 10`); đèn đang sáng thì châm dầu.
- **Thắp lần đầu và thắp lại đi chung một nhánh code.** Chỉ khác chi phí, điểm, cờ `relight` trong sự kiện và `relit_count`. Cả hai đều đặt `fuel = 100`, tăng `successful_lights` (sức chứa) và đẩy Bóng Mực ra mép vùng an toàn trong ≤ 30 tick.
- **Châm dầu lên ≥ 30** dùng lại đúng cơ chế đẩy Bóng Mực của lúc thắp (cờ `justLit`). Không viết cơ chế thứ hai.

### 2. Vì sao dầu là số nguyên đơn vị 1/60

Hao 1/60 mỗi tick bằng số thực sẽ trôi sai số (6000 lần trừ 0.0166…). Khi đó "tắt đúng ở tick 6000" và "đúng 30 vẫn còn vùng an toàn" sẽ sai lệch tùy máy. Với số nguyên:
- Hao = 1 đơn vị mỗi tick, bị hút = 5 đơn vị mỗi tick mỗi bóng, 1 đom đóm = 600 đơn vị.
- `ceil((6000 − fuel) / 600)` là phép chia số nguyên, chính xác tuyệt đối.
- Chỉ đổi sang số thực 1 chữ số thập phân khi xuất snapshot hoặc sự kiện. Thưởng bình minh dùng `floor(fuel / 60)`.

Phương án đã loại: dùng số thực rồi làm tròn mỗi tick. Cách này phức tạp hơn và vẫn có biên mơ hồ ở đúng 30.0.

### 3. Thứ tự trong một tick (bổ sung vào thứ tự của Ticket-02)

```
1 input/pause → 2 bộ đếm + TRỪ DẦU (hao + hút) → 2b ĐÈN fuel ≤ 0 TẮT (lantern_out)
→ 3 di chuyển → 4 nhặt (tới sức chứa) → 5 tương tác (thắp / thắp lại / châm dầu)
→ 6 vùng an toàn (đẩy bóng ra) → 7 Tỏa Sáng → 8 Bóng Mực (wander → đèn yếu → drain)
→ 9 va chạm → 10 sinh → 11 THẮNG/THUA
```

Bóng Mực chuyển sang `drain` ở bước 8, nên bắt đầu hút từ bước 2 của tick sau. Vì vậy dầu không bao giờ bị trừ hai lần trong cùng một tick chuyển trạng thái.

### 4. Luật thắng mới

Bước 11 chạy sau mọi cập nhật của tick, kể cả tick bình minh:

1. Hết Ngọn Lửa → thua `no_flames`. Luôn xét trước, kể cả ở tick cuối.
2. Chưa tới bình minh → tiếp tục. **Không còn thắng sớm**; mã `all_lit` bị xóa.
3. Tới bình minh: số đèn **đang sáng** ≥ `ceil(0.6 × tổng)` → thắng `dawn_survived`, cộng 50 + floor(dầu) mỗi đèn sáng và 50 mỗi Ngọn Lửa. Ngược lại → thua `dawn`, không có thưởng.

Ngưỡng tính từ `win_ratio` trong tuning (`winNeed()`), không gán cứng 3/4/5, để test C-01 và số trong contract luôn khớp.

### 5. Hành vi Bóng Mực

Thêm trạng thái `drain`. Bóng Mực ở `wander` nhắm tới **đèn yếu gần nhất**; nếu không có thì tới **đèn tắt gần nhất** và dừng cách đèn 1 m (giả định A3-04). Khi hết choáng, Bóng Mực về `wander` (trước đây về `chase` nếu Mây ở gần).

## Hệ quả

- **Breaking:** điểm, thời lượng Đêm, lý do kết thúc, các trường snapshot. Danh sách đầy đủ ở [CHANGELOG.md](../../CHANGELOG.md).
- **Test:** 7 test cũ bị luật mới làm sai. Tất cả được sửa và ghi `T3:` kèm lý do ([docs/notes/phase-3.md](../notes/phase-3.md) §4); không test nào bị skip.
- **Cân bằng:** Bóng Mực giờ đứng canh ở các đèn tắt, nên đi thắp lại đèn nguy hiểm hơn. Bot tìm đường thắng Đêm 1 3/3 seed, Đêm 2 3/7, Đêm 3 2/7. Đây là số liệu đầu vào cho việc cân bằng ở phase sau.
- **Hành vi mới (đúng theo luật):** Mây đứng yên giữa đảo không còn bị Bóng Mực tìm thấy, vì chúng tụ ở các đèn cách 25 m, ngoài tầm phát hiện 12 m. Kịch bản P1-idle-lose vì thế đổi từ thua `no_flames` sang thua `dawn`.
