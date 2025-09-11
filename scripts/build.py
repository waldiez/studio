# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Build the project."""

import os
import shutil
import subprocess  # nosemgrep # nosec
import sys
from glob import glob
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent


def _safe_env_for_build() -> dict[str, str]:
    env = os.environ.copy()
    if sys.platform == "win32":
        project_tmp = ROOT_DIR / ".local" / "tmp"
        project_tmp.mkdir(parents=True, exist_ok=True)
        env["TEMP"] = str(project_tmp)
        env["TMP"] = str(project_tmp)
    return env


def _install_dependencies(env: dict[str, str]) -> None:
    subprocess.run(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--upgrade",
            "pip",
            "setuptools",
            "wheel",
            "twine",
            "hatchling",
        ],
        check=True,
        cwd=ROOT_DIR,
        env=env,
    )


def _build_package() -> None:
    env = _safe_env_for_build()

    build_dir = ROOT_DIR / "build"
    dist_dir = ROOT_DIR / "dist"
    if "--output" in sys.argv:
        i = sys.argv.index("--output")
        if i + 1 < len(sys.argv):
            dist_dir = Path(sys.argv[i + 1])

    for p in (build_dir, dist_dir):
        if p.exists():
            shutil.rmtree(p, ignore_errors=True)
        p.mkdir(parents=True, exist_ok=True)

    _install_dependencies(env)

    cmd = [
        sys.executable,
        "-m",
        "hatchling",
        "build",
        "-t",
        "sdist",
        "-t",
        "wheel",
        "-d",
        str(dist_dir),
    ]
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True, cwd=ROOT_DIR, env=env)

    wheels = glob(str(dist_dir / "*.whl"))
    sdists = glob(str(dist_dir / "*.tar.gz"))
    if not wheels and not sdists:
        raise RuntimeError(f"No build artifacts found under {dist_dir}")

    subprocess.run(
        [sys.executable, "-m", "twine", "check", *wheels, *sdists],
        check=True,
        cwd=ROOT_DIR,
        env=env,
    )

    if "--publish" in sys.argv or "--upload" in sys.argv:
        subprocess.run(
            [sys.executable, "-m", "twine", "upload", *(wheels + sdists)],
            check=True,
            cwd=ROOT_DIR,
            env=env,
        )
        print("Let's say we uploaded the package.")
    print("Build done [waldiez_studio].")


def _cleanup_dot_local_tmp_if_any() -> None:
    project_tmp = ROOT_DIR / ".local" / "tmp"
    if project_tmp.is_dir():
        shutil.rmtree(project_tmp, ignore_errors=True)


def main() -> None:
    """Build and check the package."""
    try:
        _build_package()
    finally:
        _cleanup_dot_local_tmp_if_any()


if __name__ == "__main__":
    main()
