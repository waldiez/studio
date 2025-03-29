# SPDX-License-Identifier: Apache-2.0.
# Copyright (c) 2024 - 2025 Waldiez and contributors.

"""Make sure the frontend is built recently."""

import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

# pylint: disable=import-error
# pyright: reportMissingImports=false
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
        package_manager = self._find_package_manager()
        print("Building frontend...")
        try:
            subprocess.run(  # nosemgrep # nosec
                [str(package_manager), "run", "build"],
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

    def _find_package_manager(self) -> str:
        """Find the package manager executable.

        Returns
        -------
        str
            The package manager executable.

        Raises
        ------
        RuntimeError
            If package manager is not found.
        """
        package_json_path = Path(self.root) / "package.json"
        if not package_json_path.exists():
            raise RuntimeError("package.json not found.")
        # get from package.json: "packageManager": "bun@1.2.7",
        with open(package_json_path, "r", encoding="utf-8") as f_read:
            try:
                package_json = json.load(f_read)
            except json.JSONDecodeError as error:
                raise RuntimeError(
                    f"Error parsing package.json: {error}"
                ) from error
        package_manager = package_json.get("packageManager")
        if not package_manager:
            raise RuntimeError("packageManager not found in package.json.")
        manager_name = package_manager.split("@")[0]
        manager_path = shutil.which(manager_name)
        if not manager_path:
            # check ./node_modules/.bin/{manager}
            node_modules = Path(self.root) / "node_modules"
            if node_modules.exists():
                manager_path = node_modules / ".bin" / manager_name
                if sys.platform == "win32" and not manager_path.exists():
                    manager_path = manager_path.with_suffix(".exe")
        if not manager_path:
            raise RuntimeError(
                f"{manager_name} is required to build the frontend."
            )
        return str(manager_path)
