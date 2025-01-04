# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Merge lcov files from multiple directories."""

import shutil
import subprocess  # nosemgrep # nosec
import sys
from pathlib import Path
from typing import List

# pylint: disable=duplicate-code  # also in ./lint.py, ./format.py
ROOT_DIR = Path(__file__).resolve().parents[1]


def run_command(args: List[str]) -> None:
    """Run a command.

    Parameters
    ----------
    args : List[str]
        List of arguments to pass to the command.
    """
    args_str = " ".join(args)
    print(f"Running command: {args_str}")
    subprocess.run(  # nosemgrep # nosec
        args,
        cwd=ROOT_DIR,
        stdout=sys.stdout,
        stderr=subprocess.STDOUT,
        check=True,
    )


def is_lcov_2(lcov_cmd: List[str]) -> bool:
    """Check if lcov is version 2 or later.

    Parameters
    ----------
    lcov_cmd : List[str]
        The lcov command.

    Returns
    -------
    bool
        True if lcov is version 2 or later, otherwise False.
    """
    output = subprocess.run(  # nosemgrep # nosec
        lcov_cmd + ["--version"],
        cwd=ROOT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    version_output = output.stdout.decode("utf-8").strip()
    if "version 2" in version_output:
        return True
    return False


def keep_any_lcov(frontend_lcov: Path, backend_lcov: Path) -> None:
    """Keep any lcov file found and copy it to the coverage directory.

    Parameters
    ----------
    frontend_lcov : Path
        The frontend lcov file.
    backend_lcov : Path
        The backend lcov file.
    """
    destination = ROOT_DIR / "coverage" / "lcov.info"
    if destination.is_file():
        return
    if frontend_lcov.is_file():
        shutil.copyfile(frontend_lcov, ROOT_DIR / "coverage" / "lcov.info")
    elif backend_lcov.is_file():
        shutil.copyfile(backend_lcov, ROOT_DIR / "coverage" / "lcov.info")


def merge_lcov(lcov_cmd: List[str]) -> None:
    """Merge lcov files.

    Parameters
    ----------
    lcov_cmd : List[str]
        The lcov command.
    """
    frontend_lcov = ROOT_DIR / "coverage" / "frontend" / "lcov.info"
    backend_lcov = ROOT_DIR / "coverage" / "backend" / "lcov.info"
    if not frontend_lcov.is_file() or not backend_lcov.is_file():
        print("not all lcov files found. Skipping.")
        keep_any_lcov(frontend_lcov, backend_lcov)
        return
    if is_lcov_2(lcov_cmd):
        branch_coverage = "branch_coverage=1"
    else:
        branch_coverage = "lcov_branch_coverage=1"
    merged_lcov = ROOT_DIR / "coverage" / "lcov.info"
    if merged_lcov.is_file():
        merged_lcov.unlink()
    run_command(
        lcov_cmd
        + [
            "--add-tracefile",
            str(frontend_lcov),
            "--add-tracefile",
            str(backend_lcov),
            "--rc",
            branch_coverage,
            "--rc",
            "geninfo_auto_base=1",
            "--ignore-errors",
            "inconsistent",
            "--ignore-errors",
            "corrupt",
            "-o",
            str(merged_lcov),
        ]
    )


def get_windows_lcov_cmd() -> List[str]:
    """Return the lcov command for Windows.

    Returns
    -------
    List[str]
        The lcov command for Windows if found, otherwise an empty list.
    """
    perl_path = Path("C:/Strawberry/perl/bin/perl.exe")
    if not perl_path.is_file():
        print("perl not found. Skipping.")
        print("You could try using choco to install lcov:")
        print("`choco install lcov`")
        return []
    lcov_path = Path("C:/ProgramData/chocolatey/lib/lcov/tools/bin/lcov")
    if not lcov_path.is_file():
        print("lcov not found. Skipping.")
        print("You could try using choco to install lcov:")
        print("`choco install lcov`")
        return []
    return [str(perl_path), str(lcov_path)]


def get_macos_lcov_cmd() -> List[str]:
    """Return the lcov command for macOS.

    Returns
    -------
    List[str]
        The lcov command for macOS if found, otherwise an empty list.
    """
    if not shutil.which("lcov"):
        print("lcov not found. Skipping.")
        print("You could try using brew to install lcov:")
        print("`brew install lcov`")
        return []
    return ["lcov"]


def get_linux_lcov_cmd() -> List[str]:
    """Return the lcov command for Linux.

    Returns
    -------
    List[str]
        The lcov command for Linux if found, otherwise an empty list
    """
    if not shutil.which("lcov"):
        print("lcov not found. Skipping.")
        print("You could try using apt/dnf/pacman/whatever to install lcov")
        print("`sudo apt install lcov`")
        print("`sudo dnf install lcov`")
        print("`sudo pacman -S lcov`")
        return []
    return ["lcov"]


def get_lcov_cmd() -> List[str]:
    """Return the lcov command.

    Returns
    -------
    List[str]
        The lcov command if found, otherwise an empty list.
    """
    if shutil.which("lcov"):
        return ["lcov"]
    is_windows = sys.platform == "win32"
    if is_windows:
        return get_windows_lcov_cmd()
    is_macos = sys.platform == "darwin"
    if is_macos:
        return get_macos_lcov_cmd()
    is_linux = sys.platform.startswith("linux")
    if is_linux:
        return get_linux_lcov_cmd()
    print("lcov not found. Skipping.")
    return []


def main() -> None:
    """Run lcov."""
    lcov_cmd = get_lcov_cmd()
    if not lcov_cmd:
        return
    merge_lcov(lcov_cmd)


if __name__ == "__main__":
    main()
