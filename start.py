#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# start.py
# ──────────────────────────────────────────────────────────────────────────
#  Cross-platform launcher for ZeroScript.
#  Supports Windows, macOS, and Linux by launching the Python bridge, ensuring
#  the required dependency is installed, and recovering stale bridge listeners.
# ──────────────────────────────────────────────────────────────────────────
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Iterable, Optional

MIN_PYTHON = (3, 9)
HERE = Path(__file__).resolve().parent
LOGS_DIR = HERE / "logs"
LOG_PATH = LOGS_DIR / "start.log"
BRIDGE_SCRIPT = HERE / "bridge.py"
DEFAULT_BRIDGE_PORT = 17613
WEB_SOCKET_PACKAGE = "websockets"
LOG_ROTATE_SIZE = 5_000_000  # 5 MB


def rotate_log() -> None:
    try:
        if LOG_PATH.exists() and LOG_PATH.stat().st_size >= LOG_ROTATE_SIZE:
            archive = LOG_PATH.with_suffix(".log.1")
            if archive.exists():
                archive.unlink()
            LOG_PATH.rename(archive)
    except Exception:
        pass


def log(message: str) -> None:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    rotate_log()
    entry = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {message}"
    try:
        with LOG_PATH.open("a", encoding="utf-8", errors="replace") as handle:
            handle.write(entry + "\n")
    except Exception:
        pass
    print(message)


def fail(message: str) -> int:
    log(message)
    print("\nERROR: " + message)
    return 1


def check_bridge_script() -> bool:
    if not BRIDGE_SCRIPT.is_file():
        log("FATAL: bridge.py missing next to start.py.")
        print("ERROR: bridge.py not found next to start.py.")
        print("Extract the full repository and run start.py from that folder.")
        return False
    return True


def python_is_usable() -> bool:
    if sys.version_info < MIN_PYTHON:
        print(f"ERROR: Python {sys.version_info.major}.{sys.version_info.minor} is too old.")
        print(f"ZeroScript requires Python {MIN_PYTHON[0]}.{MIN_PYTHON[1]} or newer.")
        log(f"FATAL: unsupported Python {sys.version_info.major}.{sys.version_info.minor}.")
        return False
    return True


def import_websockets() -> bool:
    try:
        import websockets  # noqa: F401
        return True
    except ImportError:
        return False


def run_pip_install() -> bool:
    pip_cmd = [sys.executable, "-m", "pip", "install", "--user", WEB_SOCKET_PACKAGE]
    result = subprocess.run(pip_cmd, capture_output=True, text=True)
    if result.returncode == 0:
        return True
    log(
        "pip install failed: "
        + (result.stdout.strip() or "")
        + " "
        + (result.stderr.strip() or "")
    )
    if "No module named pip" in result.stderr or "No module named pip" in result.stdout:
        return False
    return False


def bootstrap_pip() -> bool:
    ensurepip_cmd = [sys.executable, "-m", "ensurepip", "--upgrade"]
    result = subprocess.run(ensurepip_cmd, capture_output=True, text=True)
    return result.returncode == 0


def ensure_websockets() -> bool:
    print("Checking websockets package...")
    if import_websockets():
        log("websockets library already installed.")
        print("websockets already installed.")
        return True

    print("Installing websockets package...")
    log("websockets missing, installing via pip.")
    if run_pip_install() and import_websockets():
        log("websockets installed successfully.")
        return True

    log("pip install failed; attempting ensurepip.")
    if bootstrap_pip() and run_pip_install() and import_websockets():
        log("websockets installed successfully after ensurepip.")
        return True

    print("Failed to install websockets. Run the following command manually:")
    print("  " + " ".join([sys.executable, "-m", "pip", "install", "--user", WEB_SOCKET_PACKAGE]))
    log("FATAL: websockets install failed.")
    return False


def find_listening_pid(port: int) -> Optional[int]:
    if sys.platform == "win32":
        return _find_listening_pid_windows(port)
    return _find_listening_pid_unix(port)


def _find_listening_pid_windows(port: int) -> Optional[int]:
    try:
        result = subprocess.run(["netstat", "-aon"], capture_output=True, text=True)
        for line in result.stdout.splitlines():
            if f":{port}" not in line:
                continue
            if "LISTENING" not in line.upper():
                continue
            parts = line.split()
            if parts and parts[-1].isdigit():
                return int(parts[-1])
    except Exception:
        pass
    return None


def _find_listening_pid_unix(port: int) -> Optional[int]:
    for command in (["lsof", "-ti", f"tcp:{port}"], ["ss", "-ltnp"]):
        try:
            result = subprocess.run(command, capture_output=True, text=True)
            if result.returncode != 0:
                continue
            output = result.stdout.strip()
            if not output:
                continue
            if command[0] == "lsof":
                pid_str = output.splitlines()[0].strip()
                if pid_str.isdigit():
                    return int(pid_str)
                continue
            for line in output.splitlines():
                if f":{port}" not in line:
                    continue
                if "LISTEN" not in line and "LISTENING" not in line.upper():
                    continue
                if "pid=" in line:
                    part = line.split("pid=")[-1].split(",")[0]
                    if part.isdigit():
                        return int(part)
        except FileNotFoundError:
            continue
        except Exception:
            continue
    return None


def get_command_line(pid: int) -> str:
    if sys.platform == "win32":
        return _get_command_line_windows(pid)
    return _get_command_line_unix(pid)


def _get_command_line_windows(pid: int) -> str:
    try:
        result = subprocess.run(
            ["wmic", "process", "where", f"processid={pid}", "get", "CommandLine"],
            capture_output=True,
            text=True,
        )
        lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        if len(lines) >= 2:
            return " ".join(lines[1:])
    except Exception:
        pass
    return ""


def _get_command_line_unix(pid: int) -> str:
    try:
        result = subprocess.run(["ps", "-p", str(pid), "-o", "args="], capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return ""


def is_zero_script_process(pid: int) -> bool:
    cmdline = get_command_line(pid).lower()
    if not cmdline:
        return False
    return any(keyword in cmdline for keyword in ("bridge.py", "start.py", "zeroscript"))


def kill_pid(pid: int) -> bool:
    if sys.platform == "win32":
        result = subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)])
        return result.returncode == 0
    result = subprocess.run(["kill", "-9", str(pid)])
    return result.returncode == 0


def replace_previous_bridge(port: int, force_kill: bool) -> None:
    pid = find_listening_pid(port)
    if pid is None:
        return
    if force_kill or is_zero_script_process(pid):
        print(f"A previous ZeroScript bridge is listening on port {port} (pid {pid}). Replacing it...")
        log(f"Replacing previous bridge pid {pid} on port {port}.")
        if kill_pid(pid):
            time.sleep(1.0)
            log(f"Killed previous bridge pid {pid}.")
        else:
            log(f"Failed to kill previous bridge pid {pid}.")
            print("Warning: could not terminate the previous process listening on the bridge port.")
    else:
        print(f"Port {port} is already in use by PID {pid}.")
        print("The process does not appear to be ZeroScript, so it will not be killed automatically.")
        print("If you want to force termination, rerun with --force-kill.")
        log(f"Port {port} held by non-ZeroScript pid {pid}; no action taken.")
        raise SystemExit(1)


def launch_bridge() -> int:
    args = [sys.executable, str(BRIDGE_SCRIPT)]
    process = subprocess.Popen(args)
    try:
        return process.wait()
    except KeyboardInterrupt:
        process.terminate()
        return process.wait()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start ZeroScript bridge with dependency checks.")
    parser.add_argument("--bridge-port", type=int, default=DEFAULT_BRIDGE_PORT, help="Port used by the local bridge.")
    parser.add_argument("--force-kill", action="store_true", help="Force kill any process listening on the bridge port.")
    parser.add_argument("--skip-deps", action="store_true", help="Skip dependency installation checks.")
    return parser.parse_args()


def main() -> int:
    os.chdir(HERE)
    args = parse_args()
    print("\n=== ZeroScript Bridge Launcher ===\n")
    log("=== start.py launched ===")
    if not check_bridge_script():
        return 1
    if not python_is_usable():
        return 1
    if not args.skip_deps and not ensure_websockets():
        return 1
    try:
        replace_previous_bridge(args.bridge_port, args.force_kill)
    except SystemExit as exc:
        return exc.code if isinstance(exc.code, int) else 1
    exit_code = launch_bridge()
    log(f"bridge.py exited with code {exit_code}")
    print()
    if exit_code != 0:
        print("Bridge stopped with an error. See logs/start.log for details.")
    else:
        print("Bridge stopped normally.")
    try:
        input("Press Enter to close this window...")
    except Exception:
        pass
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
