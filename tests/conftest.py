"""Pytest configuration file."""

import os
from shutil import copyfile
from typing import Generator

import pytest
from filelock import FileLock

os.environ["WALDIEZ_STUDIO_TESTING"] = "true"


def before_all() -> None:
    """Run before all tests."""
    env_file: str = ".env"
    backup_file: str = ".env.bak"

    if os.path.exists(env_file):
        copyfile(env_file, backup_file)

    env = os.environ.copy()
    for key in list(env):
        if (
            key.startswith("WALDIEZ_STUDIO_")
            and key != "WALDIEZ_STUDIO_TESTING"
        ):
            os.environ.pop(key)


def after_all() -> None:
    """Run after all tests."""
    env_file: str = ".env"
    backup_file: str = ".env.bak"

    if os.path.exists(backup_file):
        copyfile(backup_file, env_file)
        os.remove(backup_file)
    elif os.path.exists(env_file):
        os.remove(env_file)  # Remove any .env created during tests


@pytest.fixture(scope="session")
def backup_and_restore_dot_env(
    tmp_path_factory: pytest.TempPathFactory,
    worker_id: str,
) -> Generator[None, None, None]:
    """Backup and restore the .env file, synchronized for pytest-xdist.

    Parameters
    ----------
    tmp_path_factory : pytest.TempPathFactory
        Temporary path factory
    worker_id : str
        Worker ID

    Yields
    ------
    Generator[None, None, None]
        Pytest fixture generator
    """
    os.environ["WALDIEZ_STUDIO_TESTING"] = "true"
    if worker_id == "master":
        # not executing in with multiple workers, just produce the data and let
        # pytest's fixture caching do its job
        before_all()
        yield
        after_all()
        os.environ.pop("WALDIEZ_STUDIO_TESTING")
    else:
        root_tmp_dir = tmp_path_factory.getbasetemp().parent
        fn = root_tmp_dir / "env_file"
        with FileLock(str(fn) + ".lock"):
            if not fn.exists():
                before_all()
                fn.write_text("backup done")
            else:
                fn.write_text("backup restored")
        yield
        with FileLock(str(fn) + ".lock"):
            if fn.read_text() == "backup done":
                after_all()
            else:
                fn.unlink()
            os.environ.pop("WALDIEZ_STUDIO_TESTING")
