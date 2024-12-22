# type: ignore
"""Generate requirements/*txt files from pyproject.toml."""

# flake8: noqa E501
# pylint: disable=import-error,import-outside-toplevel,too-few-public-methods,broad-except
# isort: skip_file
import os
import re
import subprocess  # nosemgrep # nosec
import sys
from pathlib import Path
from typing import Any, Dict, List, Protocol, Tuple


ROOT_DIR = Path(__file__).parent.parent
EXCLUDED_EXTRAS = []
EXCLUDED_PACKAGES = ["waldiez"]  # we might need a version not yet published

# toml uses 'r' mode, tomllib uses 'rb' mode
OPEN_MODE = "rb" if sys.version_info >= (3, 11) else "r"


class TomlLoader(Protocol):
    """Protocol for TOML loaders."""

    def __call__(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        """Load TOML data from a file."""


def get_loader() -> TomlLoader:
    """Get the TOML loader.

    Returns
    -------
    TomlLoader
        TOML loader function.

    Raises
    ------
    ImportError
        If the TOML library is not found and cannot be installed.
    """
    if sys.version_info >= (3, 11):
        import tomllib  # noqa

        return tomllib.load
    try:
        import toml  # noqa

        return toml.load
    except ImportError as error:
        print("`toml` library not found. Installing it now...")
        try:
            subprocess.check_call(  # nosemgrep # nosec
                [sys.executable, "-m", "pip", "install", "toml"],
                stdout=sys.stdout,
                stderr=sys.stderr,
            )
            import toml  # noqa

            return toml.load
        except BaseException:
            try:
                subprocess.check_call(  # nosemgrep # nosec
                    [sys.executable, "-m", "pip", "install", "--user", "toml"],
                )
                import toml  # noqa

                return toml.load
            except Exception as err:
                raise ImportError(
                    "Failed to install the `toml` library. "
                    f"Please install it manually.\nError: {err}"
                ) from err
        raise ImportError("Failed to import the `toml` library.") from error


def _write_all_dot_txt(project_dir: Path, extras: list) -> None:
    """Generate requirements/all.txt with references to all requirements."""
    if not os.path.exists(project_dir / "requirements"):
        os.makedirs(project_dir / "requirements")
    items = extras + ["main"]
    with open(
        project_dir / "requirements" / "all.txt",
        "w",
        encoding="utf-8",
        newline="\n",
    ) as file:
        for item in items:
            file.write(f"-r {item}.txt\n")


def get_package_name(requirement: str) -> str:
    """Get the package name from a requirement string.

    Parameters
    ----------
    requirement : str
        The requirement string.

    Returns
    -------
    str
        The package name.
    """
    # remove possible <, >, <=, ==, ;, etc.
    # just get the package name
    # e.g. "numpy>=1.20.0" -> "numpy"
    return re.split(r"[<=>;]", requirement)[0]


def _write_main_txt(project_dir: Path, main_requirements: List[str]) -> None:
    """Write the main requirements file."""
    with open(
        project_dir / "requirements" / "main.txt",
        "w",
        encoding="utf-8",
        newline="\n",
    ) as file:
        for requirement in sorted(main_requirements):
            raw_requirement = get_package_name(requirement)
            if raw_requirement in EXCLUDED_PACKAGES:
                continue
            file.write(f"{requirement}\n")


def _write_extra_txt(
    project_dir: Path, extra: str, extra_requirements: List[str], has_main: bool
) -> None:
    """Write an extra requirements file."""
    with open(
        project_dir / "requirements" / f"{extra}.txt",
        "w",
        encoding="utf-8",
        newline="\n",
    ) as file:
        if has_main:
            file.write("-r main.txt\n")
        for requirement in sorted(extra_requirements):
            raw_requirement = get_package_name(requirement)
            if raw_requirement in EXCLUDED_PACKAGES:
                continue
            file.write(f"{requirement}\n")


def _write_requirements_txt(
    project_dir: Path, toml_data: Dict[str, Any]
) -> Tuple[bool, List[str]]:
    """Write requirements/*.txt file.

    Parameters
    ----------
    project_dir : Path
        The project directory.
    toml_data : Dict[str, Any]
        The parsed pyproject.toml data.

    Returns
    -------
    Tuple[bool, List[str]]
        A tuple of whether the main requirements were found and
        a list of extra keys.
    """
    has_main = True
    try:
        main_requirements = toml_data["project"]["dependencies"]
    except KeyError:
        has_main = False
    try:
        extra_requirements = toml_data["project"]["optional-dependencies"]
    except KeyError:
        extra_requirements = {}
    if not os.path.exists(project_dir / "requirements"):
        os.makedirs(project_dir / "requirements")
    if has_main:
        _write_main_txt(project_dir, main_requirements)
    extra_keys = []
    for extra in extra_requirements:
        if extra in EXCLUDED_EXTRAS:
            continue
        extra_keys.append(extra)
        _write_extra_txt(
            project_dir, extra, extra_requirements[extra], has_main
        )
    return has_main, extra_keys


def main() -> None:
    """Generate requirements/*txt files from pyproject.toml.

    Raises
    ------
    FileNotFoundError
        If the pyproject.toml file is not found.
    """
    loader = get_loader()
    py_project_toml = ROOT_DIR / "pyproject.toml"
    if not py_project_toml.exists():
        raise FileNotFoundError(f"File not found: {py_project_toml}")
    with open(py_project_toml, OPEN_MODE) as f:
        toml_data = loader(f)
    if not os.path.exists(ROOT_DIR / "requirements"):
        os.makedirs(ROOT_DIR / "requirements")
    has_main, keys = _write_requirements_txt(ROOT_DIR, toml_data)
    if has_main:
        _write_all_dot_txt(ROOT_DIR, keys)
    print("Done. Generated:")
    for file in os.listdir(ROOT_DIR / "requirements"):
        print(f"  - {file}")
    if "--install" in sys.argv:
        to_install = ["-r", os.path.join("requirements", "all.txt")]
        if not has_main:
            to_install = []
            for key in keys:
                to_install.extend(
                    ["-r", os.path.join("requirements", f"{key}.txt")]
                )
        subprocess.run(  # nosemgrep # nosec
            [
                sys.executable,
                "-m",
                "pip",
                "install",
            ]
            + to_install,
            cwd=ROOT_DIR,
            stdout=sys.stdout,
            stderr=subprocess.STDOUT,
            check=True,
        )


if __name__ == "__main__":
    main()
