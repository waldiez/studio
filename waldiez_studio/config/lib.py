"""Config related helper functions.

To get configuration values from
environment variables or command line arguments.
"""

import os
import sys
from typing import List

ENV_PREFIX = "WALDIEZ_STUDIO_"


def get_trusted_hosts(domain_name: str, host: str) -> List[str]:
    """Get the trusted hosts.

    Parameters
    ----------
    domain_name : str
        The domain name

    host : str
        The host to listen on

    Returns
    -------
    List[str]
        The trusted hosts
    """
    from_env = os.environ.get(f"{ENV_PREFIX}TRUSTED_HOSTS", "")
    trusted_hosts = from_env.split(",") if from_env else []
    if not isinstance(trusted_hosts, list):
        trusted_hosts = [trusted_hosts]
    if not trusted_hosts or domain_name not in trusted_hosts:
        trusted_hosts.append(domain_name)
    if host not in trusted_hosts and host not in ["localhost", "0.0.0.0"]:
        trusted_hosts.append(host)
    if "--trusted-hosts" in sys.argv:
        trusted_host_index = sys.argv.index("--trusted-hosts") + 1
        if trusted_host_index < len(sys.argv):
            trusted_hosts_arg = sys.argv[trusted_host_index]
            if trusted_hosts_arg:
                trusted_hosts_split = trusted_hosts_arg.split(",")
                for trusted_host in trusted_hosts_split:
                    if trusted_host and trusted_host not in trusted_hosts:
                        trusted_hosts.append(trusted_host)
    return trusted_hosts


def get_trusted_origins(
    domain_name: str, port: int, force_ssl: bool, host: str
) -> List[str]:
    """Get the trusted origins.

    Parameters
    ----------
    domain_name : str
        The domain name
    port : int
        The port
    force_ssl : bool
        Whether to force SSL
    host : str
        The host to listen on

    Returns
    -------
    List[str]
        The trusted origins
    """
    from_env = os.environ.get(f"{ENV_PREFIX}TRUSTED_ORIGINS", "")
    trusted_origins = from_env.split(",") if from_env else []

    default_trusted_origins = [f"https://{domain_name}"]
    if host != domain_name:
        default_trusted_origins.append(f"https://{host}")
    if not force_ssl:
        default_trusted_origins.extend(
            [
                f"http://{domain_name}",
                f"http://{domain_name}:{port}",
                f"http://{host}",
                f"http://{host}:{port}",
            ]
        )

    trusted_origins.extend(
        origin
        for origin in default_trusted_origins
        if origin not in trusted_origins
    )

    if "--trusted-origins" in sys.argv:
        trusted_origin_index = sys.argv.index("--trusted-origins") + 1
        if trusted_origin_index < len(sys.argv):
            trusted_origin = sys.argv[trusted_origin_index]
            if trusted_origin and trusted_origin not in trusted_origins:
                trusted_origins.append(trusted_origin)

    return trusted_origins


def get_default_domain_name() -> str:
    """Get the default domain name.

    Returns
    -------
    str
        The default domain name
    """
    if "--domain-name" in sys.argv:
        domain_name_index = sys.argv.index("--domain-name") + 1
        if domain_name_index < len(sys.argv):
            domain_name = sys.argv[domain_name_index]
            if domain_name:
                os.environ[f"{ENV_PREFIX}DOMAIN_NAME"] = domain_name
                return domain_name
    return os.environ.get(f"{ENV_PREFIX}DOMAIN_NAME", "localhost")


def get_default_host() -> str:
    """Get the default host.

    Returns
    -------
    str
        The default host
    """
    if "--host" in sys.argv:
        host_index = sys.argv.index("--host") + 1
        if host_index < len(sys.argv):
            host = sys.argv[host_index]
            if host:
                os.environ[f"{ENV_PREFIX}HOST"] = host
                return host
    return os.environ.get(f"{ENV_PREFIX}HOST", "localhost")


def get_default_port() -> int:
    """Get the default port.

    Returns
    -------
    int
        The default port
    """
    if "--port" in sys.argv:
        port_index = sys.argv.index("--port") + 1
        if port_index < len(sys.argv):
            try:
                port = int(sys.argv[port_index])
                os.environ[f"{ENV_PREFIX}PORT"] = str(port)
                return port
            except ValueError:
                pass
    try:
        return int(os.environ.get(f"{ENV_PREFIX}PORT", "8000"))
    except ValueError:
        return 8000
