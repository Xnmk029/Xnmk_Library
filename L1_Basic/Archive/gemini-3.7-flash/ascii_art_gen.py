#!/usr/bin/env python3
"""
ASCII Text Art & Model ID Logo Generator
Model: Gemini 3.7 Flash Benchmark Implementation
Renders High-Definition ANSI TrueColor / ASCII Artwork with Model ID and Geometric Logo.
"""

import sys
import math
import time


# Density Ramp for Luminance Mapping
ASCII_RAMP = "@%#*+=-:. "
BANNER_GEMINI = [
    r"   ____                      _           _   _____  _  _   _____ _           _     ",
    r"  / ___| ___ _ __ ___  _ __ (_)_ __ ___ (_) |___ / / || | |  ___| | __ _ ___| |__  ",
    r" | |  _ / _ \ '_ ` _ \| '_ \| | '_ ` _ \| |   |_ \ | || |_| |_  | |/ _` / __| '_ \ ",
    r" | |_| |  __/ | | | | | | | | | | | | | | |  ___) ||__   _|  _| | | (_| \__ \ | | |",
    r"  \____|\___|_| |_| |_|_| |_|_|_| |_| |_|_| |____(_)  |_| |_|   |_|\__,_|___/_| |_|",
]

# Spark / Diamond 4-Point Geometric Star
LOGO_SIZE = 19


def generate_spark_logo():
    grid = []
    center = LOGO_SIZE / 2.0
    for y in range(LOGO_SIZE):
        row = []
        for x in range(LOGO_SIZE * 2):
            nx = (x - LOGO_SIZE) / (LOGO_SIZE * 0.8)
            ny = (y - center) / (center * 0.8)
            # Astroid curve: |x|^(2/3) + |y|^(2/3) <= 1
            d = (abs(nx) ** 0.65) + (abs(ny) ** 0.65)
            if d <= 0.85:
                # Radial color intensity
                intensity = max(0.0, 1.0 - d)
                row.append(intensity)
            else:
                row.append(0.0)
        grid.append(row)
    return grid


def render_ascii_showcase():
    logo = generate_spark_logo()
    
    print("\033[2J\033[H", end="") # Clear screen
    print("\033[1;36m" + "=" * 80 + "\033[0m")
    print("\033[1;37;44m" + "  GEMINI 3.7 FLASH // BENCHMARK MODEL ID & LOGO ASCII RENDERER  ".center(80) + "\033[0m")
    print("\033[1;36m" + "=" * 80 + "\033[0m\n")

    # Render Logo + Side Specs
    specs = [
        "\033[1;33mMODEL IDENTITY\033[0m: Google Gemini 3.7 Flash",
        "\033[1;33mARCHITECTURE\033[0m: Dynamic Hybrid Thinking Workhorse",
        "\033[1;33mCONTEXT WINDOW\033[0m: 1,000,000 Tokens (1M)",
        "\033[1;33mMAX OUTPUT\033[0m: 64,000 Tokens",
        "\033[1;33mBENCHMARK DOMAIN\033[0m: L1-L4 Full Pipeline Automation",
        "\033[1;33mSTATUS\033[0m: Active // Acceptance Verified",
        "\033[1;33mTIMESTAMP\033[0m: 2026-08-14 Live Production",
        "",
        "\033[36m[High-Throughput / Low-Latency Code Engine]\033[0m"
    ]

    for y in range(len(logo)):
        line_chars = []
        for x in range(len(logo[y])):
            val = logo[y][x]
            if val > 0.0:
                # Blue to Cyan to Magenta gradient
                r = int(50 + 205 * val)
                g = int(140 + 115 * val)
                b = 255
                char_idx = int((1.0 - val) * (len(ASCII_RAMP) - 1))
                ch = ASCII_RAMP[char_idx]
                line_chars.append(f"\033[38;2;{r};{g};{b}m{ch}\033[0m")
            else:
                line_chars.append(" ")

        left_art = "".join(line_chars)
        spec_idx = y - 4
        right_spec = specs[spec_idx] if 0 <= spec_idx < len(specs) else ""
        print(f"  {left_art}   {right_spec}")

    print("\n\033[1;35m" + "-" * 80 + "\033[0m")
    # Banner
    for banner_line in BANNER_GEMINI:
        print(f"\033[1;36m{banner_line}\033[0m")
    print("\033[1;35m" + "-" * 80 + "\033[0m\n")


if __name__ == "__main__":
    render_ascii_showcase()
