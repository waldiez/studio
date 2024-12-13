"""Make sure the frontend is built recently."""

import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from hatchling.builders.hooks.plugin.interface import BuildHookInterface

THRESHOLD = 600  # 10 minutes before this check


class PreBuildHook(BuildHookInterface):  # type: ignore
    """Hook that checks if the frontend is built."""

    PLUGIN_NAME = "pre_build"

    # pylint: disable=unused-argument,no-self-use
    def initialize(self, version: str, build_data: Dict[str, Any]) -> None:
        """This occurs immediately before each build.

        Any modifications to the build data will be seen by the build target.

        Parameters
        ----------
        version : str
            Version of the package.
        build_data : Dict[str, Any]
            Build data.

        Raises
        ------
        RuntimeError
            If the frontend build fails.
        """
        if self._needs_frontend_build():
            self._build_frontend()
        if self._needs_frontend_build():
            raise RuntimeError("Frontend build failed.")

    def _needs_frontend_build(self) -> bool:
        """Check if the last build was more than 10 minutes ago.

        If so, the frontend needs to be rebuilt.

        Returns
        -------
        bool
            True if the frontend needs to be rebuilt.
        """

        last_build_txt = (
            Path(self.root)
            / "waldiez_studio"
            / "static"
            / "frontend"
            / "last-build.txt"
        )
        if not last_build_txt.exists():
            print("No last build file found.Checked for:", last_build_txt)
            return True
        with open(last_build_txt, "r", encoding="utf-8") as f_read:
            last_build = f_read.read().strip().replace("Z", "+00:00")
        try:
            last_build_date = datetime.fromisoformat(last_build)
        except ValueError as error:
            print(f"Error parsing last build date: {error}")
            return True
        return (
            datetime.now(timezone.utc) - last_build_date
        ).total_seconds() > THRESHOLD

    def _build_frontend(self) -> None:
        """Build the frontend.

        Raises
        ------
        RuntimeError
            If the frontend build fails.
        """
        yarn = shutil.which("yarn")
        if yarn:
            raise RuntimeError("Yarn is required to build the frontend.")
        print("Building frontend...")
        try:
            subprocess.run(  # nosemgrep # nosec
                [str(yarn), "build:front"],
                cwd=self.root,
                check=True,
                stdout=sys.stdout,
                stderr=subprocess.PIPE,
            )
        except subprocess.CalledProcessError as e:
            raise RuntimeError(
                f"Frontend build failed: {e.stderr.decode()}"
            ) from e
        except BaseException as e:
            raise RuntimeError(f"Frontend build failed: {e}") from e
