import os
import time
import threading
import requests

# ========== CONFIG ==========
WEBHOOK_URL = "https://hooks.slack.com/services/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"

ROW_CONFIG = [3, 3, 4, 4, 4, 4, 4, 4]
GRID_ROWS = len(ROW_CONFIG)

SETUP_SECONDS = 50
DELAY_HOURS = 24
DELAY_SECONDS = DELAY_HOURS * 3600

SYMBOL_EMPTY = "⬛"
SYMBOL_BLINKING = "🟨"
SYMBOL_WAITING = "🟥"
SYMBOL_READY = "🟩"

grid_lock = threading.Lock()
grid = [[SYMBOL_EMPTY for _ in range(cols)] for cols in ROW_CONFIG]
cell_data = {}
active_barcodes = {}
blinking_cell = None
last_assigned = (-1, -1)

def format_hms(seconds):
    seconds = max(0, int(seconds))
    hours, rem = divmod(seconds, 3600)
    minutes, secs = divmod(rem, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"



def send_slack_message(barcode, coord, early=False, duration=None):
    if early:
        time_info = f" (after {format_duration(duration)})" if duration else ""
        text = f"⚠️ Barcode `{barcode}` was picked up **early** from **{coord}**{time_info}!"
    else:
        time_info = f" (ready in {format_duration(DELAY_SECONDS)})"
        text = f"📦 Barcode `{barcode}` is ready to be picked up at **{coord}**{time_info}."

    payload = {
        "text": text,
        "username": "burner notifier",
        "icon_emoji": ":package:"
    }
    try:
        response = requests.post(WEBHOOK_URL, json=payload)
        response.raise_for_status()
    except Exception as e:
        print(f"Error sending Slack message: {e}")


def format_duration(seconds):
    seconds = int(seconds)
    hours, seconds = divmod(seconds, 3600)
    minutes, seconds = divmod(seconds, 60)
    parts = []
    if hours: parts.append(f"{hours} hr")
    if minutes: parts.append(f"{minutes} min")
    if seconds or not parts: parts.append(f"{seconds} sec")
    return " ".join(parts)


def draw_grid():
    os.system("clear" if os.name == "posix" else "cls")
    print("📦 Drone Deployment Grid:\n")

    col_width = 10
    max_cols = max(ROW_CONFIG)

    # Header row
    header = "    " + "".join(f"{i+1:<{col_width}}" for i in range(max_cols))
    print(header)

    # Print each row and collect timers
    timers = []
    now = time.time()

    for i, row in enumerate(grid):
        row_label = chr(ord('A') + i)
        padding_left = (max_cols - len(row)) // 2
        row_cells = [" " * col_width] * padding_left

        for j, cell in enumerate(row):
            display = cell
            info = cell_data.get((i, j), {})

            if 'barcode' in info:
                display += info['barcode'][-3:]

            if 'finish_ts' in info and cell != SYMBOL_EMPTY:
                remaining = info['finish_ts'] - now
                if remaining > 0:
                    timers.append((info['coord'], info['barcode'][-3:], format_hms(remaining)))
                else:
                    timers.append((info['coord'], info['barcode'][-3:], "READY"))

            row_cells.append(f"{display:<{col_width}}")

        print(f"{row_label}   {''.join(row_cells)}")

    # Sidebar legend: timers
    if timers:
        print("\nTimers:")
        for coord, suffix, timer in timers:
            print(f" {coord} [{suffix}] → {timer}")

    # Bottom legend: symbols
    print("\nLegend:")
    print(f"{SYMBOL_EMPTY} Empty   {SYMBOL_WAITING} Unavailable   {SYMBOL_BLINKING} Place Drone   {SYMBOL_READY} Ready for Pickup")



def find_next_available(start_pos):
    flat_positions = [(r, c) for r, cols in enumerate(ROW_CONFIG) for c in range(cols)]
    start_index = 0
    if start_pos != (-1, -1):
        try: start_index = flat_positions.index(start_pos) + 1
        except ValueError: pass
    for i in range(len(flat_positions)):
        idx = (start_index + i) % len(flat_positions)
        r, c = flat_positions[idx]
        with grid_lock:
            if grid[r][c] == SYMBOL_EMPTY:
                return (r, c)
    return None


def schedule_ready(row, col):
    def to_waiting():
        with grid_lock:
            if grid[row][col] == SYMBOL_BLINKING:
                grid[row][col] = SYMBOL_WAITING
                # Start the countdown now
                cell_data[(row, col)]['waiting_start'] = time.time()
                cell_data[(row, col)]['finish_ts'] = time.time() + DELAY_SECONDS
                draw_grid()
        threading.Timer(DELAY_SECONDS, to_ready).start()

    def to_ready():
        with grid_lock:
            if grid[row][col] == SYMBOL_WAITING:
                grid[row][col] = SYMBOL_READY
                barcode = cell_data.get((row, col), {}).get('barcode', 'UNKNOWN')
                coord = cell_data.get((row, col), {}).get('coord', f"{chr(ord('A') + row)}{col + 1}")
                draw_grid()
                send_slack_message(barcode, coord)

    threading.Timer(SETUP_SECONDS, to_waiting).start()



def clear_cell(row, col):
    with grid_lock:
        barcode = cell_data.get((row, col), {}).get('barcode')
        if barcode and barcode in active_barcodes:
            active_barcodes.pop(barcode)
        grid[row][col] = SYMBOL_EMPTY
        cell_data.pop((row, col), None)
    draw_grid()


def update_grid_for_scan(barcode):
    global blinking_cell, last_assigned

    # ======= SCAN-OUT ========
    if barcode in active_barcodes:
        row, col = active_barcodes[barcode]
        with grid_lock:
            state = grid[row][col]
            coord = cell_data.get((row, col), {}).get('coord', f"{chr(ord('A') + row)}{col + 1}")
            waiting_start = cell_data.get((row, col), {}).get('waiting_start')
            elapsed = time.time() - waiting_start if waiting_start else 0
            early_pickup = elapsed < DELAY_SECONDS

            if state in [SYMBOL_WAITING, SYMBOL_READY]:
                if early_pickup:
                    send_slack_message(barcode, coord, early=True, duration=elapsed)
                else:
                    pickup_payload = {
                        "text": f"✅ Barcode `{barcode}` has been successfully picked up from **{coord}**.",
                        "username": "burner notifier",
                        "icon_emoji": ":package:"
                    }
                    try:
                        response = requests.post(WEBHOOK_URL, json=pickup_payload)
                        response.raise_for_status()
                    except Exception as e:
                        print(f"Error sending Slack pickup message: {e}")

                grid[row][col] = SYMBOL_EMPTY
                cell_data.pop((row, col), None)
                active_barcodes.pop(barcode, None)
                draw_grid()
                print(f"✅ Barcode `{barcode}` picked up from {coord} and cleared.")
                return True
            else:
                print(f"⚠️ Barcode `{barcode}` is not ready for pickup yet.")
                return False

    # ======= NEW SCAN-IN ========
    pos = find_next_available(last_assigned)
    if pos is None:
        return False

    row, col = pos

    with grid_lock:
        grid[row][col] = SYMBOL_BLINKING
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        coord = f"{chr(ord('A') + row)}{col + 1}"
        cell_data[(row, col)] = {
            'barcode': barcode,
            'timestamp': timestamp,
            'coord': coord
        }
        active_barcodes[barcode] = (row, col)

    draw_grid()
    blinking_cell = (row, col)
    last_assigned = (row, col)
    print(f"🟨 Please place the drone at **{coord}**")

    # ✅ Start independent timer for this drone
    schedule_ready(row, col)
    return True




# Start a background thread to refresh the grid every second
def refresher():
    while True:
        time.sleep(10)
        with grid_lock:
            draw_grid()

threading.Thread(target=refresher, daemon=True).start()


def main():
    draw_grid()
    print("🔄 Ready to scan barcodes (11 characters only). Ctrl+C to quit.\n")
    try:
        while True:
            if find_next_available(last_assigned) is None:
                draw_grid()
                print("⛔ Grid full. Please wait for space before scanning.")
                time.sleep(5)
                continue

            barcode = input("Scan barcode: ").strip().upper()
            if len(barcode) != 11:
                print("❌ Invalid barcode. Must be exactly 11 characters.")
                continue
            if not barcode.isalnum():
                print("❌ Invalid barcode. Only letters and numbers are allowed.")
                continue

            success = update_grid_for_scan(barcode)
            if not success:
                print("🚫 No space available or barcode invalid. Please wait.")
                time.sleep(2)

    except KeyboardInterrupt:
        print("\n👋 Exiting.")


if __name__ == "__main__":
    main()
