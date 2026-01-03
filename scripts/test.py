# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2026 Waldiez and contributors.

"""Run tests in the my_package package."""
# Requirement:
# The (final) coverage report must be in the `coverage` directory.
# It must be in the `lcov` format. (file `coverage/lcov.info`)

import os
import shutil
import subprocess  # nosemgrep # nosec
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
os.environ["PYTHONUNBUFFERED"] = "1"


def ensure_test_requirements() -> None:
    """Ensure the test requirements are installed."""
    requirements_file = ROOT_DIR / "requirements" / "test.txt"
    subprocess.run(  # nosemgrep # nosec
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "waldiez",
            "-r",
            str(requirements_file),
        ],
        check=True,
        cwd=ROOT_DIR,
    )


def run_pytest() -> None:
    """Run pytest."""
    coverage_dir = ROOT_DIR / "coverage" / "backend"
    if coverage_dir.exists():
        shutil.rmtree(coverage_dir)
    coverage_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(  # nosemgrep # nosec
        [
            sys.executable,
            "-m",
            "pytest",
            "-c",
            "pyproject.toml",
            "--cov=waldiez_studio",
            "--cov-branch",
            "--cov-report=term-missing",
            "--cov-report",
            "lcov:coverage/backend/lcov.info",
            "--cov-report",
            "html:coverage/backend/html",
            "--cov-report",
            "xml:coverage/backend/coverage.xml",
            "--junitxml=coverage/backend/xunit.xml",
            "tests",
        ],
        check=True,
        cwd=ROOT_DIR,
    )
    # if ROOT_DIR / "coverage" / "frontend" / "lcov.info" exists:
    # call `./merge_lcov.py` to merge the two files
    # else, make a copy of /coverage/backend/lcov.info to /coverage/lcov.info
    # this depends on the order that the tests are run
    frontend_lcov = ROOT_DIR / "coverage" / "frontend" / "lcov.info"
    (ROOT_DIR / "coverage").mkdir(parents=True, exist_ok=True)
    # in case lcov command does not exist
    shutil.copyfile(
        coverage_dir / "lcov.info",
        ROOT_DIR / "coverage" / "lcov.info",
    )
    if frontend_lcov.exists():
        subprocess.run(  # nosemgrep # nosec
            [
                sys.executable,
                os.path.join("scripts", "merge_lcov.py"),
            ],
            check=True,
            cwd=ROOT_DIR,
        )


def main() -> None:
    """Run the tests."""
    # ensure_test_requirements()
    run_pytest()


if __name__ == "__main__":
    main()
