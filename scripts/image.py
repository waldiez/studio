"""Build container image."""

import argparse
import os
import shutil
import subprocess  # nosemgrep # nosec
import sys
from pathlib import Path
from typing import List

try:
    from dotenv import load_dotenv
except ImportError:
    pass
else:
    load_dotenv(override=True)


_ROOT_DIR = Path(__file__).parent.parent.resolve()
_DEFAULT_IMAGE = os.environ.get("IMAGE_NAME", "waldiez/studio")
_FALLBACK_TAG = "dev" if "--dev" in sys.argv else "latest"
_DEFAULT_TAG = os.environ.get("IMAGE_TAG", _FALLBACK_TAG)
_DEFAULT_PLATFORM = os.environ.get("PLATFORM", "linux/amd64")


def get_container_cmd() -> str:
    """Get the container command to use.

    Returns
    -------
    str
        The container command to use. Either "docker" or "podman".

    Raises
    ------
    RuntimeError
        If neither "docker" nor "podman" is found.
    """
    from_env = os.environ.get("CONTAINER_COMMAND", "")
    if from_env and from_env in ["docker", "podman"]:
        return from_env
    # prefer podman over docker if found
    if shutil.which("podman"):
        return "podman"
    if not shutil.which("docker"):
        raise RuntimeError("Could not find docker or podman.")
    return "docker"


def run_command(command: List[str]) -> None:
    """Run a command.

    Parameters
    ----------
    command : List[str]
        The command to run.

    Raises
    ------
    subprocess.CalledProcessError
        If the command returns a non-zero exit status.
    """
    print(f"Running command: \n{' '.join(command)}\n")
    subprocess.run(
        command,
        check=True,
        env=os.environ,
        cwd=_ROOT_DIR,
        stdout=sys.stdout,
        stderr=sys.stderr,
        text=True,
    )  # nosemgrep # nosec


# pylint: disable=too-many-positional-arguments
def build_image(
    container_file: str,
    image_name: str,
    image_tag: str,
    platform: str,
    container_command: str,
    no_cache: bool,
    build_args: List[str],
) -> None:
    """Build the container image.

    Parameters
    ----------
    container_file : str
        Path to the Containerfile.
    image_name : str
        Name of the image to build.
    image_tag : str
        Tag of the image to build.
    platform : str
        Set platform if the image is multi-platform.
    container_command : str
        The container command to use.
    no_cache : bool
        Do not use cache when building the image.
    build_args : List[str]
        Build arguments.

    Raises
    ------
    subprocess.CalledProcessError
        If the command returns a non-zero exit status.
    """
    cmd = [
        container_command,
        "build",
        "--platform",
        platform,
        "--tag",
        f"{image_name}:{image_tag}",
        "-f",
        container_file,
    ]
    if no_cache:
        cmd.append("--no-cache")
    for arg in build_args:
        cmd.extend(["--build-arg", arg])
    if container_command == "docker":
        cmd.extend(["--progress=plain"])
    cmd.append(".")
    run_command(cmd)


def cli() -> argparse.ArgumentParser:
    """Create the CLI parser.

    Returns
    -------
    argparse.ArgumentParser
        The CLI parser.
    """
    parser = argparse.ArgumentParser(description="Build container image.")
    parser.add_argument(
        "--image-name",
        type=str,
        default=_DEFAULT_IMAGE,
        help="Name of the image to build.",
    )
    parser.add_argument(
        "--image-tag",
        type=str,
        default=_DEFAULT_TAG,
        help="Tag of the image to build.",
    )
    parser.add_argument(
        "--platform",
        type=str,
        default=_DEFAULT_PLATFORM,
        choices=["linux/amd64", "linux/arm64"],
        help="Set platform if the image is multi-platform.",
    )
    parser.add_argument(
        "--container-command",
        default=get_container_cmd(),
        choices=["docker", "podman"],
        help="The container command to use.",
    )
    parser.add_argument(
        "--build-args",
        type=str,
        action="append",
        help="Build arguments.",
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Do not use cache when building the image.",
    )
    return parser


def main() -> None:
    """Parse the CLI arguments and build the container image.

    Raises
    ------
    subprocess.CalledProcessError
        If the command returns a non-zero exit status
    """
    args = cli().parse_args()
    build_args = args.build_args or []
    container_file = "Containerfile"
    build_image(
        container_file,
        args.image_name,
        args.image_tag,
        args.platform,
        args.container_command,
        args.no_cache,
        build_args,
    )


if __name__ == "__main__":
    main()
