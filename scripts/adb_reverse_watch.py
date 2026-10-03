#!/usr/bin/env python3
"""Keep JAPANO's Android reverse tunnels alive across wireless ADB reconnects."""

import argparse
import shutil
import subprocess
import time


PORTS = (4100, 8081)


def output(args):
    return subprocess.run(args, capture_output=True, text=True, timeout=10).stdout


def online_devices(adb):
    return [
        line.split()[0]
        for line in output([adb, "devices"]).splitlines()[1:]
        if "\tdevice" in line
    ]


def reconnect_paired_devices(adb):
    for line in output([adb, "mdns", "services"]).splitlines():
        if "_adb-tls-connect._tcp" not in line:
            continue
        address = line.split()[-1]
        try:
            subprocess.run(
                [adb, "connect", address], capture_output=True, text=True, timeout=10
            )
        except subprocess.TimeoutExpired:
            pass


def ensure_reverse(adb, serial):
    mappings = output([adb, "-s", serial, "reverse", "--list"])
    for port in PORTS:
        expected = f"tcp:{port} tcp:{port}"
        if expected in mappings:
            continue
        subprocess.run(
            [adb, "-s", serial, "reverse", f"tcp:{port}", f"tcp:{port}"],
            check=True,
            timeout=10,
        )
        print(f"ADB reverse restored: {serial} tcp:{port}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", help="Thiết bị ưu tiên; tự tìm lại nếu cổng Wi-Fi đổi")
    parser.add_argument("--adb", help="Đường dẫn tuyệt đối tới Android Debug Bridge")
    parser.add_argument("--interval", type=float, default=3.0)
    args = parser.parse_args()
    adb = args.adb or shutil.which("adb")
    if not adb:
        raise RuntimeError("Không tìm thấy adb")

    last_serial = None
    while True:
        try:
            devices = online_devices(adb)
            if not devices:
                reconnect_paired_devices(adb)
                devices = online_devices(adb)
            serial = args.serial if args.serial in devices else (devices[0] if len(devices) == 1 else None)
            if serial:
                ensure_reverse(adb, serial)
                if serial != last_serial:
                    print(f"ADB reverse watchdog: {serial}", flush=True)
                last_serial = serial
        except (OSError, subprocess.SubprocessError) as error:
            print(f"ADB reverse watchdog đang chờ thiết bị: {error}", flush=True)
        time.sleep(max(args.interval, 1.0))


if __name__ == "__main__":
    main()
