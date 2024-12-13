"""Build the python package."""

import os
import shutil
import subprocess  # nosemgrep # nosec
import sys


def main() -> None:
    """Build the python package."""
    os.makedirs("dist", exist_ok=True)
    os.makedirs("build", exist_ok=True)
    shutil.rmtree("dist", ignore_errors=True)
    shutil.rmtree("build", ignore_errors=True)
    subprocess.run(  # nosemgrep # nosec
        [sys.executable, "-m", "pip", "install", "--upgrade", "pip", "wheel"],
        check=True,
    )
    subprocess.run(  # nosemgrep # nosec
        [sys.executable, "-m", "pip", "install", "-r", "requirements/main.txt"],
        check=True,
    )
    subprocess.run(  # nosemgrep # nosec
        [sys.executable, "-m", "pip", "install", "build", "twine"],
        check=True,
    )
    subprocess.run(  # nosemgrep # nosec
        [
            sys.executable,
            "-m",
            "build",
            "--sdist",
            "--wheel",
            "--outdir",
            "dist/",
        ],
        check=True,
    )
    subprocess.run(
        [sys.executable, "-m", "twine", "check", "dist/*.whl"],
        check=True,
    )
    shutil.rmtree("build", ignore_errors=True)


if __name__ == "__main__":
    main()
