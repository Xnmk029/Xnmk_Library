import os
import sys
import time
import random

if sys.platform == 'win32':
    os.system('')

FRAMES = {
    'cat': [
        [
            r"  /\_/\  ",
            r" ( o.o ) ",
            r"  > ^ <  ",
            r" 喵~~~~~  ",
        ],
        [
            r"  /\_/\  ",
            r" ( -.- ) ",
            r"  > ^ <  ",
            r" 喵~~~~~  ",
        ],
        [
            r"  /\_/\  ",
            r" ( O.O ) ",
            r"  > ^ <  ",
            r" 喵~~~~~  ",
        ],
    ],
    'bird': [
        [
            r"   __   ",
            r"<(o )__ ",
            r" (  ._>/",
            r"  `---' ",
        ],
        [
            r"   __   ",
            r"<(o )__ ",
            r" (  ._>/",
            r"  `---' ",
        ],
        [
            r"   __   ",
            r"<(o )__ ",
            r" (  ._>/",
            r"  `---' ",
        ],
    ],
    'bird_fly': [
        [
            r"    \   ",
            r" \__(o)>",
            r" (_  ._ ",
            r"   ``   ",
        ],
        [
            r"     \  ",
            r"  \__(o)>",
            r"  (_  ._ ",
            r"    ``   ",
        ],
        [
            r"      \ ",
            r"   \__(o)>",
            r"   (_  ._ ",
            r"     ``   ",
        ],
        [
            r"      \ ",
            r"   \__(o)>",
            r"   (_  ._ ",
            r"     ``   ",
        ],
    ],
    'fish': [
        [
            r"    /\"_     ",
            r"   / .  \   ",
            r"  /_    \"-o",
            r"  \    /    ",
            r"   \  /     ",
            r"    \/      ",
        ],
        [
            r"    /\"_     ",
            r"   / .  \   ",
            r"  /_    \"-o",
            r"  \    /    ",
            r"   \  /     ",
            r"    \/      ",
        ],
    ],
    'dolphin': [
        [
            r"      __",
            r"  _  / /",
            r" ( \/ //",
            r"  \__/",
        ],
        [
            r"       __",
            r"   _  / /",
            r"  ( \/ //",
            r"   \__/",
        ],
        [
            r"        __",
            r"    _  / /",
            r"   ( \/ //",
            r"    \__/",
        ],
    ],
    'rabbit': [
        [
            r"  (\_/)  ",
            r"  (o.o)  ",
            r"  (> <)  ",
            r" 蹦蹦跳跳~ ",
        ],
        [
            r"  (\_/)  ",
            r"  (x.x)  ",
            r"  (> <)  ",
            r" 蹦蹦跳跳~ ",
        ],
        [
            r"  (\_/)  ",
            r"  (^.^)  ",
            r"  (> <)  ",
            r" 蹦蹦跳跳~ ",
        ],
    ],
}

BUBBLES = ['o', 'O', '°', '*', '.']
WAVES = ['~', '≈', '∿', '∼']


def clear_screen():
    sys.stdout.write('\033[2J\033[H')
    sys.stdout.flush()


def hide_cursor():
    sys.stdout.write('\033[?25l')
    sys.stdout.flush()


def show_cursor():
    sys.stdout.write('\033[?25h')
    sys.stdout.flush()


def draw_frame(frame, ox, oy, color=None):
    for i, line in enumerate(frame):
        sys.stdout.write(f'\033[{oy + i};{ox}H')
        if color:
            sys.stdout.write(f'\033[{color}m{line}\033[0m')
        else:
            sys.stdout.write(line)


def draw_bubbles(bubbles):
    for bx, by, frame in bubbles:
        if by > 0:
            sys.stdout.write(f'\033[{by};{bx}H{BUBBLES[frame % len(BUBBLES)]}')


def draw_waves(offset):
    cols, rows = os.get_terminal_size()
    wave_row = rows - 2
    sys.stdout.write(f'\033[{wave_row};0H')
    waveline = ''.join(
        WAVES[(i + offset) % len(WAVES)] for i in range(cols)
    )
    sys.stdout.write(f'\033[36m{waveline}\033[0m')


def cat_animation():
    cols, rows = os.get_terminal_size()
    frame = 0
    x = 0
    y = rows // 2 - 2
    try:
        while x < cols:
            clear_screen()
            cat_frame = FRAMES['cat'][frame]
            actual_x = min(x, cols - len(cat_frame[0]))
            draw_frame(cat_frame, actual_x, y, '33')
            sys.stdout.write(f'\033[{rows};0H\033[90m🐱 小猫咪散步中... (按 Ctrl+C 退出)\033[0m')
            sys.stdout.flush()
            frame = (frame + 1) % len(FRAMES['cat'])
            x += 2
            time.sleep(0.15)
    except KeyboardInterrupt:
        pass


def bird_animation(width):
    cols, rows = os.get_terminal_size()
    frame = 0
    x = -10
    y_base = rows // 3
    try:
        while x < cols + 10:
            clear_screen()
            bird_frame = FRAMES['bird'][frame % len(FRAMES['bird'])]
            y = y_base + int(5 * (1 - abs((x % (width * 2)) - width) / width))
            draw_frame(bird_frame, x, y, '33')
            sys.stdout.write(f'\033[{rows};0H\033[90m🐦 小鸟飞行中... (按 Ctrl+C 退出)\033[0m')
            sys.stdout.flush()
            frame += 1
            x += 2
            time.sleep(0.08)
    except KeyboardInterrupt:
        pass


def fish_tank():
    cols, rows = os.get_terminal_size()
    frame = 0
    fish_x = 2
    fish_y = rows // 2 - 2
    direction = 1
    bubbles = []
    wave_offset = 0
    try:
        while True:
            clear_screen()
            draw_waves(wave_offset)
            wave_offset = (wave_offset + 1) % 4

            fish_frame = FRAMES['fish'][frame % len(FRAMES['fish'])]
            draw_frame(fish_frame, fish_x, fish_y, '36')

            fish_x += direction * 2
            if fish_x > cols - 14 or fish_x < 2:
                direction *= -1

            if random.random() < 0.3:
                bubbles.append([fish_x + random.randint(1, 5), fish_y - 1, 0])

            new_bubbles = []
            for bx, by, bf in bubbles:
                by -= 1
                bf += 1
                if by > 2:
                    new_bubbles.append([bx, by, bf])
            bubbles = new_bubbles
            draw_bubbles(bubbles)

            sys.stdout.write(f'\033[{rows};0H\033[90m🐟 鱼缸 - 小鱼游泳中... (按 Ctrl+C 退出)\033[0m')
            sys.stdout.flush()
            frame += 1
            time.sleep(0.12)
    except KeyboardInterrupt:
        pass


def dolphin_jump():
    cols, rows = os.get_terminal_size()
    frame = 0
    x = -8
    try:
        while x < cols + 8:
            clear_screen()
            cols2, rows2 = os.get_terminal_size()
            wave_row = rows2 - 3
            sys.stdout.write(f'\033[{wave_row};0H')
            wl = ''.join(WAVES[(i + frame) % len(WAVES)] for i in range(cols2))
            sys.stdout.write(f'\033[36m{wl}\033[0m')

            t = (x + 8) / max(cols2 + 16, 1)
            y = wave_row - 3 - int(10 * (1 - 4 * (t - 0.5) ** 2))

            dolphin_frame = FRAMES['dolphin'][frame % len(FRAMES['dolphin'])]
            draw_frame(dolphin_frame, x, max(2, y), '34')

            sys.stdout.write(f'\033[{rows};0H\033[90m🐬 海豚跳跃中... (按 Ctrl+C 退出)\033[0m')
            sys.stdout.flush()
            frame += 1
            x += 3
            time.sleep(0.08)
    except KeyboardInterrupt:
        pass


def rabbit_jump():
    cols, rows = os.get_terminal_size()
    frame = 0
    x = -10
    ground = rows - 4
    try:
        while x < cols + 10:
            clear_screen()
            t = (x % 40) / 40
            y = ground - int(6 * (1 - 4 * (t - 0.5) ** 2)) - 4
            rabbit_frame = FRAMES['rabbit'][frame]
            draw_frame(rabbit_frame, x, max(2, y), '35')
            sys.stdout.write(f'\033[{ground};{x + 7}H')
            sys.stdout.write('\033[32m···\033[0m')

            sys.stdout.write(f'\033[{rows};0H\033[90m🐰 小兔子蹦跳中... (按 Ctrl+C 退出)\033[0m')
            sys.stdout.flush()
            frame = (frame + 1) % len(FRAMES['rabbit'])
            x += 3
            time.sleep(0.1)
    except KeyboardInterrupt:
        pass


def main():
    try:
        clear_screen()
        hide_cursor()

        cols, rows = os.get_terminal_size()

        menu = r"""
╔══════════════════════════════════════╗
║        🎨 ASCII 字符动物动画         ║
╠══════════════════════════════════════╣
║  1. 🐱 小猫咪散步                    ║
║  2. 🐦 小鸟飞行                      ║
║  3. 🐟 鱼缸游泳                      ║
║  4. 🐬 海豚跳跃                      ║
║  5. 🐰 小兔子蹦跳                    ║
║  6. 🎬 全部播放                      ║
║  7. 🚪 退出                          ║
╚══════════════════════════════════════╝
"""
        while True:
            clear_screen()
            sys.stdout.write(f'\033[{rows // 2 - 8};{max(0, cols // 2 - 20)}H')
            sys.stdout.write(menu)
            sys.stdout.write(f'\033[{rows // 2 + 7};{max(0, cols // 2 - 20)}H')
            sys.stdout.write('请选择 (1-7): ')
            sys.stdout.flush()

            try:
                ch = sys.stdin.read(1)
            except (EOFError, KeyboardInterrupt):
                break

            if ch == '1':
                cat_animation()
            elif ch == '2':
                bird_animation(20)
            elif ch == '3':
                fish_tank()
            elif ch == '4':
                dolphin_jump()
            elif ch == '5':
                rabbit_jump()
            elif ch == '6':
                cat_animation()
                bird_animation(20)
                fish_tank()
                dolphin_jump()
                rabbit_jump()
            elif ch == '7' or ch.lower() == 'q':
                break

    finally:
        clear_screen()
        show_cursor()
        print('再见! 👋')


if __name__ == '__main__':
    main()
