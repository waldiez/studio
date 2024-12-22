"""Metadata hook for Hatchling that reads metadata from package.json."""

import json
import os
from pathlib import Path
from typing import Any, Dict

from hatchling.metadata.plugin.interface import MetadataHookInterface

ROOT_DIR = Path(__file__).resolve().parents[2]


class JSONMetaDataHook(MetadataHookInterface):
    """Hook that reads metadata from package.json."""

    def update(self, metadata: Dict[str, Any]) -> None:
        """Update metadata with data from package.json.

        Parameters
        ----------
        metadata : Dict[str, Any]
            Metadata to update.
        """
        # load version, author, and description from package.json
        package_json_path = ROOT_DIR / "package.json"
        if not os.path.exists(package_json_path):
            return
        with open(package_json_path, "r", encoding="utf-8") as f_read:
            package_json = json.load(f_read)
        package_version = package_json.get("version", metadata["version"])
        if package_version != metadata["version"]:
            metadata["version"] = package_version
            _write_version(package_version)
        description = package_json.get("description", None)
        if description:
            metadata["description"] = description
        metadata["authors"] = [
            {"name": contributor["name"], "email": contributor["email"]}
            for contributor in package_json.get("contributors", [])
        ]


def _write_version(version: str) -> None:
    """Write version to _version.py.

    Parameters
    ----------
    version : str
        Version to write.
    root : str
        Root directory.
    """
    version_path = ROOT_DIR / "waldiez_studio" / "_version.py"
    version_string = f'''"""Version information for waldiez_studio.

Dev: Do not edit this file.
Use ../package.json to update the version instead.
The version will be updated automatically by Hatchling.
See ../scripts/hook.py for more information.
"""

__version__ = "{version}"
'''
    with open(
        version_path,
        "w",
        encoding="utf-8",
        newline="\n",
    ) as f_write:
        f_write.write(version_string)
